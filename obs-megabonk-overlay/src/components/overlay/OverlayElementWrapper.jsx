import { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { useOverlayStore, ELEMENT_TYPES } from '@/stores/overlayStore';
import { cn } from '@/lib/utils';
import { X, Move, Group, Ungroup, Workflow, Shuffle, ListRestart, FlaskConical, Blend, TextAlignJustify, TextAlignStart, TextAlignCenter, TextAlignEnd, Layers, ArrowUp, ArrowDown, Scaling, AlertTriangle, Copy, Sparkles, Check } from 'lucide-react';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useI18n } from '@/lib/i18n';
import { createElementsPayload, encodeLayoutPayload } from '@/lib/layoutShare';
import { toast } from 'sonner';

const MATCH_END_FADE_CATEGORIES = new Set([
  'equipment',
  'items',
  'stats',
  'stats-individual',
  'combat',
  'combat-individual',
  'game-info',
  'bans',
]);

const ELEMENT_CATEGORY_MAP = new Map(
  ELEMENT_TYPES.map((entry) => [entry.type, entry.category])
);

export function OverlayElementWrapper({ 
  element, 
  children, 
  className 
}) {
  const targetRef = useRef(null);
  const contentWrapperRef = useRef(null);
  const contentInnerRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [isTitleDialogOpen, setIsTitleDialogOpen] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [isLabelDialogOpen, setIsLabelDialogOpen] = useState(false);
  const [labelDraft, setLabelDraft] = useState('');
  const autoDeselectTimeoutRef = useRef(null);
  const fillColorRafRef = useRef(null);
  const textColorRafRef = useRef(null);
  
  // Use selective subscriptions to minimize re-renders
  const selectedElementId = useOverlayStore(state => state.selectedElementId);
  const selectedElementIds = useOverlayStore(state => state.selectedElementIds);
  const groups = useOverlayStore(state => state.groups);
  const elements = useOverlayStore(state => state.elements);
  const allowUserSelect = useOverlayStore(state => state.allowUserSelect);
  const advancedSettingsEnabled = useOverlayStore(state => state.advancedSettingsEnabled);
  const showClippingWarnings = useOverlayStore(state => state.showClippingWarnings);
  const canvasZoom = useOverlayStore(state => state.canvasZoom);
  const matchEndState = useOverlayStore(state => state.matchEndState);
  const roomMeta = useOverlayStore(state => state.roomMeta);
  const queueState = useOverlayStore(state => state.queueState);
  const perPlayerEndBlurEnabled = useOverlayStore(state => state.perPlayerEndBlurEnabled);
  const transparentBackground = useOverlayStore(state => state.transparentBackground);

  const { t, tStat } = useI18n();

  const matchEndDefaults = useMemo(() => ({
    blurOnEnd: false,
    showEndTitle: false,
    blurAmount: 6,
    desaturate: 0.6,
    dim: 0.2,
  }), []);

  const resolveMatchEndConfig = useCallback((layout) => ({
    ...matchEndDefaults,
    ...(layout?.matchEnd || {}),
  }), [matchEndDefaults]);
  
  // Get actions (these don't cause re-renders)
  const {
    setSelectedElementId, 
    setSelectedElementIds,
    clearSelection,
    removeElement,
    removeElements,
    createGroup,
    addElementsToGroup,
    updateElement,
    deleteGroup,
    setElementClickedRecently,
    bringElementsToFront,
    sendElementsToBack,
    moveElementsForward,
    moveElementsBackward,
  } = useOverlayStore.getState();
  
  // Check if this element is selected (single or multi)
  const isSingleSelected = selectedElementId === element.id;
  const isMultiSelected = selectedElementIds.includes(element.id);
  const isSelected = isSingleSelected || isMultiSelected;

  // Compute group membership using memoized lookup
  const group = useMemo(() => {
    return groups.find(g => g.elementIds.includes(element.id));
  }, [groups, element.id]);
  const isInGroup = !!group;

  const outline = useMemo(() => {
    if (isMultiSelected) return { color: 'rgba(34, 211, 238, 0.9)', width: 2 };
    if (isSelected) return { color: 'rgba(59, 130, 246, 0.9)', width: 2 };
    if (isInGroup && !isSelected) return { color: 'rgba(168, 85, 247, 0.6)', width: 1 };
    if (isHovered && !isSelected) return { color: 'rgba(255, 255, 255, 0.4)', width: 1 };
    return null;
  }, [isHovered, isInGroup, isMultiSelected, isSelected]);

  const outlineScale = useMemo(() => 1 / (canvasZoom || 1), [canvasZoom]);
  const outlineSize = useMemo(() => 100 * (canvasZoom || 1), [canvasZoom]);

  const targetElementIds = useMemo(() => {
    if (selectedElementIds.length > 0) return selectedElementIds;
    if (selectedElementId) return [selectedElementId];
    return [element.id];
  }, [selectedElementIds, selectedElementId, element.id]);

  const targetElements = useMemo(() => (
    elements.filter(el => targetElementIds.includes(el.id))
  ), [elements, targetElementIds]);

  const typeTargetElements = useMemo(() => (
    targetElements.filter(el => el.type === element.type)
  ), [targetElements, element.type]);

  const hideTitleValue = useMemo(() => (
    targetElements.length > 0
      ? targetElements.every((el) => !!el.layout?.hideTitle)
      : !!element.layout?.hideTitle
  ), [targetElements, element.layout?.hideTitle]);

  const hideLabelValue = useMemo(() => (
    targetElements.length > 0
      ? targetElements.every((el) => !!el.layout?.hideLabel)
      : !!element.layout?.hideLabel
  ), [targetElements, element.layout?.hideLabel]);

  const matchEndConfig = useMemo(() => resolveMatchEndConfig(element.layout), [element.layout, resolveMatchEndConfig]);
  const blurOnEndValue = useMemo(() => (
    targetElements.length > 0
      ? targetElements.every((el) => resolveMatchEndConfig(el.layout).blurOnEnd)
      : matchEndConfig.blurOnEnd
  ), [targetElements, matchEndConfig.blurOnEnd, resolveMatchEndConfig]);
  const showEndTitleValue = useMemo(() => (
    targetElements.length > 0
      ? targetElements.every((el) => resolveMatchEndConfig(el.layout).showEndTitle)
      : matchEndConfig.showEndTitle
  ), [targetElements, matchEndConfig.showEndTitle, resolveMatchEndConfig]);
  
  // Clear timer on unmount
  useEffect(() => {
    const timeoutId = autoDeselectTimeoutRef.current;
    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (fillColorRafRef.current) {
        cancelAnimationFrame(fillColorRafRef.current);
        fillColorRafRef.current = null;
      }
      if (textColorRafRef.current) {
        cancelAnimationFrame(textColorRafRef.current);
        textColorRafRef.current = null;
      }
    };
  }, []);
  
  // Native contextmenu listener to set flag when right-clicking element content
  // Store the setter in a ref to keep the event listener stable
  const setElementClickedRecentlyRef = useRef(setElementClickedRecently);
  
  // Update the ref when the setter changes (though Zustand setters are stable)
  useEffect(() => {
    setElementClickedRecentlyRef.current = setElementClickedRecently;
  }, [setElementClickedRecently]);
  
  useEffect(() => {
    const element = targetRef.current;
    if (!element) return;
    
    const handleNativeContextMenu = () => {
      // Use the ref to get the current setter
      setElementClickedRecentlyRef.current(true);
    };
    
    // Use capture phase to ensure we catch it before Radix
    element.addEventListener('contextmenu', handleNativeContextMenu, { capture: true });
    
    return () => {
      element.removeEventListener('contextmenu', handleNativeContextMenu, { capture: true });
    };
  }, []); // Empty deps - function uses ref to access current setter

  const handleClick = useCallback((e) => {
    // Allow right-click and contextmenu to propagate for context menu
    if (e.button === 2 || e.type === 'contextmenu') {
      // Set flag AFTER checking type, then return to allow event propagation
      useOverlayStore.getState().setElementClickedRecently(true);
      return;
    }
    
    // Set flag for left clicks
    useOverlayStore.getState().setElementClickedRecently(true);
    
    // Selection is handled on mouse down to support drag start.
    // Keep click from bubbling to canvas deselect handler.
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation(); // Stop native event too
  }, []);
  
  // Handle mouse down for InstaDrag - manually handle drag before Moveable is ready
  const handleMouseDown = useCallback((e) => {
    // SET FLAG IMMEDIATELY to prevent canvas deselection (even for right-clicks)
    useOverlayStore.getState().setElementClickedRecently(true);
    
    // Allow right-click to propagate for context menu
    if (e.button === 2) return;
    
    // Only respond to left click
    if (e.button !== 0) return;
    
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation(); // Stop native event too

    const isToggleKey = e.ctrlKey || e.metaKey;
    if (isToggleKey) {
      // Toggle selection on ctrl/cmd click (select/deselect)
      useOverlayStore.getState().toggleSelection(element.id);
      return;
    }

    // If this element is already part of multi-selection, keep it
    // This allows dragging the group without changing selection
    if (selectedElementIds.length > 0 && isMultiSelected) {
      return;
    }

    // If element is in a group, select the whole group
    if (isInGroup && group) {
      const groupIds = group.elementIds;
      const alreadySelectedGroup =
        selectedElementIds.length === groupIds.length &&
        groupIds.every(id => selectedElementIds.includes(id));

      if (!alreadySelectedGroup) {
        setSelectedElementIds(groupIds);
      }
      return;
    }

    // If already selected, let Moveable handle the drag
    if (isSingleSelected) {
      return;
    }

    // InstaDrag: Manually handle drag until Moveable is ready
    
    // Get the ACTUAL current position from the DOM element
    const domElement = targetRef.current;
    if (!domElement) {
      return;
    }
    
    const startX = e.clientX;
    const startY = e.clientY;
    let dragDetected = false;
    const DRAG_THRESHOLD = 5;

    const handleMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;
      
      // Check if drag threshold exceeded
      if (!dragDetected && (Math.abs(deltaX) > DRAG_THRESHOLD || Math.abs(deltaY) > DRAG_THRESHOLD)) {
        dragDetected = true;
        
        // Select element
        const currentStore = useOverlayStore.getState();
        currentStore.clearSelection();
        currentStore.setInstaDragTimestamp(Date.now());
        currentStore.setSelectedElementId(element.id);
        
        // CRITICAL: Remove our listeners immediately
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        
        // Give Moveable one frame to mount
        requestAnimationFrame(() => {
          // Dispatch a synthetic mousedown on the element at current mouse position
          // This will trigger Moveable's drag handlers
          const syntheticDown = new MouseEvent('mousedown', {
            bubbles: true,
            cancelable: true,
            clientX: moveEvent.clientX,
            clientY: moveEvent.clientY,
            button: 0
          });
          
          domElement.dispatchEvent(syntheticDown);
        });
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      if (!dragDetected) {
        // No drag - just a click, select the element
        clearSelection();
        setSelectedElementId(element.id);
      }
    };

    // Add temporary listeners for manual drag handling
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [element.id, selectedElementIds, isMultiSelected, isSingleSelected, isInGroup, group, setSelectedElementIds, clearSelection, setSelectedElementId]);
  
  const handleRemove = useCallback((e) => {
    e.stopPropagation();
    if (targetElementIds.length > 1) {
      removeElements(targetElementIds);
    } else {
      removeElement(targetElementIds[0]);
    }
  }, [removeElements, removeElement, targetElementIds]);

  const handleExportElements = useCallback(async () => {
    const selectedIds = selectedElementIds.length > 0
      ? selectedElementIds
      : (isInGroup && group ? group.elementIds : [element.id]);
    const exportElements = elements.filter(el => selectedIds.includes(el.id));
    const exportGroups = groups.filter(g => g.elementIds.every(id => selectedIds.includes(id)));
    const payload = createElementsPayload({ elements: exportElements, groups: exportGroups });
    const encoded = encodeLayoutPayload(payload);

    try {
      await navigator.clipboard?.writeText(encoded);
      toast.success(t('copiedToClipboard', 'Copied to clipboard'));
    } catch {
      // Silently ignore clipboard failures
    }
  }, [selectedElementIds, isInGroup, group, element.id, elements, groups, t]);

  const applyToTargets = useCallback((updater, onlySameType = false) => {
    const targets = onlySameType ? typeTargetElements : targetElements;
    targets.forEach((target) => {
      const updates = updater(target);
      if (updates) {
        updateElement(target.id, updates);
      }
    });
  }, [typeTargetElements, targetElements, updateElement]);
  
  const selectedGroups = useMemo(() => {
    return groups.filter(g => g.elementIds.some(id => selectedElementIds.includes(id)));
  }, [groups, selectedElementIds]);

  const hasGroupedSelection = selectedGroups.length > 0;

  const selectedOrCurrentIds = useMemo(() => {
    if (selectedElementIds.length > 0) return selectedElementIds;
    if (selectedElementId) return [selectedElementId];
    return [element.id];
  }, [selectedElementIds, selectedElementId, element.id]);

  const ungroupedSelectedIds = useMemo(() => {
    return selectedOrCurrentIds.filter(id => !groups.some(g => g.elementIds.includes(id)));
  }, [selectedOrCurrentIds, groups]);

  const handleAddToGroup = useCallback((groupId) => {
    if (ungroupedSelectedIds.length === 0) return;
    addElementsToGroup(groupId, ungroupedSelectedIds);
  }, [addElementsToGroup, ungroupedSelectedIds]);

  // Group selected elements together
  const handleGroupSelected = useCallback(() => {
    if (selectedElementIds.length >= 2 && !hasGroupedSelection) {
      createGroup(selectedElementIds, `Group ${Date.now().toString(36).slice(-4)}`);
    }
  }, [selectedElementIds, createGroup, hasGroupedSelection]);
  
  // Ungroup this element from its group
  const handleUngroup = useCallback(() => {
    if (group) {
      deleteGroup(group.id);
    }
  }, [group, deleteGroup]);

  const handleAlign = useCallback((align) => {
    applyToTargets((target) => ({
      layout: { ...(target.layout || {}), align }
    }), true);
  }, [applyToTargets]);

  const handleJustify = useCallback((justify) => {
    applyToTargets((target) => ({
      layout: { ...(target.layout || {}), justify }
    }), true);
  }, [applyToTargets]);

  const handleFlow = useCallback((flow) => {
    applyToTargets((target) => ({
      layout: { ...(target.layout || {}), flow }
    }), true);
  }, [applyToTargets]);

  const handleItemsOrder = useCallback((itemsOrder) => {
    applyToTargets((target) => ({
      layout: { ...(target.layout || {}), itemsOrder }
    }), true);
  }, [applyToTargets]);

  const handleGapX = useCallback((gapX) => {
    applyToTargets((target) => ({
      layout: { ...(target.layout || {}), gapX }
    }), true);
  }, [applyToTargets]);

  const handleGapY = useCallback((gapY) => {
    applyToTargets((target) => ({
      layout: { ...(target.layout || {}), gapY }
    }), true);
  }, [applyToTargets]);

  const handleRarityLimit = useCallback((rarity, limit) => {
    applyToTargets((target) => {
      const currentLimits = target.layout?.rarityLimits || { 0: 0, 1: 0, 2: 0, 3: 0 };
      return {
        layout: {
          ...(target.layout || {}),
          rarityLimits: {
            ...currentLimits,
            [rarity]: limit,
          }
        }
      };
    }, true);
  }, [applyToTargets]);

  const handleRarityLimitsReset = useCallback(() => {
    applyToTargets((target) => ({
      layout: {
        ...(target.layout || {}),
        rarityLimits: { 0: 0, 1: 0, 2: 0, 3: 0 },
      }
    }), true);
  }, [applyToTargets]);

  const handleScaleChange = useCallback((scale) => {
    const nextScale = Math.min(2, Math.max(0.25, scale));
    applyToTargets(() => ({ scale: nextScale }));
  }, [applyToTargets]);

  const handleOpacityChange = useCallback((opacity) => {
    const nextOpacity = Math.min(1, Math.max(0, opacity));
    applyToTargets(() => ({ opacity: nextOpacity }));
  }, [applyToTargets]);

  const handleFillColorChange = useCallback((fillColor) => {
    if (fillColorRafRef.current) {
      cancelAnimationFrame(fillColorRafRef.current);
    }
    fillColorRafRef.current = requestAnimationFrame(() => {
      applyToTargets((target) => ({
        layout: {
          ...(target.layout || {}),
          fillColor,
        }
      }), true);
      fillColorRafRef.current = null;
    });
  }, [applyToTargets]);

  const handleTextColorChange = useCallback((textColor) => {
    if (textColorRafRef.current) {
      cancelAnimationFrame(textColorRafRef.current);
    }
    textColorRafRef.current = requestAnimationFrame(() => {
      applyToTargets((target) => ({
        layout: {
          ...(target.layout || {}),
          textColor,
        }
      }), true);
      textColorRafRef.current = null;
    });
  }, [applyToTargets]);

  const handleObsVisibilityChange = useCallback((obsVisibility, { clearPhases = true } = {}) => {
    applyToTargets((target) => ({
      layout: {
        ...(target.layout || {}),
        obsVisibility,
        ...(clearPhases ? { obsVisibilityPhases: undefined } : {}),
      }
    }), true);
  }, [applyToTargets]);

  const normalizePhaseList = useCallback((value) => {
    if (!Array.isArray(value)) return [];
    return Array.from(new Set(value.filter(Boolean))).sort();
  }, []);

  const handleObsVisibilityPhaseToggle = useCallback((phaseKey) => {
    applyToTargets((target) => {
      const current = normalizePhaseList(target.layout?.obsVisibilityPhases);
      const hasPhase = current.includes(phaseKey);
      const next = hasPhase ? current.filter((key) => key !== phaseKey) : [...current, phaseKey];
      return {
        layout: {
          ...(target.layout || {}),
          obsVisibilityPhases: next.length > 0 ? next : undefined,
          obsVisibility: 'always',
        }
      };
    }, true);
  }, [applyToTargets, normalizePhaseList]);

  const handleObsVisibilityPhasesClear = useCallback(() => {
    applyToTargets((target) => ({
      layout: {
        ...(target.layout || {}),
        obsVisibilityPhases: undefined,
      }
    }), true);
  }, [applyToTargets]);

  const handleOpenTitleDialog = useCallback(() => {
    const currentTitle = element.layout?.title || '';
    setTitleDraft(currentTitle);
    setIsTitleDialogOpen(true);
  }, [element.layout?.title]);

  const handleSaveTitle = useCallback(() => {
    const trimmed = titleDraft.trim();
    applyToTargets((target) => ({
      layout: {
        ...(target.layout || {}),
        title: trimmed || undefined,
      }
    }));
    setIsTitleDialogOpen(false);
  }, [applyToTargets, titleDraft]);

  const handleClearTitle = useCallback(() => {
    applyToTargets((target) => ({
      layout: {
        ...(target.layout || {}),
        title: undefined,
      }
    }));
  }, [applyToTargets]);

  const handleOpenLabelDialog = useCallback(() => {
    const currentLabel = element.layout?.labelOverride || '';
    setLabelDraft(currentLabel);
    setIsLabelDialogOpen(true);
  }, [element.layout?.labelOverride]);

  const handleSaveLabel = useCallback(() => {
    const trimmed = labelDraft.trim();
    applyToTargets((target) => ({
      layout: {
        ...(target.layout || {}),
        labelOverride: trimmed || undefined,
        labelOverrideUpdatedAt: Date.now(),
      }
    }));
    setIsLabelDialogOpen(false);
  }, [applyToTargets, labelDraft]);

  const handleClearLabel = useCallback(() => {
    applyToTargets((target) => ({
      layout: {
        ...(target.layout || {}),
        labelOverride: undefined,
        labelOverrideUpdatedAt: Date.now(),
      }
    }));
  }, [applyToTargets]);

  const handleToggleHideTitle = useCallback(() => {
    applyToTargets((target) => ({
      layout: {
        ...(target.layout || {}),
        hideTitle: !hideTitleValue,
      }
    }));
  }, [applyToTargets, hideTitleValue]);

  const handleToggleHideLabel = useCallback(() => {
    applyToTargets((target) => ({
      layout: {
        ...(target.layout || {}),
        hideLabel: !hideLabelValue,
      }
    }));
  }, [applyToTargets, hideLabelValue]);

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const handleMatchEndUpdate = useCallback((updates) => {
    applyToTargets((target) => {
      const current = resolveMatchEndConfig(target.layout);
      return {
        layout: {
          ...(target.layout || {}),
          matchEnd: {
            ...current,
            ...updates,
          },
        },
      };
    });
  }, [applyToTargets, resolveMatchEndConfig]);

  const normalizeStatusKey = useCallback((status) => {
    if (!status) return null;
    return String(status).replace(/[-\s]+/g, '_').toLowerCase();
  }, []);

  const resolveStatusLabel = useCallback((statusKey) => {
    if (!statusKey) return null;
    const statusMap = {
      victory: t('matchEndVictory', 'Victory'),
      defeat: t('matchEndDefeat', 'Defeat'),
      draw: t('matchEndDraw', 'Draw'),
      death: t('matchEndDeath', 'Death'),
      finished: t('matchEndFinished', 'Finished'),
      time_end: t('matchEndTimeEnd', 'Time Ended'),
      timeend: t('matchEndTimeEnd', 'Time Ended'),
      abandoned: t('matchEndAbandoned', 'Abandoned'),
      cancelled: t('matchCancelled', 'Match Cancelled'),
      match_cancelled: t('matchCancelled', 'Match Cancelled'),
      ended: t('matchEnded', 'Match Ended'),
    };
    return statusMap[statusKey] || null;
  }, [t]);

  const matchEndLabel = useMemo(() => {
    if (!matchEndState?.active) return null;
    const status = roomMeta?.status || matchEndState?.status || roomMeta?.phase;
    const playerStatus = element.playerId === 1
      ? roomMeta?.player1GameStatus
      : element.playerId === 2
        ? roomMeta?.player2GameStatus
        : roomMeta?.currentPlayerGameStatus;

    const playerKey = normalizeStatusKey(playerStatus);
    const statusKey = normalizeStatusKey(status);

    if (statusKey && ['cancelled', 'match_cancelled', 'draw'].includes(statusKey)) {
      return resolveStatusLabel(statusKey);
    }

    if (roomMeta?.winnerId && element.playerId) {
      const targetId = element.playerId === 1 ? roomMeta?.player1_id : roomMeta?.player2_id;
      if (targetId && roomMeta.winnerId === targetId) return resolveStatusLabel('victory');
      if (targetId) return resolveStatusLabel('defeat');
    }

    if (playerKey && ['victory', 'defeat', 'draw'].includes(playerKey)) {
      const playerLabel = resolveStatusLabel(playerKey);
      if (playerLabel) return playerLabel;
    }

    const statusLabel = resolveStatusLabel(statusKey);
    if (statusLabel) return statusLabel;

    return t('matchEnded', 'Match Ended');
  }, [matchEndState, roomMeta, element.playerId, normalizeStatusKey, resolveStatusLabel, t]);

  const playerRunStatus = useMemo(() => {
    if (!element.playerId) return null;
    if (element.playerId === 1) return roomMeta?.player1GameStatus;
    if (element.playerId === 2) return roomMeta?.player2GameStatus;
    return roomMeta?.currentPlayerGameStatus;
  }, [element.playerId, roomMeta]);

  const playerRunStatusKey = useMemo(() => normalizeStatusKey(playerRunStatus), [normalizeStatusKey, playerRunStatus]);

  const currentUserRunStatusKey = useMemo(
    () => normalizeStatusKey(roomMeta?.currentPlayerGameStatus),
    [normalizeStatusKey, roomMeta]
  );

  const runEndedStatusSet = useMemo(() => new Set([
    'victory',
    'defeat',
    'draw',
    'death',
    'finished',
    'time_end',
    'timeend',
    'abandoned',
    'cancelled',
    'match_cancelled',
    'ended',
  ]), []);

  // Check if player run ended but game is still active
  const playerRunEndedDuringGame = useMemo(() => {
    if (!element.playerId) return false;
    if (!playerRunStatusKey || !runEndedStatusSet.has(playerRunStatusKey)) return false;
    const gameStillActive = roomMeta?.phase === 'game' 
      && roomMeta?.status !== 'ended' 
      && roomMeta?.status !== 'cancelled';
    return gameStillActive;
  }, [element.playerId, playerRunStatusKey, runEndedStatusSet, roomMeta]);

  const playerRunEnded = !!playerRunStatusKey && runEndedStatusSet.has(playerRunStatusKey);
  const playerRunEndEnabled = !!element.playerId && playerRunEnded && !!perPlayerEndBlurEnabled?.[element.playerId];
  const currentUserRunActive = useMemo(() => {
    const inGame = roomMeta?.phase === 'game'
      && roomMeta?.status !== 'ended'
      && roomMeta?.status !== 'cancelled';
    if (!inGame) return false;
    if (!currentUserRunStatusKey) return true;
    return !runEndedStatusSet.has(currentUserRunStatusKey);
  }, [currentUserRunStatusKey, roomMeta, runEndedStatusSet]);
  const playerRunEndLabel = useMemo(() => {
    // If player died during game (not match end), show "Death"
    if (playerRunEndedDuringGame && playerRunStatusKey === 'death') {
      return resolveStatusLabel('death');
    }
    // Otherwise show the actual status label
    return resolveStatusLabel(playerRunStatusKey);
  }, [playerRunStatusKey, playerRunEndedDuringGame, resolveStatusLabel]);

  const checkOverflow = useCallback(() => {
    const wrapper = contentWrapperRef.current;
    const inner = contentInnerRef.current;
    if (!wrapper) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    const innerRect = inner ? inner.getBoundingClientRect() : null;
    const scrollOverflowX = wrapper.scrollWidth > wrapper.clientWidth + 1;
    const scrollOverflowY = wrapper.scrollHeight > wrapper.clientHeight + 1;
    const innerScrollOverflowX = inner ? inner.scrollWidth > wrapper.clientWidth + 1 : false;
    const innerScrollOverflowY = inner ? inner.scrollHeight > wrapper.clientHeight + 1 : false;
    const rectOverflowX = innerRect ? innerRect.width > wrapperRect.width + 1 : false;
    const rectOverflowY = innerRect ? innerRect.height > wrapperRect.height + 1 : false;
    setHasOverflow(
      scrollOverflowX || scrollOverflowY ||
      innerScrollOverflowX || innerScrollOverflowY ||
      rectOverflowX || rectOverflowY
    );
  }, []);

  const isItemElement = element.type === 'item-group' || element.type.startsWith('rarity-group');
  const isWeaponElement = element.type === 'weapons';
  const isTomeElement = element.type === 'tomes';
  const isBansElement = element.type.startsWith('bans-');
  const isShapeElement = element.type === 'shape-rect';
  const allowOverflow = isItemElement || isBansElement;
  const showExperimental = advancedSettingsEnabled && (isItemElement || isWeaponElement || isTomeElement || isBansElement);
  const showRarityLimits = isItemElement || isBansElement;
  const gapXValue = element.layout?.gapX ?? 4;
  const gapYValue = element.layout?.gapY ?? 4;
  const fillColorValue = element.layout?.fillColor || '#000000';
  const textColorValue = element.layout?.textColor || '#67e8f9';
  const elementObsVisibility = element.layout?.obsVisibility || 'always';
  const obsVisibilityValue = useMemo(() => {
    const resolve = (target) => target.layout?.obsVisibility || 'always';
    if (targetElements.length > 0) {
      const first = resolve(targetElements[0]);
      const allSame = targetElements.every((el) => resolve(el) === first);
      return allSame ? first : 'mixed';
    }
    return element.layout?.obsVisibility || 'always';
  }, [element.layout?.obsVisibility, targetElements]);
  const obsVisibilityPhasesValue = useMemo(() => {
    const resolve = (target) => normalizePhaseList(target.layout?.obsVisibilityPhases);
    const targets = targetElements.length > 0 ? targetElements : [element];
    if (targets.length > 1) {
      const first = resolve(targets[0]);
      const allSame = targets.every((el) => {
        const next = resolve(el);
        return next.length === first.length && next.every((entry, idx) => entry === first[idx]);
      });
      return allSame ? first : 'mixed';
    }
    return resolve(element);
  }, [element, targetElements, normalizePhaseList]);
  const hasAnyObsPhaseSelection = useMemo(() => {
    if (obsVisibilityPhasesValue === 'mixed') return true;
    return Array.isArray(obsVisibilityPhasesValue) && obsVisibilityPhasesValue.length > 0;
  }, [obsVisibilityPhasesValue]);
  const obsPhaseOptions = useMemo(() => ([
    { key: 'idle', label: t('obsPhaseIdle', 'Out of Match') },
    { key: 'searching', label: t('obsPhaseSearching', 'Searching') },
    { key: 'acceptance', label: t('obsPhaseAcceptance', 'Match Accept') },
    { key: 'ban_selection', label: t('obsPhaseBanSelection', 'Ban Phase') },
    { key: 'game', label: t('obsPhaseGame', 'Game') },
    { key: 'ended', label: t('obsPhaseEnded', 'Match End') },
  ]), [t]);
  const resolvePhaseSelectionState = useCallback((phaseKey) => {
    const targets = targetElements.length > 0 ? targetElements : [element];
    let count = 0;
    targets.forEach((target) => {
      const list = normalizePhaseList(target.layout?.obsVisibilityPhases);
      if (list.includes(phaseKey)) count += 1;
    });
    if (count === 0) return 'none';
    if (count === targets.length) return 'all';
    return 'mixed';
  }, [element, targetElements, normalizePhaseList]);

  const currentObsPhase = useMemo(() => {
    if (roomMeta?.phase === 'game') return 'game';
    if (roomMeta?.phase === 'ban_selection') return 'ban_selection';
    if (roomMeta?.phase === 'ended'
      || roomMeta?.status === 'ended'
      || roomMeta?.status === 'cancelled') {
      return 'ended';
    }
    if (queueState?.inQueue || queueState?.status === 'searching') return 'searching';
    if (['match_found', 'accept_pending', 'match_confirmed'].includes(queueState?.status)) {
      return 'acceptance';
    }
    return 'idle';
  }, [roomMeta, queueState]);

  const hasObsVisibilityPhases = Array.isArray(element.layout?.obsVisibilityPhases)
    && element.layout.obsVisibilityPhases.length > 0;
  const isVisibleInObs = useMemo(() => {
    if (elementObsVisibility === 'off') return false;
    if (hasObsVisibilityPhases) {
      return element.layout.obsVisibilityPhases.includes(currentObsPhase);
    }
    if (elementObsVisibility === 'run') return currentUserRunActive;
    return true;
  }, [elementObsVisibility, hasObsVisibilityPhases, element.layout?.obsVisibilityPhases, currentObsPhase, currentUserRunActive]);

  const scaleValue = element.scale ?? 1;
  const opacityValue = element.opacity ?? 1;
  const matchEndActive = !!matchEndState?.active
    || roomMeta?.phase === 'ended'
    || roomMeta?.status === 'ended'
    || roomMeta?.status === 'cancelled';
  const matchEndFading = matchEndActive && !!matchEndState?.fadeActive;
  const elementCategory = ELEMENT_CATEGORY_MAP.get(element.type);
  const isSeasonElement = elementCategory === 'season';
  const shouldFadeOnMatchEnd = matchEndFading && MATCH_END_FADE_CATEGORIES.has(elementCategory);
  const supportsHideLabel = elementCategory === 'stats-individual' || elementCategory === 'combat-individual';
  const supportsLabelOverride = elementCategory === 'stats-individual';
  const supportsLabelMenu = supportsHideLabel || supportsLabelOverride;
  const supportsStageEventPlacement = element.type === 'stage-state';
  const shouldApplyEndEffects = !!matchEndConfig.blurOnEnd && (matchEndActive || playerRunEndEnabled);
  const matchEndFilter = shouldApplyEndEffects
    ? `blur(${clamp(matchEndConfig.blurAmount, 0, 16)}px) saturate(${clamp(1 - matchEndConfig.desaturate, 0, 1)}) brightness(${clamp(1 - matchEndConfig.dim, 0, 1)})`
    : undefined;
  // Only fade out completely when match ends, not when player dies during game
  const obsVisibilityOpacity = transparentBackground && !isVisibleInObs ? 0 : 1;
  const effectiveOpacity = opacityValue
    * (shouldFadeOnMatchEnd && !playerRunEndedDuringGame ? 0 : 1)
    * obsVisibilityOpacity;


  const fieldOptionsByType = useMemo(() => ({
    'stats-health': [
      { key: 'maxHealth', label: tStat('MaxHealth', 'Max HP') },
      { key: 'regen', label: tStat('HealthRegen', 'Regen') },
      { key: 'shield', label: tStat('Shield', 'Shield') },
      { key: 'overheal', label: tStat('Overheal', 'Overheal') },
      { key: 'healMulti', label: tStat('HealingMultiplier', 'Heal Multi') },
      { key: 'lifesteal', label: tStat('Lifesteal', 'Lifesteal') },
    ],
    'stats-damage': [
      { key: 'damage', label: tStat('DamageMultiplier', 'Damage') },
      { key: 'attackSpeed', label: tStat('AttackSpeed', 'Attack Speed') },
      { key: 'critChance', label: tStat('CritChance', 'Crit Chance') },
      { key: 'critDamage', label: tStat('CritDamage', 'Crit Damage') },
      { key: 'projectiles', label: tStat('Projectiles', 'Projectiles') },
      { key: 'bounces', label: tStat('ProjectileBounces', 'Bounces') },
      { key: 'size', label: tStat('SizeMultiplier', 'Size') },
    ],
    'stats-defense': [
      { key: 'armor', label: tStat('Armor', 'Armor') },
      { key: 'evasion', label: tStat('Evasion', 'Evasion') },
      { key: 'thorns', label: tStat('Thorns', 'Thorns') },
      { key: 'damageReduction', label: tStat('DamageReductionMultiplier', 'Dmg Reduction') },
      { key: 'fallDamageReduction', label: tStat('FallDamageReduction', 'Fall Dmg Red') },
    ],
    'stats-utility': [
      { key: 'moveSpeed', label: tStat('MoveSpeedMultiplier', 'Move Speed') },
      { key: 'jumpHeight', label: tStat('JumpHeight', 'Jump Height') },
      { key: 'extraJumps', label: tStat('ExtraJumps', 'Extra Jumps') },
      { key: 'pickupRange', label: tStat('PickupRange', 'Pickup Range') },
      { key: 'duration', label: tStat('DurationMultiplier', 'Duration') },
      { key: 'projSpeed', label: tStat('ProjectileSpeedMultiplier', 'Proj Speed') },
    ],
    'stats-economy': [
      { key: 'goldMulti', label: tStat('GoldIncreaseMultiplier', 'Gold Multi') },
      { key: 'xpMulti', label: tStat('XpIncreaseMultiplier', 'XP Multi') },
      { key: 'silverMulti', label: tStat('SilverIncreaseMultiplier', 'Silver Multi') },
      { key: 'luck', label: tStat('Luck', 'Luck') },
      { key: 'chestMulti', label: tStat('ChestIncreaseMultiplier', 'Chest Multi') },
      { key: 'shopDiscount', label: tStat('ShopPriceReduction', 'Shop Discount') },
    ],
    'stats-enemy': [
      { key: 'difficulty', label: tStat('Difficulty', 'Difficulty') },
      { key: 'eliteSpawn', label: tStat('EliteSpawnIncrease', 'Elite Spawn') },
      { key: 'amount', label: tStat('EnemyAmountMultiplier', 'Amount') },
      { key: 'size', label: tStat('EnemySizeMultiplier', 'Size') },
      { key: 'speed', label: tStat('EnemySpeedMultiplier', 'Speed') },
      { key: 'hp', label: tStat('EnemyHpMultiplier', 'HP') },
      { key: 'damage', label: tStat('EnemyDamageMultiplier', 'Damage') },
    ],
    'combat-stats': [
      { key: 'kills', label: t('kills', 'Kills') },
      { key: 'gold', label: t('gold', 'Gold') },
      { key: 'damageDealt', label: t('damageDealt', 'Damage Dealt') },
      { key: 'damageTaken', label: t('damageTaken', 'Damage Taken') },
    ],
    'shrine-stats': [
      { key: 'balance', label: t('balance', 'Balance') },
      { key: 'greed', label: t('greed', 'Greed') },
      { key: 'challenge', label: t('challenge', 'Challenge') },
      { key: 'cursed', label: t('cursed', 'Cursed') },
      { key: 'magnet', label: t('magnet', 'Magnet') },
      { key: 'moai', label: t('moai', 'Moai') },
      { key: 'charge', label: t('charge', 'Charge') },
      { key: 'goldenCharge', label: t('goldenCharge', 'Golden Charge') },
    ],
    'game-stats': [
      { key: 'goldEarned', label: t('goldEarned', 'Gold Earned') },
      { key: 'goldSpent', label: t('goldSpent', 'Gold Spent') },
      { key: 'xpGained', label: t('xpGained', 'XP Gained') },
      { key: 'eliteKills', label: t('eliteKills', 'Elite Kills') },
      { key: 'bossKills', label: t('bossKills', 'Boss Kills') },
      { key: 'miniboss', label: t('miniboss', 'Miniboss Kills') },
      { key: 'skeleton', label: t('skeleton', 'Skeleton Kills') },
      { key: 'goblin', label: t('goblin', 'Goblin Kills') },
      { key: 'fire', label: t('fire', 'Fire Kills') },
      { key: 'lightning', label: t('lightning', 'Lightning Kills') },
      { key: 'crits', label: t('crits', 'Crits') },
      { key: 'evades', label: t('evades', 'Evades') },
      { key: 'projectiles', label: t('projectiles', 'Projectiles Fired') },
      { key: 'items', label: t('itemsPickedUp', 'Items Picked Up') },
      { key: 'chestsOpened', label: t('chestsOpened', 'Chests Opened') },
      { key: 'chestsBought', label: t('chestsBought', 'Chests Bought') },
      { key: 'pots', label: t('potsBroken', 'Pots Broken') },
      { key: 'powerups', label: t('powerupsUsed', 'Powerups Used') },
    ],
  }), [t, tStat]);

  const fieldOptions = fieldOptionsByType[element.type] || [];

  const contentScale = useMemo(() => {
    if (!element.layout?.lockScale || !element.layout?.baseSize) return 1;
    const baseWidth = element.layout.baseSize.width || element.size.width;
    const baseHeight = element.layout.baseSize.height || element.size.height;
    if (!baseWidth || !baseHeight) return 1;
    return Math.min(element.size.width / baseWidth, element.size.height / baseHeight);
  }, [element.layout, element.size.width, element.size.height]);

  useEffect(() => {
    const wrapper = contentWrapperRef.current;
    const inner = contentInnerRef.current;
    if (!wrapper) return undefined;

    const observer = new ResizeObserver(() => {
      checkOverflow();
    });

    observer.observe(wrapper);
    if (inner) observer.observe(inner);

    checkOverflow();

    return () => observer.disconnect();
  }, [checkOverflow]);

  useEffect(() => {
    const inner = contentInnerRef.current;
    if (!inner) return undefined;

    const mutationObserver = new MutationObserver(() => {
      checkOverflow();
    });

    mutationObserver.observe(inner, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true,
    });

    return () => mutationObserver.disconnect();
  }, [checkOverflow]);

  // Can group: have multiple elements selected and none are already grouped
  const canGroup = selectedElementIds.length >= 2 && !hasGroupedSelection;
  // Can ungroup: element is in a group
  const canUngroup = isInGroup;
  
  return (
    <>
      <Dialog open={isTitleDialogOpen} onOpenChange={setIsTitleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editTitleDialogTitle', 'Edit Title')}</DialogTitle>
            <DialogDescription>
              {t('editTitleDialogHint', 'Enter a title (leave blank to clear)')}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSaveTitle();
            }}
            className="space-y-4"
          >
            <Input
              value={titleDraft}
              onChange={(event) => setTitleDraft(event.target.value)}
              placeholder={t('editTitlePlaceholder', 'Overlay title')}
              autoFocus
            />
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsTitleDialogOpen(false)}
              >
                {t('dialogCancel', 'Cancel')}
              </Button>
              <Button type="submit">{t('dialogSave', 'Save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isLabelDialogOpen} onOpenChange={setIsLabelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('editLabelDialogTitle', 'Edit Label')}</DialogTitle>
            <DialogDescription>
              {t('editLabelDialogHint', 'Enter a label override (leave blank to clear)')}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleSaveLabel();
            }}
            className="space-y-4"
          >
            <Input
              value={labelDraft}
              onChange={(event) => setLabelDraft(event.target.value)}
              placeholder={t('editLabelPlaceholder', 'Stat label')}
              autoFocus
            />
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsLabelDialogOpen(false)}
              >
                {t('dialogCancel', 'Cancel')}
              </Button>
              <Button type="submit">{t('dialogSave', 'Save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          ref={targetRef}
          data-element-id={element.id}
          data-is-element="true"
          className={cn(
            "absolute cursor-move",
            className
          )}
          style={{
            left: element.position.x,
            top: element.position.y,
            width: element.size.width,
            height: element.size.height,
            transform: `scale(${element.scale})`,
            transformOrigin: 'top left',
            zIndex: element.zIndex ?? 0,
            overflow: 'visible',
            // GPU acceleration for smoother animations
            willChange: (isSelected || isHovered) ? 'left, top, width, height, transform' : 'auto',
          }}
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {outline && (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                border: `${outline.width}px solid ${outline.color}`,
                boxSizing: 'border-box',
                transform: `scale(${outlineScale})`,
                transformOrigin: 'top left',
                width: `${outlineSize}%`,
                height: `${outlineSize}%`,
              }}
            />
          )}
          {/* Element content - non-selectable, no scrollbars */}
          <div 
            ref={contentWrapperRef}
            className={cn("w-full h-full match-end-fade")}
            style={{ 
              userSelect: allowUserSelect ? 'text' : 'none',
              WebkitUserSelect: allowUserSelect ? 'text' : 'none',
              MozUserSelect: allowUserSelect ? 'text' : 'none',
              msUserSelect: allowUserSelect ? 'text' : 'none',
              opacity: effectiveOpacity,
              overflow: allowOverflow ? 'visible' : 'hidden',
              filter: matchEndFilter,
            }}
          >
            <div
              ref={contentInnerRef}
              style={{
                transform: contentScale !== 1 ? `scale(${contentScale})` : undefined,
                transformOrigin: 'top left',
                width: contentScale !== 1 ? `${100 / contentScale}%` : '100%',
                height: contentScale !== 1 ? `${100 / contentScale}%` : '100%'
              }}
            >
              {children}
            </div>
          </div>
          {((matchEndActive && matchEndConfig.showEndTitle && matchEndLabel)
            || (playerRunEndEnabled && matchEndConfig.showEndTitle && playerRunEndLabel)) && (
            <div className="match-end-overlay">
              <div className="match-end-overlay__label">{matchEndActive && matchEndLabel ? matchEndLabel : playerRunEndLabel}</div>
            </div>
          )}

          {showClippingWarnings && hasOverflow && (
            <div
              className="absolute top-1 right-1 z-10 rounded bg-amber-500/90 p-0.5 text-black shadow obs-hide-in-overlay"
              title={t('contentClipped', 'Some content may be clipped')}
            >
              <AlertTriangle size={16} />
            </div>
          )}
          
          {/* Controls overlay */}
          {(isSelected || isHovered) && (
            <div className="absolute -top-6 left-0 flex gap-1 z-20 pointer-events-none">
              <button
                onClick={handleRemove}
                className="pointer-events-auto p-1 bg-red-500/80 hover:bg-red-500 rounded text-white transition-colors"
                title={t('removeElement', 'Remove Element')}
              >
                <X size={12} />
              </button>
              {element.playerId != null ? (
                <div className="px-2 py-0.5 bg-black/60 rounded text-xs text-white/80 flex items-center gap-1">
                  <Move size={10} />
                  <span>P{element.playerId}</span>
                </div>
              ) : (
                <div className="px-2 py-0.5 bg-black/60 rounded text-xs text-white/80 flex items-center gap-1">
                  <Move size={10} />
                  <span>{t('shared', 'Shared')}</span>
                </div>
              )}
              {isInGroup && (
                <div className="px-2 py-0.5 bg-purple-600/60 rounded text-xs text-white/80 flex items-center gap-1" title={`Group: ${group.name}`}>
                  <Group size={10} />
                </div>
              )}
              {selectedElementIds.length > 1 && isMultiSelected && (
                <div className="px-2 py-0.5 bg-cyan-600/60 rounded text-xs text-white/80">
                  {selectedElementIds.length} {t('selected', 'selected')}
                </div>
              )}
            </div>
          )}
        </div>
      </ContextMenuTrigger>
      
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={handleExportElements}>
          <Copy size={14} />
          <span>{t('exportElements', 'Export elements')}</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleRemove} className="text-red-400">
          <X size={14} />
          <span>{t('removeElement', 'Remove Element')}</span>
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <TextAlignJustify size={14} />
            <span>{t('alignContent', 'Align Content')}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem onClick={() => handleAlign('left')}>
              <TextAlignStart size={14} />
              <span>{t('left', 'Left')}</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAlign('center')}>
              <TextAlignCenter size={14} />
              <span>{t('center', 'Center')}</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleAlign('right')}>
              <TextAlignEnd size={14} />
              <span>{t('right', 'Right')}</span>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <TextAlignJustify size={14} />
            <span>{t('justifyContent', 'Justify Content')}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-52">
            <ContextMenuItem onClick={() => handleJustify('start')}>
              <TextAlignStart size={14} />
              <span>{t('start', 'Start')}</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleJustify('center')}>
              <TextAlignCenter size={14} />
              <span>{t('center', 'Center')}</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleJustify('end')}>
              <TextAlignEnd size={14} />
              <span>{t('end', 'End')}</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleJustify('space-between')}>
              <span>{t('spaceBetween', 'Space Between')}</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleJustify('space-around')}>
              <span>{t('spaceAround', 'Space Around')}</span>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <Workflow size={14} />
            <span>{t('flowDirection', 'Flow Direction')}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem onClick={() => handleFlow('row')}>{t('row', 'Row')}</ContextMenuItem>
            <ContextMenuItem onClick={() => handleFlow('column')}>{t('column', 'Column')}</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        {isItemElement && (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2">
              <Shuffle size={14} />
              <span>{t('itemOrder', 'Item Order')}</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              <ContextMenuItem onClick={() => handleItemsOrder('rarity')}>{t('byRarity', 'By Rarity')}</ContextMenuItem>
              <ContextMenuItem onClick={() => handleItemsOrder('acquired')}>{t('byAcquisition', 'By Acquisition')}</ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        {fieldOptions.length > 0 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2">
              <ListRestart size={14} />
              <span>{t('fields', 'Fields')}</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              {fieldOptions.map((option) => (
                <ContextMenuItem
                  key={option.key}
                  onClick={() => {
                    applyToTargets((target) => ({
                      layout: {
                        ...(target.layout || {}),
                        visibleFields: {
                          ...(target.layout?.visibleFields || {}),
                          [option.key]: target.layout?.visibleFields?.[option.key] === false ? true : false,
                        }
                      }
                    }), true);
                  }}
                >
                  <span>{option.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">
                    {element.layout?.visibleFields?.[option.key] === false ? t('off', 'Off') : t('on', 'On')}
                  </span>
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        {showRarityLimits && (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2">
              <ListRestart size={14} />
              <span>{t('rarityLimits', 'Rarity Limits')}</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              <ContextMenuItem onClick={handleRarityLimitsReset}>
                {t('autoAll', 'Auto (All)')}
              </ContextMenuItem>
              {[
                { label: t('common', 'Common'), key: 0 },
                { label: t('rare', 'Rare'), key: 1 },
                { label: t('epic', 'Epic'), key: 2 },
                { label: t('legendary', 'Legendary'), key: 3 },
              ].map((entry) => (
                <ContextMenuSub key={entry.key}>
                  <ContextMenuSubTrigger className="gap-2">
                    <span>{entry.label}</span>
                  </ContextMenuSubTrigger>
                  <ContextMenuSubContent className="w-40">
                    <ContextMenuItem onClick={() => handleRarityLimit(entry.key, 0)}>{t('auto', 'Auto')}</ContextMenuItem>
                    {[1, 2, 3, 4, 5].map((count) => (
                      <ContextMenuItem key={count} onClick={() => handleRarityLimit(entry.key, count)}>
                        {count}
                      </ContextMenuItem>
                    ))}
                  </ContextMenuSubContent>
                </ContextMenuSub>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        {showExperimental && (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2">
              <FlaskConical size={14} />
              <span>{t('experimental', 'Experimental')}</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-56">
              <ContextMenuItem onSelect={(e) => e.preventDefault()} className="flex flex-col items-start gap-2">
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs">{t('horizontalGap', 'Horizontal Gap')}</span>
                  <span className="text-xs text-muted-foreground">{gapXValue}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={gapXValue}
                  onChange={(e) => handleGapX(parseInt(e.target.value, 10))}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onPointerMove={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full"
                />
              </ContextMenuItem>
              <ContextMenuItem onSelect={(e) => e.preventDefault()} className="flex flex-col items-start gap-2">
                <div className="flex w-full items-center justify-between">
                  <span className="text-xs">{t('verticalGap', 'Vertical Gap')}</span>
                  <span className="text-xs text-muted-foreground">{gapYValue}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={gapYValue}
                  onChange={(e) => handleGapY(parseInt(e.target.value, 10))}
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onPointerMove={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full"
                />
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        {isShapeElement && (
          <ContextMenuItem onSelect={(e) => e.preventDefault()} className="flex flex-col items-start gap-2">
            <div className="flex w-full items-center justify-between">
              <span>{t('fillColor', 'Fill Color')}</span>
              <span className="text-xs text-muted-foreground">{fillColorValue.toUpperCase()}</span>
            </div>
            <input
              type="color"
              value={fillColorValue}
              onInput={(e) => handleFillColorChange(e.target.value)}
              onChange={(e) => handleFillColorChange(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onPointerMove={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-8 bg-transparent"
            />
          </ContextMenuItem>
        )}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <span>{t('obsVisibility', 'OBS Visibility')}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            <ContextMenuItem onClick={() => handleObsVisibilityChange('off')}>
              <span>{t('obsVisibilityOff', 'Off in OBS')}</span>
              {obsVisibilityValue === 'off' && <Check size={12} className="ml-auto text-muted-foreground" />}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleObsVisibilityChange('always')}>
              <span>{t('obsVisibilityAlways', 'Always')}</span>
              {obsVisibilityValue === 'always' && <Check size={12} className="ml-auto text-muted-foreground" />}
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleObsVisibilityChange('run')}>
              <span>{t('obsVisibilityRun', 'During your run')}</span>
              {obsVisibilityValue === 'run' && <Check size={12} className="ml-auto text-muted-foreground" />}
            </ContextMenuItem>
            <ContextMenuSeparator />
            {obsPhaseOptions.map((phase) => {
              const selectionState = resolvePhaseSelectionState(phase.key);
              return (
                <ContextMenuItem
                  key={phase.key}
                  onSelect={(e) => e.preventDefault()}
                  onClick={() => handleObsVisibilityPhaseToggle(phase.key)}
                >
                  <span>{phase.label}</span>
                  {selectionState === 'all' && (
                    <Check size={12} className="ml-auto text-muted-foreground" />
                  )}
                  {selectionState === 'mixed' && (
                    <Check size={12} className="ml-auto text-muted-foreground opacity-40" />
                  )}
                </ContextMenuItem>
              );
            })}
            {hasAnyObsPhaseSelection && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={handleObsVisibilityPhasesClear}>
                  <span>{t('obsVisibilityClearPhases', 'Clear phase selection')}</span>
                </ContextMenuItem>
              </>
            )}
            {(obsVisibilityValue === 'mixed' || obsVisibilityPhasesValue === 'mixed') && (
              <div className="px-2 py-1 text-[10px] text-muted-foreground">
                {t('mixedSelection', 'Mixed selection')}
              </div>
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
        {isSeasonElement && (
          <ContextMenuItem onSelect={(e) => e.preventDefault()} className="flex flex-col items-start gap-2">
            <div className="flex w-full items-center justify-between">
              <span>{t('textColor', 'Text Color')}</span>
              <span className="text-xs text-muted-foreground">{textColorValue.toUpperCase()}</span>
            </div>
            <input
              type="color"
              value={textColorValue}
              onInput={(e) => handleTextColorChange(e.target.value)}
              onChange={(e) => handleTextColorChange(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onPointerMove={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              className="w-full h-8 bg-transparent"
            />
          </ContextMenuItem>
        )}
        <ContextMenuItem onSelect={(e) => e.preventDefault()} className="flex flex-col items-start gap-2">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <Scaling size={14} />
              <span>{t('scale', 'Scale')}</span>
            </div>
            <span className="text-xs text-muted-foreground">{scaleValue.toFixed(2)}x</span>
          </div>
          <input
            type="range"
            min={0.25}
            max={2}
            step={0.05}
            value={scaleValue}
            onChange={(e) => handleScaleChange(parseFloat(e.target.value))}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="w-full"
          />
        </ContextMenuItem>
        <ContextMenuItem onSelect={(e) => e.preventDefault()} className="flex flex-col items-start gap-2">
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <Blend size={14} />
              <span>{t('opacity', 'Opacity')}</span>
            </div>
            <span className="text-xs text-muted-foreground">{Math.round(opacityValue * 100)}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={opacityValue}
            onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            className="w-full"
          />
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <Sparkles size={14} />
            <span>{t('matchEndEffects', 'Match End Effects')}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-56">
            <ContextMenuItem onClick={() => handleMatchEndUpdate({ blurOnEnd: !blurOnEndValue })}>
              <span>{t('blurOnEnd', 'Blur on end')}</span>
              <span className="ml-auto text-xs text-muted-foreground">{blurOnEndValue ? t('on', 'On') : t('off', 'Off')}</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => handleMatchEndUpdate({ showEndTitle: !showEndTitleValue })}>
              <span>{t('showEndTitle', 'Show end title')}</span>
              <span className="ml-auto text-xs text-muted-foreground">{showEndTitleValue ? t('on', 'On') : t('off', 'Off')}</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onSelect={(e) => e.preventDefault()} className="flex flex-col items-start gap-2">
              <div className="flex w-full items-center justify-between">
                <span className="text-xs">{t('matchEndBlurAmount', 'Blur Amount')}</span>
                <span className="text-xs text-muted-foreground">{clamp(matchEndConfig.blurAmount, 0, 16).toFixed(1)}px</span>
              </div>
              <input
                type="range"
                min={0}
                max={16}
                step={0.5}
                value={clamp(matchEndConfig.blurAmount, 0, 16)}
                onChange={(e) => handleMatchEndUpdate({ blurAmount: parseFloat(e.target.value) })}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="w-full"
              />
            </ContextMenuItem>
            <ContextMenuItem onSelect={(e) => e.preventDefault()} className="flex flex-col items-start gap-2">
              <div className="flex w-full items-center justify-between">
                <span className="text-xs">{t('matchEndDesaturate', 'Desaturate')}</span>
                <span className="text-xs text-muted-foreground">{Math.round(clamp(matchEndConfig.desaturate, 0, 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={clamp(matchEndConfig.desaturate, 0, 1)}
                onChange={(e) => handleMatchEndUpdate({ desaturate: parseFloat(e.target.value) })}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="w-full"
              />
            </ContextMenuItem>
            <ContextMenuItem onSelect={(e) => e.preventDefault()} className="flex flex-col items-start gap-2">
              <div className="flex w-full items-center justify-between">
                <span className="text-xs">{t('matchEndDim', 'Dim')}</span>
                <span className="text-xs text-muted-foreground">{Math.round(clamp(matchEndConfig.dim, 0, 1) * 100)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={clamp(matchEndConfig.dim, 0, 1)}
                onChange={(e) => handleMatchEndUpdate({ dim: parseFloat(e.target.value) })}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => e.stopPropagation()}
                onPointerMove={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="w-full"
              />
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <TextAlignJustify size={14} />
            <span>{t('editTitle', 'Edit Title')}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem onClick={handleOpenTitleDialog}>
              <span>{t('setTitle', 'Set Title')}</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={handleClearTitle}>
              <span>{t('clearTitle', 'Clear Title')}</span>
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={handleToggleHideTitle}>
              <span>{hideTitleValue ? t('showTitle', 'Show Title') : t('hideTitle', 'Hide Title')}</span>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        {supportsLabelMenu && (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2">
              <TextAlignJustify size={14} />
              <span>{t('editLabel', 'Edit Label')}</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              {supportsLabelOverride && (
                <>
                  <ContextMenuItem onClick={handleOpenLabelDialog}>
                    <span>{t('setLabel', 'Set Label')}</span>
                  </ContextMenuItem>
                  <ContextMenuItem onClick={handleClearLabel}>
                    <span>{t('clearLabel', 'Clear Label')}</span>
                  </ContextMenuItem>
                  {supportsHideLabel && <ContextMenuSeparator />}
                </>
              )}
              {supportsHideLabel && (
                <ContextMenuItem onClick={handleToggleHideLabel}>
                  <span>{hideLabelValue ? t('showLabel', 'Show Label') : t('hideLabel', 'Hide Label')}</span>
                </ContextMenuItem>
              )}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        {supportsStageEventPlacement && (
          <ContextMenuSub>
            <ContextMenuSubTrigger className="gap-2">
              <TextAlignJustify size={14} />
              <span>{t('stageEventPosition', 'Event Position')}</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              <ContextMenuItem onClick={() => applyToTargets((target) => ({
                layout: { ...(target.layout || {}), eventPlacement: 'top' }
              }))}>
                <span>{t('eventAboveTimer', 'Above Timer')}</span>
              </ContextMenuItem>
              <ContextMenuItem onClick={() => applyToTargets((target) => ({
                layout: { ...(target.layout || {}), eventPlacement: 'bottom' }
              }))}>
                <span>{t('eventBelowTimer', 'Below Timer')}</span>
              </ContextMenuItem>
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        <ContextMenuSub>
          <ContextMenuSubTrigger className="gap-2">
            <Layers size={14} />
            <span>{t('zIndex', 'Z-Index')}</span>
          </ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            <ContextMenuItem onClick={() => bringElementsToFront(targetElementIds)}>
              <ArrowUp size={14} />
              <span>{t('bringToFront', 'Bring to Front')}</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => sendElementsToBack(targetElementIds)}>
              <ArrowDown size={14} />
              <span>{t('sendToBack', 'Send to Back')}</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => moveElementsForward(targetElementIds)}>
              <ArrowUp size={14} />
              <span>{t('moveForward', 'Move Forward')}</span>
            </ContextMenuItem>
            <ContextMenuItem onClick={() => moveElementsBackward(targetElementIds)}>
              <ArrowDown size={14} />
              <span>{t('moveBackward', 'Move Backward')}</span>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        {groups.length > 0 && (
          <ContextMenuSub>
            <ContextMenuSubTrigger>
              <Group size={14} />
              <span>{t('addToGroup', 'Add to Group')}</span>
            </ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-48">
              {groups.map((existingGroup) => (
                <ContextMenuItem
                  key={existingGroup.id}
                  onClick={() => handleAddToGroup(existingGroup.id)}
                  disabled={ungroupedSelectedIds.length === 0}
                >
                  <Group size={14} />
                  <span>{existingGroup.name}</span>
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        )}
        {groups.length === 0 && (
          <ContextMenuItem disabled>
            <Group size={14} />
            <span>{t('noGroupsAvailable', 'No groups available')}</span>
          </ContextMenuItem>
        )}
        <ContextMenuSeparator />
        {canGroup && (
          <ContextMenuItem onClick={handleGroupSelected}>
            <Group size={14} />
            <span>{t('groupSelected', 'Group Selected')} ({selectedElementIds.length})</span>
          </ContextMenuItem>
        )}
        {canUngroup && (
          <ContextMenuItem onClick={handleUngroup}>
            <Ungroup size={14} />
            <span>{t('ungroup', 'Ungroup')}</span>
          </ContextMenuItem>
        )}
        {!canGroup && !canUngroup && (
          <ContextMenuItem disabled>
            <span className="text-muted-foreground">{t('selectMultipleToGroup', 'Select multiple to group')}</span>
          </ContextMenuItem>
        )}
      </ContextMenuContent>
      </ContextMenu>
    </>
  );
}
