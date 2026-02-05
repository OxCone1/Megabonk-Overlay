import { useCallback, useEffect, useState, useRef } from 'react';
import { useOverlayStore } from '@/stores/overlayStore';
import { cn } from '@/lib/utils';
import { SelectionManager } from './SelectionManager';

export function GridCanvas({ children, className }) {
  const { 
    getResolutionDimensions, 
    gridSize, 
    showGrid,
    gridEnabled,
    transparentBackground,
    backgroundImageUrl,
    setSelectedElementId,
    elements,
    setSelectedElementIds,
    isSelectingRectangle,
    setIsSelectingRectangle,
    selectionRectangle,
    setSelectionRectangle,
    isDragging,
    canvasZoom,
    elementClickedRecently,
    setElementClickedRecently,
    obsHideLabels,
  } = useOverlayStore();
  
  const dimensions = getResolutionDimensions();
  const lastActivityRef = useRef(0);
  const [indicatorVisible, setIndicatorVisible] = useState(true);
  const replayContextMenuRef = useRef(false);
  
  // Initialize activity ref
  useEffect(() => {
    lastActivityRef.current = Date.now();
  }, []);

  // Keyboard shortcuts (Undo/Redo/Delete)
  useEffect(() => {
    if (transparentBackground) return;
    const isEditableTarget = (target) => {
      if (!target) return false;
      const tagName = target.tagName?.toLowerCase?.() || '';
      return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || target.isContentEditable;
    };

    const handleKeyDown = (e) => {
      if (isEditableTarget(e.target)) return;

      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault();
        useOverlayStore.getState().undo();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && key === 'y') {
        e.preventDefault();
        useOverlayStore.getState().redo();
        return;
      }

      if (e.key === 'Delete') {
        const { selectedElementIds, selectedElementId, removeElements } = useOverlayStore.getState();
        const ids = selectedElementIds.length > 0
          ? selectedElementIds
          : (selectedElementId ? [selectedElementId] : []);
        if (ids.length > 0) {
          e.preventDefault();
          removeElements(ids);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [transparentBackground]);
  
  // Global handler for Ctrl+Click on already-selected elements
  useEffect(() => {
    if (transparentBackground) return;
    const handleGlobalMouseDown = (e) => {
      // Only handle Ctrl/Cmd + Click
      if (!(e.ctrlKey || e.metaKey)) return;
      
      // Find which element was clicked using elements from point
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const elementDiv = elements.find(el => el.hasAttribute('data-element-id'));
      
      if (elementDiv) {
        const elementId = elementDiv.getAttribute('data-element-id');
        const { selectedElementIds, toggleSelection, setElementClickedRecently } = useOverlayStore.getState();
        
        // Only handle if element is already selected (to avoid interfering with normal Ctrl+Click to add)
        if (selectedElementIds.includes(elementId)) {
          setElementClickedRecently(true);
          toggleSelection(elementId);
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    
    document.addEventListener('mousedown', handleGlobalMouseDown, true); // Use capture phase
    
    return () => {
      document.removeEventListener('mousedown', handleGlobalMouseDown, true);
    };
  }, [transparentBackground]);

  // Ensure context menu opens when right-clicking any selected element (even through Moveable overlay)
  useEffect(() => {
    if (transparentBackground) return;
    const handleGlobalContextMenu = (e) => {
      if (replayContextMenuRef.current) return;

      const { selectedElementIds } = useOverlayStore.getState();
      if (!selectedElementIds || selectedElementIds.length === 0) return;

      const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
      const elementDiv = elementsAtPoint.find(el => el?.hasAttribute?.('data-element-id'));
      if (!elementDiv) return;

      const elementId = elementDiv.getAttribute('data-element-id');
      if (!selectedElementIds.includes(elementId)) return;

      if (e.target !== elementDiv) {
        replayContextMenuRef.current = true;
        e.preventDefault();
        e.stopPropagation();

        const syntheticEvent = new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: e.clientX,
          clientY: e.clientY,
          button: 2,
        });
        elementDiv.dispatchEvent(syntheticEvent);

        setTimeout(() => {
          replayContextMenuRef.current = false;
        }, 0);
      }
    };

    document.addEventListener('contextmenu', handleGlobalContextMenu, true);
    return () => {
      document.removeEventListener('contextmenu', handleGlobalContextMenu, true);
    };
  }, [transparentBackground]);
  
  // Apply/remove OBS overlay mode class to html element (root level for full transparency)
  useEffect(() => {
    if (transparentBackground) {
      document.documentElement.classList.add('obs-overlay-mode');
    } else {
      document.documentElement.classList.remove('obs-overlay-mode');
    }

    if (transparentBackground && obsHideLabels) {
      document.documentElement.classList.add('obs-hide-labels');
    } else {
      document.documentElement.classList.remove('obs-hide-labels');
    }
    return () => {
      document.documentElement.classList.remove('obs-overlay-mode');
      document.documentElement.classList.remove('obs-hide-labels');
    };
  }, [transparentBackground, obsHideLabels]);
  
  // Auto-hide resolution indicator after 3 seconds of inactivity
  useEffect(() => {
    const checkIdle = () => {
      const now = Date.now();
      if (now - lastActivityRef.current > 3000 && indicatorVisible) {
        setIndicatorVisible(false);
      }
    };
    
    const interval = setInterval(checkIdle, 500);
    return () => clearInterval(interval);
  }, [indicatorVisible]);
  
  // Show indicator on actual user interaction only
  const handleUserInteraction = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (!indicatorVisible) {
      setIndicatorVisible(true);
    }
  }, [indicatorVisible]);
  
  // Click anywhere that's not on an element to deselect
  const selectionJustEndedRef = useRef(0);
  
  const handleCanvasClick = useCallback((e) => {
    if (transparentBackground) return;
    // Don't deselect if actively dragging OR doing rectangle selection
    if (isDragging || isSelectingRectangle) {
      return;
    }

    // Ignore ALL clicks within 200ms of finishing a rectangle selection
    // This prevents the mouseup and any subsequent synthetic clicks from deselecting
    const timeSinceSelection = Date.now() - selectionJustEndedRef.current;
    if (timeSinceSelection < 200) {
      return;
    }

    // Ignore clicks on moveable controls
    if (e.target.closest('.moveable')) {
      return;
    }
    
    // If an element was clicked, it should have set the flag via handleClick
    // Check and clear the flag (with a small timeout for React event ordering)
    if (elementClickedRecently) {
      setElementClickedRecently(false);
      return;
    }
    
    setSelectedElementId(null);
    setSelectedElementIds([]);
  }, [setSelectedElementId, setSelectedElementIds, isDragging, isSelectingRectangle, elementClickedRecently, setElementClickedRecently, transparentBackground]);
  
  // Canvas ref for coordinate calculations
  const canvasRef = useRef(null);
  const lastValidPointRef = useRef(null);
  const selectionRectangleRef = useRef(selectionRectangle);
  useEffect(() => {
    selectionRectangleRef.current = selectionRectangle;
  }, [selectionRectangle]);
  
  const getCanvasPoint = useCallback((e) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;

    // Convert from screen space to canvas space
    const rawX = (e.clientX - rect.left) / canvasZoom;
    const rawY = (e.clientY - rect.top) / canvasZoom;

    // If pointer leaves canvas, ignore updates to prevent full-canvas selection
    if (rawX < 0 || rawY < 0 || rawX > dimensions.width || rawY > dimensions.height) {
      return null;
    }

    const point = { x: rawX, y: rawY };
    lastValidPointRef.current = point;
    return point;
  }, [canvasZoom, dimensions.width, dimensions.height]);

  // Start rectangle selection on left mouse down
  const handleMouseDown = useCallback((e) => {
    if (transparentBackground) return;
    // Only start selection on left click, and not on elements or during drag
    if (e.button !== 0) return;
    if (e.target.closest('[data-element-id]')) return;
    if (isDragging) return;

    const point = getCanvasPoint(e) || lastValidPointRef.current;
    if (!point) return;

    setSelectionRectangle({ startX: point.x, startY: point.y, endX: point.x, endY: point.y });
    setIsSelectingRectangle(true);
  }, [setSelectionRectangle, setIsSelectingRectangle, isDragging, getCanvasPoint, transparentBackground]);
  
  // Update rectangle during drag - no throttling for smooth visual feedback
  const handleMouseMoveForSelection = useCallback((e) => {
    if (transparentBackground) return;
    if (!isSelectingRectangle || !selectionRectangleRef.current) return;
    
    const point = getCanvasPoint(e) || lastValidPointRef.current;
    if (!point) return;

    setSelectionRectangle({
      ...selectionRectangleRef.current,
      endX: point.x,
      endY: point.y,
    });
  }, [isSelectingRectangle, setSelectionRectangle, getCanvasPoint, transparentBackground]);
  
  // Complete selection on mouse up
  const handleMouseUp = useCallback(() => {
    if (transparentBackground) return;
    const rectState = selectionRectangleRef.current;
    if (!isSelectingRectangle || !rectState) {
      setIsSelectingRectangle(false);
      return;
    }
    
    // Clear selection state FIRST to prevent click handler interference
    setIsSelectingRectangle(false);
    
    // Calculate normalized rectangle (handle negative dimensions)
    const minX = Math.min(rectState.startX, rectState.endX);
    const maxX = Math.max(rectState.startX, rectState.endX);
    const minY = Math.min(rectState.startY, rectState.endY);
    const maxY = Math.max(rectState.startY, rectState.endY);
    
    // Only select if rectangle is at least 5px
    if (maxX - minX > 5 && maxY - minY > 5) {
      // Find elements within the selection rectangle
      const selectedIds = elements
        .filter(element => {
          const elMinX = element.position.x;
          const elMinY = element.position.y;
          const elMaxX = element.position.x + (element.size?.width || 100);
          const elMaxY = element.position.y + (element.size?.height || 50);
          
          // Check if element intersects with selection rectangle
          return !(elMaxX < minX || elMinX > maxX || elMaxY < minY || elMinY > maxY);
        })
        .map(el => el.id);
      
      if (selectedIds.length > 0) {
        setSelectedElementIds(selectedIds);
        setSelectedElementId(null);
      }

      // Set timestamp to ignore subsequent clicks
      selectionJustEndedRef.current = Date.now();
    }
    
    // Clear selection rectangle (moved from setTimeout)
    setSelectionRectangle(null);
  }, [isSelectingRectangle, elements, setSelectedElementIds, setSelectedElementId, setIsSelectingRectangle, setSelectionRectangle, transparentBackground]);
  
  // Global mouse up listener
  useEffect(() => {
    if (transparentBackground) return;
    if (isSelectingRectangle) {
      document.addEventListener('mouseup', handleMouseUp);
      return () => document.removeEventListener('mouseup', handleMouseUp);
    }
  }, [isSelectingRectangle, handleMouseUp, transparentBackground]);

  useEffect(() => {
    if (!transparentBackground) return;
    if (isSelectingRectangle) {
      setIsSelectingRectangle(false);
    }
    if (selectionRectangle) {
      setSelectionRectangle(null);
    }
  }, [transparentBackground, isSelectingRectangle, selectionRectangle, setIsSelectingRectangle, setSelectionRectangle]);
  
  // Generate grid pattern as CSS background (only if grid is enabled and visible)
  const gridPattern = (gridEnabled && showGrid) ? {
    backgroundImage: `
      linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,0.1) 1px, transparent 1px)
    `,
    backgroundSize: `${gridSize}px ${gridSize}px`,
  } : {};
  
  // Background style based on settings
  const backgroundStyle = {
    ...(transparentBackground 
      ? { backgroundColor: 'transparent' }
      : { backgroundColor: 'rgba(0, 0, 0, 0.8)' }
    ),
  };
  
  return (
    <div 
      ref={canvasRef}
      data-canvas="true"
      className={cn(
        "relative overflow-hidden rounded-lg border canvas-wrapper",
        transparentBackground ? "border-white/20 bg-transparent" : "border-white/10",
        isSelectingRectangle && "cursor-crosshair",
        className
      )}
      style={{
        width: dimensions.width,
        height: dimensions.height,
        maxWidth: '100%',
        aspectRatio: `${dimensions.width} / ${dimensions.height}`,
        ...backgroundStyle,
        ...gridPattern,
      }}
      onClick={transparentBackground ? undefined : (e) => {
        handleCanvasClick(e);
        handleUserInteraction();
      }}
      onMouseDown={transparentBackground ? undefined : (e) => {
        handleMouseDown(e);
        handleUserInteraction();
      }}
      onMouseMove={!transparentBackground && isSelectingRectangle ? handleMouseMoveForSelection : undefined}
    >
      {/* Background Image Layer - hidden in OBS overlay mode */}
      {backgroundImageUrl && !transparentBackground && (
        <div 
          className="absolute inset-0 pointer-events-none opacity-40 obs-hide-in-overlay"
          style={{
            backgroundImage: `url(${backgroundImageUrl})`,
            backgroundSize: 'contain',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }}
        />
      )}
      {/* Grid overlay - hidden in OBS overlay mode */}
      {showGrid && !transparentBackground && (
        <div 
          className="absolute inset-0 pointer-events-none opacity-20 obs-hide-in-overlay"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(59, 130, 246, 0.3) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(59, 130, 246, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: `${gridSize * 10}px ${gridSize * 10}px`,
          }}
        />
      )}
      
      {/* Content layer for placed elements */}
      <div 
        className="absolute inset-0"
        data-canvas-content="true"
        onClick={handleCanvasClick}
      >
        {children}
      </div>
      
      {/* Selection rectangle overlay */}
      {isSelectingRectangle && selectionRectangle && (
        <div
          className="absolute pointer-events-none border-2 border-blue-500 bg-blue-500/20 z-50"
          style={{
            left: Math.min(selectionRectangle.startX, selectionRectangle.endX),
            top: Math.min(selectionRectangle.startY, selectionRectangle.endY),
            width: Math.abs(selectionRectangle.endX - selectionRectangle.startX),
            height: Math.abs(selectionRectangle.endY - selectionRectangle.startY),
          }}
        />
      )}
      
      {/* Resolution indicator - auto-hide, hidden in OBS overlay mode */}
      {!transparentBackground && (
        <div 
          className={cn(
            "absolute bottom-2 right-2 px-2 py-1 bg-black/60 rounded text-xs text-white/60 transition-opacity duration-300 obs-hide-in-overlay",
            indicatorVisible ? "opacity-100" : "opacity-0"
          )}
        >
          {dimensions.width} × {dimensions.height}
        </div>
      )}
      
      {/* Centralized Movable Manager (handles single and multi-select moving) */}
      {!transparentBackground && <SelectionManager />}
    </div>
  );
}

