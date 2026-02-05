import { useState, useCallback, useRef, useEffect, useTransition, useMemo, memo } from 'react';
import { 
  DndContext, 
  DragOverlay,
  pointerWithin,
  useSensor,
  useSensors,
  PointerSensor,
  MouseSensor,
  TouchSensor,
} from '@dnd-kit/core';
import { restrictToWindowEdges, snapCenterToCursor } from '@dnd-kit/modifiers';
import { useOverlayStore, ELEMENT_TYPES } from '@/stores/overlayStore';
import { cn } from '@/lib/utils';

export function DragContext({ children }) {
  const { 
    addElement, 
    setIsDragging, 
    setSidebarOpen,
    getResolutionDimensions,
    canvasZoom,
    transparentBackground,
    isDragging,
  } = useOverlayStore();
  
  const [activeDrag, setActiveDrag] = useState(null);
  const lastPointerPositionRef = useRef({ x: 0, y: 0 });
  
  // useTransition for non-blocking element additions
  const [isPending, startTransition] = useTransition();
  
  // Optimized sensors with better activation constraints for smoother drag
  const mouseSensor = useSensor(MouseSensor, {
    // Require mouse to move 5 pixels before activating - reduces accidental drags
    activationConstraint: {
      distance: 5,
    },
  });
  
  const touchSensor = useSensor(TouchSensor, {
    // Touch requires a small delay to distinguish from scroll
    activationConstraint: {
      delay: 100,
      tolerance: 5,
    },
  });
  
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: {
      distance: 5,
    },
  });
  
  const sensors = useSensors(mouseSensor, touchSensor, pointerSensor);
  
  // Track mouse position during drag for accurate drop location
  useEffect(() => {
    if (transparentBackground) return;
    const handlePointerMove = (e) => {
      lastPointerPositionRef.current = { x: e.clientX, y: e.clientY };
    };
    
    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    return () => document.removeEventListener('pointermove', handlePointerMove);
  }, [transparentBackground]);

  useEffect(() => {
    if (!transparentBackground) return;
    if (isDragging) {
      setIsDragging(false);
      setActiveDrag(null);
    }
  }, [transparentBackground, isDragging, setIsDragging]);
  
  const handleDragStart = useCallback((event) => {
    const { active } = event;
    const data = active.data.current;
    
    if (data) {
      setActiveDrag(data);
      setIsDragging(true);
      setSidebarOpen(false);
    }
  }, [setIsDragging, setSidebarOpen]);
  
  const handleDragEnd = useCallback((event) => {
    const { active } = event;
    const data = active.data.current;
    
    if (data && active.id.toString().startsWith('palette-')) {
      // Find the canvas element to calculate drop position relative to it
      const canvasElement = document.querySelector('[data-canvas="true"]');
      
      if (canvasElement) {
        const canvasRect = canvasElement.getBoundingClientRect();
        const dimensions = getResolutionDimensions();
        const config = ELEMENT_TYPES.find(e => e.type === data.type);
        const elementWidth = config?.defaultSize.width || 150;
        const elementHeight = config?.defaultSize.height || 80;
        
        // Calculate drop position relative to canvas, accounting for zoom
        // The canvas rect is already scaled, so we need to convert screen coords to canvas coords
        const screenX = lastPointerPositionRef.current.x - canvasRect.left;
        const screenY = lastPointerPositionRef.current.y - canvasRect.top;
        
        // Convert screen coordinates to canvas coordinates by dividing by zoom
        const canvasX = screenX / canvasZoom;
        const canvasY = screenY / canvasZoom;
        
        // Center the element on cursor position
        const dropX = canvasX - (elementWidth / 2);
        const dropY = canvasY - (elementHeight / 2);
        
        // Clamp to canvas bounds
        const clampedX = Math.max(0, Math.min(dropX, dimensions.width - elementWidth));
        const clampedY = Math.max(0, Math.min(dropY, dimensions.height - elementHeight));
        
        // Use startTransition for non-blocking element addition
        startTransition(() => {
          addElement(data.type, data.playerId, { x: clampedX, y: clampedY });
        });
      } else {
        // Fallback: place at center of canvas
        const dimensions = getResolutionDimensions();
        const config = ELEMENT_TYPES.find(e => e.type === data.type);
        const elementWidth = config?.defaultSize.width || 150;
        const elementHeight = config?.defaultSize.height || 80;
        
        // Use startTransition for non-blocking element addition
        startTransition(() => {
          addElement(data.type, data.playerId, { 
            x: (dimensions.width - elementWidth) / 2, 
            y: (dimensions.height - elementHeight) / 2 
          });
        });
      }
    }
    
    setActiveDrag(null);
    setIsDragging(false);
  }, [addElement, getResolutionDimensions, setIsDragging, canvasZoom, startTransition]);
  
  const handleDragCancel = useCallback(() => {
    setActiveDrag(null);
    setIsDragging(false);
  }, [setIsDragging]);
  
  if (transparentBackground) {
    return <>{children}</>;
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
      modifiers={[restrictToWindowEdges]}
      // Accessibility announcement for drag operations
      autoScroll={false} // Disable auto-scroll for better performance in fixed canvas
    >
      {children}
      
      <DragOverlay 
        modifiers={[snapCenterToCursor]}
        dropAnimation={null} // Disable drop animation for instant feedback
        style={{
          // GPU acceleration for smooth drag overlay
          willChange: 'transform',
        }}
      >
        {activeDrag ? (
          <DragPreview type={activeDrag.type} playerId={activeDrag.playerId} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Memoized DragPreview with GPU acceleration
const DragPreview = memo(function DragPreview({ type, playerId }) {
  const config = ELEMENT_TYPES.find(e => e.type === type);
  
  return (
    <div 
      className={cn(
        "rounded-lg bg-black/80 border-2 border-primary/50",
        "flex items-center justify-center p-4 shadow-xl"
      )}
      style={{
        width: config?.defaultSize.width || 150,
        height: config?.defaultSize.height || 80,
        // GPU acceleration and remove backdrop-blur for performance
        willChange: 'transform',
        transform: 'translateZ(0)', // Force GPU layer
        backfaceVisibility: 'hidden',
      }}
    >
      <div className="text-center">
        <div className="text-sm font-medium text-white">{config?.label}</div>
        <div className="text-xs text-white/60">Player {playerId}</div>
      </div>
    </div>
  );
});
