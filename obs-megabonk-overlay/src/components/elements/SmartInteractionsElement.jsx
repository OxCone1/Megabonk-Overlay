import { memo, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSmartInteractionsStore } from '@/stores/smartInteractionsStore';
import { useOverlayStore } from '@/stores/overlayStore';
import { useGameDataStore } from '@/stores/gameDataStore';
import { cn } from '@/lib/utils';

// Stat display formatting
const formatNumberValue = (value) => {
  if (value === undefined || value === null) return '--';
  const sign = value > 0 ? '+' : '';
  if (Math.abs(value) >= 1000000) return sign + (value / 1000000).toFixed(2) + 'M';
  if (Math.abs(value) >= 1000) return sign + (value / 1000).toFixed(2) + 'K';
  if (Number.isInteger(value)) return sign + value;
  return sign + value.toFixed(2);
};

const formatStatDelta = (value, unit) => {
  if (value === undefined || value === null) return '--';
  const sign = value > 0 ? '+' : '';
  if (unit === 'percent') {
    const rounded = Math.abs(value) >= 1000 ? value.toFixed(0) : value.toFixed(2);
    return `${sign}${rounded}%`;
  }
  return formatNumberValue(value);
};

// Animation variants for different styles
const slideVariants = {
  initial: { opacity: 0, x: -50, scale: 0.95 },
  animate: { opacity: 1, x: 0, scale: 1 },
  exit: { opacity: 0, x: 50, scale: 0.95 },
};

const fadeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const popVariants = {
  initial: { opacity: 0, scale: 0.5 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.5 },
};

const getVariants = (style) => {
  switch (style) {
    case 'fade': return fadeVariants;
    case 'pop': return popVariants;
    default: return slideVariants;
  }
};

// Staggered children animation for stat rows
const containerVariants = {
  animate: {
    transition: { staggerChildren: 0.05 },
  },
};

const itemVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};
void motion;

/**
 * Single stat change row with icon
 */
const StatChangeRow = memo(function StatChangeRow({ label, value, unit }) {
  const isPositive = value > 0;
  
  return (
    <motion.div 
      variants={itemVariants}
      className="flex items-center justify-between gap-2 text-xs"
    >
      <span className="text-white/70 truncate">{label}</span>
      <span className={cn(
        "font-medium tabular-nums alagard-numeric",
        isPositive ? "text-green-400" : "text-red-400"
      )}>
        {formatStatDelta(value, unit)}
      </span>
    </motion.div>
  );
});

const InlineItemIcon = memo(function InlineItemIcon({ item, getLocalItemByIngameId, className }) {
  if (!item?.id) return null;
  const localData = item.localData || getLocalItemByIngameId?.(item.id);
  const fallbackIcon = `/Game Icons/Items/${item.id}.png`;
  const iconPath = localData?.imageSrc || fallbackIcon;

  return (
    <img
      src={iconPath}
      alt={localData?.name || `Item ${item.id}`}
      className={cn("w-[1.4em] h-[1.4em] object-contain", className)}
      style={{ imageRendering: 'pixelated' }}
      onError={(e) => {
        if (e.currentTarget.src !== fallbackIcon) {
          e.currentTarget.src = fallbackIcon;
        }
      }}
    />
  );
});

/**
 * Individual event card component
 */
const EventCard = memo(function EventCard({ 
  event, 
  playerId, 
  onDismiss,
  displaySettings,
  getLocalItemByIngameId,
}) {
  const { 
    type,
    chestType,
    gainedItem,
    statChange,
    sourceIcon,
    shadyRarity,
    microIcon,
    burnedItem,
    replicatedItem,
    noSource,
  } = event;
  const variants = getVariants(displaySettings.animationStyle);
  
  // Auto-dismiss after duration
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(playerId, event.id);
    }, displaySettings.duration);
    
    return () => clearTimeout(timer);
  }, [playerId, event.id, onDismiss, displaySettings.duration]);
  
  // Determine icon based on event subtype
  let icon = event.icon || type.icon;
  if (event.type.id === 'chest' && chestType === 'free') {
    icon = '/Game Icons/Interface/free_chest.png';
  }
  
  const isChestLike = type.id === 'chest' || type.id === 'moai';
  const isShrineLike = type.id === 'shrine' || type.id === 'goldenShrine' || type.id === 'chaosTome';
  const isShady = type.id === 'shadyGuy';
  const isMicrowave = type.id === 'microwave';
  const isStatOnly = type.id === 'statChange';
  
  const uiScale = displaySettings.uiScale || 1;

  return (
    <motion.div
      layout
      variants={variants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="relative overflow-hidden"
      style={{
        minWidth: `${180 * uiScale}px`,
        fontSize: `${12 * uiScale}px`,
      }}
    >
      <motion.div 
        variants={containerVariants}
        initial="initial"
        animate="animate"
        className="flex flex-col gap-1"
      >
        {isStatOnly && statChange && (
          <StatChangeRow
            label={statChange.label || statChange.stat}
            value={statChange.displayDelta}
            unit={statChange.unit}
          />
        )}

        {isShrineLike && statChange && (
          <motion.div variants={itemVariants} className="flex items-center gap-2 text-xs">
            <span className="text-green-400 font-medium">+</span>
            <span className="text-white/70 truncate">{statChange.label || statChange.stat}</span>
            <span className={cn(
              "font-medium tabular-nums alagard-numeric",
              statChange.displayDelta > 0 ? "text-green-400" : "text-red-400"
            )}>
              {formatStatDelta(statChange.displayDelta, statChange.unit)}
            </span>
            {!noSource && (sourceIcon || icon) && (
              <img
                src={sourceIcon || icon}
                alt=""
                className="w-[1.1em] h-[1.1em] object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            )}
          </motion.div>
        )}

        {isChestLike && (
          <motion.div variants={itemVariants} className="flex items-center gap-2 text-xs">
            <span className="text-green-400 font-medium">+</span>
            {gainedItem && (
              <InlineItemIcon item={gainedItem} getLocalItemByIngameId={getLocalItemByIngameId} />
            )}
            {(sourceIcon || icon) && (
              <img
                src={sourceIcon || icon}
                alt=""
                className="w-[1.4em] h-[1.4em] object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            )}
          </motion.div>
        )}

        {isShady && gainedItem && (
          <motion.div variants={itemVariants} className="flex items-center gap-2 text-xs">
            <img
              src={sourceIcon || `/Game Icons/Interface/${shadyRarity || 'rare'}_shady.png`}
              alt=""
              className="w-[1.4em] h-[1.4em] object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
            <img
              src="/Game Icons/Interface/arrow.png"
              alt="→"
              className="w-[1.1em] h-[1.1em] object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
            <InlineItemIcon item={gainedItem} getLocalItemByIngameId={getLocalItemByIngameId} />
          </motion.div>
        )}

        {isMicrowave && (
          <motion.div variants={itemVariants} className="flex items-center gap-2 text-xs">
            {burnedItem && (
              <InlineItemIcon item={burnedItem} getLocalItemByIngameId={getLocalItemByIngameId} className="opacity-60" />
            )}
            <img
              src="/Game Icons/Interface/arrow.png"
              alt="→"
              className="w-[1.1em] h-[1.1em] object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
            {(microIcon || icon) && (
              <img
                src={microIcon || icon}
                alt=""
                className="w-[1.4em] h-[1.4em] object-contain"
                style={{ imageRendering: 'pixelated' }}
              />
            )}
            <img
              src="/Game Icons/Interface/arrow.png"
              alt="→"
              className="w-[1.1em] h-[1.1em] object-contain"
              style={{ imageRendering: 'pixelated' }}
            />
            {replicatedItem && (
              <InlineItemIcon item={replicatedItem} getLocalItemByIngameId={getLocalItemByIngameId} />
            )}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
});

/**
 * Main SmartInteractionsElement - displays animated interaction events
 */
export const SmartInteractionsElement = memo(function SmartInteractionsElement({ playerId, layout }) {
  const smartInteractionsEnabled = useOverlayStore((s) => s.smartInteractionsEnabled);
  const getLocalItemByIngameId = useGameDataStore((s) => s.getLocalItemByIngameId);
  const getLocalTomeByIngameId = useGameDataStore((s) => s.getLocalTomeByIngameId);
  const playerKey = useMemo(() => (
    playerId === 1 || playerId === '1' ? 'player1'
      : playerId === 2 || playerId === '2' ? 'player2'
      : playerId
  ), [playerId]);
  const playerState = useOverlayStore((s) => (
    playerKey === 'player1' ? s.player1State : s.player2State
  ));
  
  const activeEvents = useSmartInteractionsStore((s) => s.activeEvents[playerKey] || []);
  const eventQueue = useSmartInteractionsStore((s) => s.eventQueue[playerKey] || []);
  const eventHistory = useSmartInteractionsStore((s) => s.eventHistory[playerKey] || []);
  const pendingMicrowave = useSmartInteractionsStore((s) => s.pendingMicrowave[playerKey] || []);
  const pendingChest = useSmartInteractionsStore((s) => s.pendingChest[playerKey] || []);
  const pendingShady = useSmartInteractionsStore((s) => s.pendingShady[playerKey] || []);
  const pendingMoai = useSmartInteractionsStore((s) => s.pendingMoai[playerKey] || []);
  const pendingPhantomItems = useSmartInteractionsStore((s) => s.pendingPhantomItems[playerKey] || []);
  const displaySettings = useSmartInteractionsStore((s) => s.displaySettings);
  const processStateUpdate = useSmartInteractionsStore((s) => s.processStateUpdate);
  const popEvent = useSmartInteractionsStore((s) => s.popEvent);
  const dismissEvent = useSmartInteractionsStore((s) => s.dismissEvent);

  // Process state updates when player state changes
  useEffect(() => {
    if (!smartInteractionsEnabled) return;
    if (playerState) {
      processStateUpdate(playerKey, playerState, getLocalItemByIngameId, getLocalTomeByIngameId);
    }
  }, [playerKey, playerState, processStateUpdate, getLocalItemByIngameId, getLocalTomeByIngameId, smartInteractionsEnabled]);
  
  // Pop events from queue to active display
  useEffect(() => {
    if (!smartInteractionsEnabled) return;
    const activeCount = activeEvents.length;
    const maxVisible = Math.max(1, displaySettings.maxVisible || 3);
    
    if (eventQueue.length > 0 && activeCount < maxVisible) {
      popEvent(playerKey);
    }
  }, [eventQueue, activeEvents, displaySettings.maxVisible, playerKey, popEvent, smartInteractionsEnabled]);
  
  // Expose item history to console for debugging
  useEffect(() => {
    if (!smartInteractionsEnabled) return;
    const displayItems = [...activeEvents, ...eventQueue];
    window.itemHistory = displayItems.length > 0 ? displayItems : eventHistory;
    window.itemHistoryMeta = {
      activeCount: activeEvents.length,
      queuedCount: eventQueue.length,
      historyCount: eventHistory.length,
      pendingMicrowave: pendingMicrowave.length,
      pendingChest: pendingChest.length,
      pendingShady: pendingShady.length,
      pendingMoai: pendingMoai.length,
      pendingPhantomItems: pendingPhantomItems.length,
    };
  }, [
    activeEvents,
    eventQueue,
    eventHistory,
    pendingMicrowave,
    pendingChest,
    pendingShady,
    pendingMoai,
    pendingPhantomItems,
    smartInteractionsEnabled,
  ]);
  const handleDismiss = useCallback((pid, eventId) => {
    dismissEvent(pid, eventId);
  }, [dismissEvent]);
  
  // Layout styling
  const flowDirection = layout?.flowDirection || 'column';
  const alignContent = layout?.alignContent || 'flex-start';
  const gap = layout?.gap || 8;
  const uiScale = displaySettings.uiScale || 1;
  
  if (!smartInteractionsEnabled) {
    return (
      <div className="p-2 text-xs text-white/40 italic obs-hide-in-overlay obs-hide-shadow">
        Smart Interactions disabled
      </div>
    );
  }

  return (
    <div 
      className="p-2 overflow-visible"
      style={{
        display: 'flex',
        flexDirection: flowDirection,
        alignItems: alignContent,
        gap: `${gap * uiScale}px`,
      }}
    >
      <AnimatePresence mode="popLayout">
        {activeEvents.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            playerId={playerId}
            onDismiss={handleDismiss}
            displaySettings={displaySettings}
            getLocalItemByIngameId={getLocalItemByIngameId}
          />
        ))}
      </AnimatePresence>
      
      {/* Empty state for editor */}
      {activeEvents.length === 0 && (
        <div className="text-xs text-white/40 italic obs-hide-in-overlay p-2">
          Smart Interactions will appear here
        </div>
      )}
    </div>
  );
});

export default SmartInteractionsElement;
