import { useRef, useCallback, useEffect, useMemo, useState } from 'react';
import { useOverlayStore } from '@/stores/overlayStore';
import { ZoomIn, ZoomOut, RotateCcw, Move } from 'lucide-react';
import { cn, throttle } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

export function CanvasContainer({ children }) {
  const { 
    canvasZoom, 
    canvasPan, 
    setCanvasZoom, 
    setCanvasPan,
    setIsPanning: setIsPanningStore,
    resetCanvasView,
    transparentBackground,
  } = useOverlayStore();

  const { t } = useI18n();
  
  const containerRef = useRef(null);
  const isPanningRef = useRef(false);
  const lastPanPositionRef = useRef({ x: 0, y: 0 });
  const canvasPanRef = useRef(canvasPan);
  const [isPanning, setIsPanning] = useState(false);
  
  // Always show controls when panning or zoomed - derived state
  const controlsVisible = useMemo(() => {
    return isPanning || canvasZoom !== 1;
  }, [isPanning, canvasZoom]);
  
  // Keep ref in sync with state
  useEffect(() => {
    canvasPanRef.current = canvasPan;
  }, [canvasPan]);
  
  // Handle wheel zoom
  const handleWheel = useCallback((e) => {
    if (transparentBackground) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const nextZoom = Math.max(0.1, Math.min(3, canvasZoom + delta));
    const ratio = nextZoom / canvasZoom;
    setCanvasZoom(nextZoom);
    setCanvasPan({
      x: canvasPan.x * ratio,
      y: canvasPan.y * ratio,
    });
  }, [canvasZoom, canvasPan.x, canvasPan.y, setCanvasZoom, setCanvasPan, transparentBackground]);
  
  // Handle middle mouse button panning
  const handleMouseDown = useCallback((e) => {
    if (transparentBackground) return;
    if (e.button === 1) { // Middle mouse button
      e.preventDefault();
      isPanningRef.current = true;
      setIsPanning(true);
      setIsPanningStore(true);
      lastPanPositionRef.current = { x: e.clientX, y: e.clientY };
      document.body.style.cursor = 'grabbing';
    }
  }, [setIsPanningStore, transparentBackground]);
  
  // Handle middle mouse button panning - throttled to 60fps
  const throttledMouseMoveRef = useRef(null);
  
  useEffect(() => {
    throttledMouseMoveRef.current = throttle((e) => {
      if (isPanningRef.current) {
        const deltaX = e.clientX - lastPanPositionRef.current.x;
        const deltaY = e.clientY - lastPanPositionRef.current.y;
        
        setCanvasPan({
          x: canvasPanRef.current.x + deltaX,
          y: canvasPanRef.current.y + deltaY,
        });
        
        lastPanPositionRef.current = { x: e.clientX, y: e.clientY };
      }
    }, 16);
  }, [setCanvasPan]);
  
  const handleMouseMove = useCallback((e) => {
    if (throttledMouseMoveRef.current) {
      throttledMouseMoveRef.current(e);
    }
  }, []);
  
  const handleMouseUp = useCallback(() => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      setIsPanning(false);
      setIsPanningStore(false);
      document.body.style.cursor = '';
    }
  }, [setIsPanningStore]);
  
  // Attach event listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (transparentBackground) return;

    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel, transparentBackground]);
  
  useEffect(() => {
    if (transparentBackground || !isPanning) return;
    
    document.addEventListener('mousemove', handleMouseMove, { passive: true });
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning, handleMouseMove, handleMouseUp, transparentBackground]);

  useEffect(() => {
    if (!transparentBackground) return;
    if (isPanningRef.current) {
      isPanningRef.current = false;
    }
    if (isPanning) {
      setIsPanning(false);
      setIsPanningStore(false);
    }
  }, [transparentBackground, isPanning, setIsPanningStore]);
  
  const zoomIn = useCallback(() => {
    const nextZoom = Math.max(0.1, Math.min(3, canvasZoom + 0.1));
    const ratio = nextZoom / canvasZoom;
    setCanvasZoom(nextZoom);
    setCanvasPan({
      x: canvasPan.x * ratio,
      y: canvasPan.y * ratio,
    });
  }, [canvasZoom, canvasPan.x, canvasPan.y, setCanvasZoom, setCanvasPan]);
  
  const zoomOut = useCallback(() => {
    const nextZoom = Math.max(0.1, Math.min(3, canvasZoom - 0.1));
    const ratio = nextZoom / canvasZoom;
    setCanvasZoom(nextZoom);
    setCanvasPan({
      x: canvasPan.x * ratio,
      y: canvasPan.y * ratio,
    });
  }, [canvasZoom, canvasPan.x, canvasPan.y, setCanvasZoom, setCanvasPan]);
  
  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      onMouseDown={transparentBackground ? undefined : handleMouseDown}
    >
      {/* Zoom/Pan Controls - auto-hide, hidden in OBS overlay mode */}
      {!transparentBackground && (
        <div 
          className={cn(
            "absolute bottom-4 left-4 z-[5] flex items-center gap-2 bg-black/60 rounded-lg p-2 backdrop-blur-sm transition-opacity duration-300 obs-hide-in-overlay",
            controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          <button
            onClick={zoomOut}
            className="p-2 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title={t('canvasZoomOut', 'Zoom Out (Scroll)')}
          >
            <ZoomOut size={18} />
          </button>
          
          <span className="text-sm text-white/70 min-w-[4rem] text-center">
            {Math.round(canvasZoom * 100)}%
          </span>
          
          <button
            onClick={zoomIn}
            className="p-2 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title={t('canvasZoomIn', 'Zoom In (Scroll)')}
          >
            <ZoomIn size={18} />
          </button>
          
          <div className="w-px h-6 bg-white/20" />
          
          <button
            onClick={resetCanvasView}
            className="p-2 rounded hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title={t('canvasResetView', 'Reset View')}
          >
            <RotateCcw size={18} />
          </button>
          
          <div className="flex items-center gap-1 text-xs text-white/50">
            <Move size={14} />
            <span>{t('canvasPanHint', 'Middle-click to pan')}</span>
          </div>
        </div>
      )}
      
      {/* Transformed Canvas Container */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        style={{
          transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${canvasZoom})`,
          transformOrigin: 'center center',
        }}
      >
        {children}
      </div>
    </div>
  );
}
