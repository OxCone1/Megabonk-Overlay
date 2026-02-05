import { useCallback, Suspense, useDeferredValue } from 'react';
import { useOverlayStore } from '@/stores/overlayStore';
import { DragContext } from '@/components/overlay/DragContext';
import { GridCanvas } from '@/components/overlay/GridCanvas';
import { CanvasContainer } from '@/components/overlay/CanvasContainer';
import { ElementRenderer } from '@/components/overlay/ElementRenderer';
import { OverlaySidebar } from '@/components/sidebar/OverlaySidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { RelayServerProvider } from '@/hooks/useRelayServer';
import { useRelaySettings } from '@/hooks/useRelaySettings';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useI18n } from '@/lib/i18n';
import { Toaster } from 'sonner';
import { Pause, Play } from 'lucide-react';

// Loading fallback for elements
function ElementSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Skeleton className="w-full h-full bg-white/5" />
    </div>
  );
}

function App() {
  const { 
    elements, 
    setSelectedElementId,
    transparentBackground,
    isDragging,
    setTransparentBackground,
    resetCanvasView,
    setSidebarOpen,
    setSidebarVisible,
  } = useOverlayStore();
  const { t } = useI18n();
  useRelaySettings();
  
  // useDeferredValue for elements during drag operations
  // This defers re-rendering of element list during drag for smoother performance
  const deferredElements = useDeferredValue(elements);
  // Use immediate elements when not dragging, deferred when dragging for performance
  const displayElements = isDragging ? deferredElements : elements;
  
  // Deselect element when clicking on empty canvas area
  const handleCanvasClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      setSelectedElementId(null);
    }
  }, [setSelectedElementId]);

  const handleObsOverlayToggle = useCallback(() => {
    const next = !transparentBackground;
    setTransparentBackground(next);
    if (next) {
      resetCanvasView();
      setSidebarOpen(false);
      setSidebarVisible(false);
    }
  }, [transparentBackground, setTransparentBackground, resetCanvasView, setSidebarOpen, setSidebarVisible]);
  
  return (
    <RelayServerProvider>
      <TooltipProvider>
        <Toaster position="bottom-right" />
        <DragContext>
          <div className="h-screen w-screen bg-neutral-950 flex overflow-hidden obs-main-container">
            {/* Sidebar Layer */}
            <OverlaySidebar />
            
            {/* Main Canvas Area */}
            <div 
              className="flex-1 relative overflow-hidden"
              onClick={transparentBackground ? undefined : handleCanvasClick}
            >
              <CanvasContainer>
                <div className="relative">
                  {/* Grid Canvas (Bottom Layer) */}
                  <GridCanvas>
                    {/* Placed Elements with Suspense for lazy loading */}
                    <Suspense fallback={<ElementSkeleton />}>
                      {displayElements.map(element => (
                        <ElementRenderer key={element.id} element={element} />
                      ))}
                    </Suspense>
                  </GridCanvas>
                  
                  {/* Canvas Instructions Overlay - hidden in OBS overlay mode */}
                  {elements.length === 0 && !transparentBackground && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none obs-hide-in-overlay">
                      <div className="text-center p-6 bg-black/40 rounded-xl backdrop-blur-sm border border-white/10">
                        <h2 className="text-lg font-semibold text-white mb-2">
                          {t('overlayTitle', 'Megabonk Overlay Editor')}
                        </h2>
                        <p className="text-sm text-white/60 mb-4 max-w-xs">
                          {t('overlayIntro', 'Move your mouse to show the sidebar, then drag elements to the canvas or click the + button to add them.')}
                        </p>
                        <div className="flex flex-col gap-2 text-xs text-white/40">
                          <span>• {t('overlayHintDrag', 'Drag to move elements')}</span>
                          <span>• {t('overlayHintResize', 'Resize from corners and edges')}</span>
                          <span>• {t('overlayHintSelect', 'Click element to select')}</span>
                          <span>• {t('overlayHintSettings', 'Use Settings tab for resolution')}</span>
                          <span>• {t('overlayHintZoom', 'Scroll to zoom, middle-click to pan')}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CanvasContainer>
            </div>

            {/* Interaction blocker for OBS overlay mode */}
            {transparentBackground && (
              <div
                aria-hidden="true"
                className="fixed inset-0 z-[9998] bg-transparent pointer-events-auto"
              />
            )}

            {/* OBS overlay mode toggle (always available) */}
            <button
              onClick={handleObsOverlayToggle}
              className="fixed bottom-3 right-3 z-[9999] h-9 w-9 rounded-full bg-black/70 text-white/80 hover:text-white hover:bg-black/80 transition-colors flex items-center justify-center"
              title={transparentBackground ? t('obsOverlayOn', 'OBS Overlay Mode: on') : t('obsOverlayOff', 'OBS Overlay Mode: off')}
            >
              {transparentBackground ? <Pause size={16} /> : <Play size={16} />}
            </button>
          </div>
        </DragContext>
      </TooltipProvider>
    </RelayServerProvider>
  );
}

export default App;
