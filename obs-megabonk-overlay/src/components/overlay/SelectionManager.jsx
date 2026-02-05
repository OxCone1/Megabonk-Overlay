import { useMemo, useEffect, useRef, useCallback } from 'react';
import Moveable from 'react-moveable';
import { useOverlayStore } from '@/stores/overlayStore';

export function SelectionManager() {
  const selectedElementIds = useOverlayStore(state => state.selectedElementIds);
  const selectedElementId = useOverlayStore(state => state.selectedElementId);
  const groups = useOverlayStore(state => state.groups);
  const instaDragTimestamp = useOverlayStore(state => state.instaDragTimestamp);
  const gridEnabled = useOverlayStore(state => state.gridEnabled);
  const gridSize = useOverlayStore(state => state.gridSize);
  const canvasZoom = useOverlayStore(state => state.canvasZoom);
  const transparentBackground = useOverlayStore(state => state.transparentBackground);
  
  // Actions
  const moveElement = useOverlayStore(state => state.moveElement);
  const resizeElement = useOverlayStore(state => state.resizeElement);
  const setIsDragging = useOverlayStore(state => state.setIsDragging);
  
  // Stable callback reference to avoid re-render in useEffect
  const clearSelection = useCallback(() => {
    useOverlayStore.getState().clearSelection();
  }, []);
  
  // Get dimensions only when needed, not on every render
  const dimensions = useMemo(() => {
    return useOverlayStore.getState().getResolutionDimensions();
  }, []);
  
  // Auto-deselect timer ref
  const autoDeselectTimerRef = useRef(null);
  const axisLockRef = useRef(null); // 'x' | 'y' | null
  
  // Auto-deselect when OBS transparency is enabled
  useEffect(() => {
    // Clear any existing timer
    if (autoDeselectTimerRef.current) {
      clearTimeout(autoDeselectTimerRef.current);
      autoDeselectTimerRef.current = null;
    }
    
    // Only set timer if transparency is enabled and something is selected
    if (transparentBackground && (selectedElementId || selectedElementIds.length > 0)) {
      // Determine timeout: 10 seconds for groups, 5 seconds for single
      const isGroup = selectedElementIds.length > 1;
      const timeout = isGroup ? 10000 : 5000;
      
      autoDeselectTimerRef.current = setTimeout(() => {
        clearSelection();
      }, timeout);
    }
    
    // Cleanup on unmount or when dependencies change
    return () => {
      if (autoDeselectTimerRef.current) {
        clearTimeout(autoDeselectTimerRef.current);
        autoDeselectTimerRef.current = null;
      }
    };
  }, [transparentBackground, selectedElementId, selectedElementIds, clearSelection]);

  // Compute targets from selected IDs using useMemo
  const targets = useMemo(() => {
    // Collect all selected elements
    let ids = [];
    if (selectedElementIds.length > 0) {
      ids = selectedElementIds;
    } else if (selectedElementId) {
      ids = [selectedElementId];
    }

    // Expand selection to include full groups
    const expandedIds = new Set();
    ids.forEach(id => {
      const group = groups.find(g => g.elementIds.includes(id));
      if (group) {
        group.elementIds.forEach(groupId => expandedIds.add(groupId));
      } else {
        expandedIds.add(id);
      }
    });

    const elements = Array.from(expandedIds)
      .map(id => document.querySelector(`[data-element-id="${id}"]`))
      .filter(el => el !== null);
    
    return elements;
  }, [selectedElementIds, selectedElementId, groups]);

  if (targets.length === 0) {
    return null;
  }

  // Single target handlers
  const onDragStart = (e) => {
    setIsDragging(true);
    axisLockRef.current = null;
    const target = e?.target;
    if (target) {
      target.dataset.dragStartX = `${parseFloat(target.style.left) || 0}`;
      target.dataset.dragStartY = `${parseFloat(target.style.top) || 0}`;
    }
  };

  const onDrag = (e) => {
    // Only update DOM visually - don't touch store
    const zoom = canvasZoom || 1;
    const target = e.target;
    const startX = parseFloat(target.dataset.dragStartX || '0');
    const startY = parseFloat(target.dataset.dragStartY || '0');
    const translate = e.beforeTranslate || e.translate || [0, 0];
    let [dx, dy] = translate;
    const shiftKey = e.inputEvent?.shiftKey;
    if (!shiftKey) {
      axisLockRef.current = null;
    } else if (!axisLockRef.current) {
      axisLockRef.current = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
    }
    if (axisLockRef.current === 'x') {
      dy = 0;
    } else if (axisLockRef.current === 'y') {
      dx = 0;
    }

    let nextX = startX + (dx / zoom);
    let nextY = startY + (dy / zoom);

    if (gridEnabled && gridSize > 1) {
      nextX = Math.round(nextX / gridSize) * gridSize;
      nextY = Math.round(nextY / gridSize) * gridSize;
    }

    const rect = target.getBoundingClientRect();
    const width = rect.width / zoom;
    const height = rect.height / zoom;
    const maxX = Math.max(0, dimensions.width - width);
    const maxY = Math.max(0, dimensions.height - height);

    nextX = Math.min(Math.max(0, nextX), maxX);
    nextY = Math.min(Math.max(0, nextY), maxY);

    target.style.left = `${nextX}px`;
    target.style.top = `${nextY}px`;
  };

  const onDragEnd = (e) => {
    setIsDragging(false);
    const target = e.target;
    const id = target.getAttribute('data-element-id');
    if (!id) return;

    // Only NOW update the store with final position
    const left = parseFloat(target.style.left);
    const top = parseFloat(target.style.top);
    
    moveElement(id, { x: left, y: top });
  };

  const onResizeStart = (e) => {
    setIsDragging(true);
    const target = e?.target;
    if (target) {
      target.dataset.dragStartX = `${parseFloat(target.style.left) || 0}`;
      target.dataset.dragStartY = `${parseFloat(target.style.top) || 0}`;
    }
  };

  const onResize = (e) => {
    // Only update DOM visually - don't touch store
    const target = e.target;
    target.style.width = `${e.width}px`;
    target.style.height = `${e.height}px`;
    target.style.transform = e.drag.transform;
  };

  const onResizeEnd = (e) => {
    setIsDragging(false);
    const target = e.target;
    const id = target.getAttribute('data-element-id');
    if (!id) return;
    
    // Only NOW update the store with final size
    const width = parseFloat(target.style.width);
    const height = parseFloat(target.style.height);
    
    resizeElement(id, { width, height });
  };

  // Group handlers
  const onDragGroupStart = (e) => {
    setIsDragging(true);
    axisLockRef.current = null;
    e.targets.forEach(target => {
      target.dataset.dragStartX = `${parseFloat(target.style.left) || 0}`;
      target.dataset.dragStartY = `${parseFloat(target.style.top) || 0}`;
    });
  };

  const onDragGroup = (e) => {
    // Only update DOM visually - don't touch store
    const zoom = canvasZoom || 1;
    e.events.forEach(ev => {
      const target = ev.target;
      const startX = parseFloat(target.dataset.dragStartX || '0');
      const startY = parseFloat(target.dataset.dragStartY || '0');
      const translate = ev.beforeTranslate || ev.translate || [0, 0];
      let [dx, dy] = translate;
      const shiftKey = ev.inputEvent?.shiftKey;
      if (!shiftKey) {
        axisLockRef.current = null;
      } else if (!axisLockRef.current) {
        axisLockRef.current = Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';
      }
      if (axisLockRef.current === 'x') {
        dy = 0;
      } else if (axisLockRef.current === 'y') {
        dx = 0;
      }

      let nextX = startX + (dx / zoom);
      let nextY = startY + (dy / zoom);

      if (gridEnabled && gridSize > 1) {
        nextX = Math.round(nextX / gridSize) * gridSize;
        nextY = Math.round(nextY / gridSize) * gridSize;
      }

      const rect = target.getBoundingClientRect();
      const width = rect.width / zoom;
      const height = rect.height / zoom;
      const maxX = Math.max(0, dimensions.width - width);
      const maxY = Math.max(0, dimensions.height - height);

      nextX = Math.min(Math.max(0, nextX), maxX);
      nextY = Math.min(Math.max(0, nextY), maxY);

      target.style.left = `${nextX}px`;
      target.style.top = `${nextY}px`;
    });
  };

  const onDragGroupEnd = (e) => {
    setIsDragging(false);
    // Only NOW update all elements in store with final positions
    e.targets.forEach(target => {
      const id = target.getAttribute('data-element-id');
      if (id) {
        const left = parseFloat(target.style.left);
        const top = parseFloat(target.style.top);
        moveElement(id, { x: left, y: top });
      }
    });
  };

  // For resize group, it's complex because they might scale. 
  // We'll just support Drag for groups for now to fix the ghosting/CPU issue for moving.
  // Individual resize is usually preferred.

  // Handle clicks on targets for Ctrl+Click toggle
  const onClick = (e) => {
    // Check for Ctrl/Cmd key
    const isToggleKey = e.inputEvent?.ctrlKey || e.inputEvent?.metaKey;
    if (!isToggleKey) return;
    
    // Get the clicked target
    const target = e.inputTarget || e.target;
    const elementId = target?.getAttribute?.('data-element-id');
    
    if (elementId) {
      const { toggleSelection, setElementClickedRecently } = useOverlayStore.getState();
      setElementClickedRecently(true);
      toggleSelection(elementId);
    }
  }

  return (
    <Moveable
      key={`moveable-${instaDragTimestamp}`} // Force remount on InstaDrag to read fresh position
      target={targets}
      draggable={true}
      resizable={targets.length === 1} // Only resize single items for now
      scalable={targets.length === 1}  // Only scale single items
      
      throttleDrag={0}
      throttleResize={0}
      throttleScale={0.01}
      
      snappable={gridEnabled}
      snapGridWidth={gridEnabled ? gridSize : 1}
      snapGridHeight={gridEnabled ? gridSize : 1}
      bounds={{ left: 0, top: 0, right: 0, bottom: 0, position: 'css' }}
      
      zoom={canvasZoom ? 1 / canvasZoom : 1}
      
      // Handle clicks for Ctrl+Click toggle
      onClick={onClick}
      
      // Single events
      onDragStart={onDragStart}
      onDrag={onDrag}
      onDragEnd={onDragEnd}
      
      onResizeStart={onResizeStart}
      onResize={onResize}
      onResizeEnd={onResizeEnd}
      
      // Group events
      onDragGroupStart={onDragGroupStart}
      onDragGroup={onDragGroup}
      onDragGroupEnd={onDragGroupEnd}
    />
  );
}
