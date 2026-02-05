/* eslint-disable react-refresh/only-export-components */
import { useEffect, useRef, useCallback } from 'react';
import { useOverlayStore } from '@/stores/overlayStore';
import { useGameDataStore } from '@/stores/gameDataStore';

const resolveIsSpectator = ({ players, currentUser_id, roomMeta }) => {
  if (!currentUser_id) return true;
  const playerList = Array.isArray(players) ? players : [];
  const isPlaying = playerList.some((player) => player?.playerId === currentUser_id);
  if (isPlaying) return false;
  if (roomMeta?.player1_id === currentUser_id || roomMeta?.player2_id === currentUser_id) return false;
  return true;
};

const EMPTY_ROOM_BANS = {
  system: { heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
  player1: { player1_id: null, heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
  player2: { player2_id: null, heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const normalizeId = (value) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : value;
};

const normalizeItems = (items) => ({
  common: ensureArray(items?.common),
  rare: ensureArray(items?.rare),
  epic: ensureArray(items?.epic),
  legendary: ensureArray(items?.legendary),
});

const normalizeSystemBans = (entry) => ({
  heroes: ensureArray(entry?.heroes),
  weapons: ensureArray(entry?.weapons),
  tomes: ensureArray(entry?.tomes),
  items: normalizeItems(entry?.items),
});

const normalizePlayerBans = (entry, idKey, idValue) => ({
  ...(idKey ? { [idKey]: normalizeId(idValue ?? entry?.[idKey] ?? entry?.playerId ?? entry?.id ?? null) } : {}),
  heroes: ensureArray(entry?.heroes),
  weapons: ensureArray(entry?.weapons),
  tomes: ensureArray(entry?.tomes),
  items: normalizeItems(entry?.items),
});

const normalizeRoomBans = (roomBans, { roomMeta, player1State, player2State } = {}) => {
  if (!roomBans) return EMPTY_ROOM_BANS;

  const rawSystem = roomBans.system || roomBans.room || null;
  const rawPlayer1 = roomBans.player1 || roomBans.p1 || null;
  const rawPlayer2 = roomBans.player2 || roomBans.p2 || null;

  // Authoritative player IDs from roomMeta (primary source of truth)
  const metaPlayer1_id = normalizeId(roomMeta?.player1_id ?? null);
  const metaPlayer2_id = normalizeId(roomMeta?.player2_id ?? null);

  // Fallback player IDs from player states
  const slotPlayer1_id = normalizeId(player1State?.playerId ?? null);
  const slotPlayer2_id = normalizeId(player2State?.playerId ?? null);

  // Extract incoming player IDs from ban data
  const rawPlayer1_id = normalizeId(rawPlayer1?.player1_id ?? rawPlayer1?.playerId ?? rawPlayer1?.id ?? null);
  const rawPlayer2_id = normalizeId(rawPlayer2?.player2_id ?? rawPlayer2?.playerId ?? rawPlayer2?.id ?? null);

  // The resolved IDs we'll use for the output (prefer roomMeta, then slots)
  const resolvedPlayer1_id = metaPlayer1_id ?? slotPlayer1_id ?? null;
  const resolvedPlayer2_id = metaPlayer2_id ?? slotPlayer2_id ?? null;

  // CRITICAL: Validate and assign bans to the correct player slot
  // The relay server sends bans with player IDs attached. We must match them correctly.
  let bansForPlayer1 = null;
  let bansForPlayer2 = null;

  // If we have roomMeta IDs, use them to match incoming ban data precisely
  if (metaPlayer1_id !== null && metaPlayer2_id !== null) {
    // Check if rawPlayer1 data belongs to metaPlayer1_id
    if (rawPlayer1_id === metaPlayer1_id) {
      bansForPlayer1 = rawPlayer1;
    } else if (rawPlayer1_id === metaPlayer2_id) {
      // rawPlayer1 data actually belongs to player2 slot
      bansForPlayer2 = rawPlayer1;
    }

    // Check if rawPlayer2 data belongs to metaPlayer2_id
    if (rawPlayer2_id === metaPlayer2_id) {
      bansForPlayer2 = rawPlayer2;
    } else if (rawPlayer2_id === metaPlayer1_id) {
      // rawPlayer2 data actually belongs to player1 slot
      bansForPlayer1 = rawPlayer2;
    }

    // If we couldn't match by ID but the data is present, use positional fallback
    if (bansForPlayer1 === null && rawPlayer1 && rawPlayer1_id === null) {
      bansForPlayer1 = rawPlayer1;
    }
    if (bansForPlayer2 === null && rawPlayer2 && rawPlayer2_id === null) {
      bansForPlayer2 = rawPlayer2;
    }
  } else {
    // No roomMeta IDs available - use positional assignment as fallback
    bansForPlayer1 = rawPlayer1;
    bansForPlayer2 = rawPlayer2;
  }

  return {
    system: normalizeSystemBans(rawSystem || EMPTY_ROOM_BANS.system),
    player1: normalizePlayerBans(bansForPlayer1 || EMPTY_ROOM_BANS.player1, 'player1_id', resolvedPlayer1_id),
    player2: normalizePlayerBans(bansForPlayer2 || EMPTY_ROOM_BANS.player2, 'player2_id', resolvedPlayer2_id),
  };
};

const resolvePlayerSlots = ({ players, currentUser_id, roomMeta, roomBans, isSpectator }) => {
  const list = Array.isArray(players) ? players.filter(Boolean) : [];
  const byId = (id) => list.find((player) => player?.playerId === id) || null;

  if (!isSpectator && currentUser_id) {
    const me = byId(currentUser_id);
    const opponent = list.find((player) => player?.playerId !== currentUser_id) || null;
    return {
      player1: me,
      player2: me ? opponent : null,
    };
  }

  // Use roomMeta as primary source, fallback to roomBans for player IDs
  const authPlayer1_id = roomMeta?.player1_id ?? roomBans?.player1?.player1_id ?? null;
  const authPlayer2_id = roomMeta?.player2_id ?? roomBans?.player2?.player2_id ?? null;

  const p1 = authPlayer1_id ? byId(authPlayer1_id) : null;
  const p2 = authPlayer2_id ? byId(authPlayer2_id) : null;
  if (p1 || p2) {
    return {
      player1: p1,
      player2: p2,
    };
  }
  return {
    player1: null,
    player2: null,
  };
};

/**
 * Hook for connecting to the relay server via Web Worker
 * Offloads all network operations to a dedicated worker thread
 */
export function useRelayServer() {
  const workerRef = useRef(null);
  const roomGraceRef = useRef({ until: 0, timer: null, pending: null });
  const roomEpochRef = useRef(0);
  const roomGateRef = useRef({ active: false, roomId: null, queue: [] });
  const handleWorkerMessageRef = useRef(null);
  const matchEndRef = useRef({ timer: null, fadeTimer: null, roomId: null, epoch: 0 });
  const endedRoomRef = useRef({ roomId: null, until: 0 });
  const MATCH_END_FADE_DELAY_MS = 2500;
  const MATCH_END_FADE_MS = 500;
  const MATCH_END_CLEAR_BUFFER_MS = 250;
  const MATCH_END_HOLD_MS = MATCH_END_FADE_DELAY_MS + MATCH_END_FADE_MS + MATCH_END_CLEAR_BUFFER_MS;
  const MATCH_END_IGNORE_MS = MATCH_END_HOLD_MS + 2000;

  const {
    setPlayer1State,
    setPlayer2State,
    setIsConnected,
    setConnectionError,
    setActiveRoom,
    setCurrentUser_id,
    clearRoom,
    setIsSpectator,
    autoSpectatorMode,
    setSeasonInfo,
    setRoomBans,
    setRoomMeta,
    setQueueState,
    setMatchEndState,
    clearMatchEndState,
    setSessionStats,
  } = useOverlayStore();

  const {
    setHeroes,
    setWeapons,
    setTomes,
    setItems,
    setLoaded
  } = useGameDataStore();

  const clearMatchEndTimer = useCallback(() => {
    const current = matchEndRef.current;
    if (current?.timer) {
      clearTimeout(current.timer);
    }
    if (current?.fadeTimer) {
      clearTimeout(current.fadeTimer);
    }
    matchEndRef.current = { timer: null, fadeTimer: null, roomId: null, epoch: roomEpochRef.current };
    clearMatchEndState();
  }, [clearMatchEndState]);

  const scheduleMatchEndCleanup = useCallback((roomId, status) => {
    const now = Date.now();
    const epoch = roomEpochRef.current;
    const current = matchEndRef.current;
    if (current?.timer) {
      clearTimeout(current.timer);
    }
    if (current?.fadeTimer) {
      clearTimeout(current.fadeTimer);
    }

    const resolvedRoomId = roomId || useOverlayStore.getState().activeRoom || null;
    if (resolvedRoomId) {
      endedRoomRef.current = {
        roomId: resolvedRoomId,
        until: now + MATCH_END_IGNORE_MS,
      };
    }

    setMatchEndState({
      active: true,
      status: status || 'ended',
      roomId: resolvedRoomId,
      endedAt: now,
      fadeActive: false,
      fadeStartedAt: null,
      fadeDuration: MATCH_END_FADE_MS,
    });

    matchEndRef.current = {
      fadeTimer: setTimeout(() => {
        const state = useOverlayStore.getState();
        const lockRoom = resolvedRoomId || state.activeRoom;
        if (roomEpochRef.current !== epoch) return;
        if (lockRoom && state.activeRoom && lockRoom !== state.activeRoom) return;
        setMatchEndState({
          ...state.matchEndState,
          active: true,
          fadeActive: true,
          fadeStartedAt: Date.now(),
          fadeDuration: MATCH_END_FADE_MS,
        });
      }, MATCH_END_FADE_DELAY_MS),
      timer: setTimeout(() => {
        const state = useOverlayStore.getState();
        const activeRoom = state.activeRoom;
        if (roomEpochRef.current !== epoch) return;
        if (resolvedRoomId && activeRoom && resolvedRoomId !== activeRoom) return;
        clearRoom();
      }, MATCH_END_HOLD_MS),
      roomId: resolvedRoomId,
      epoch,
    };
  }, [
    clearRoom,
    setMatchEndState,
    MATCH_END_FADE_DELAY_MS,
    MATCH_END_FADE_MS,
    MATCH_END_HOLD_MS,
    MATCH_END_IGNORE_MS,
  ]);

  const processRoomMessage = useCallback((type, data) => {
    const matchEndState = useOverlayStore.getState().matchEndState;
    const activeRoom = useOverlayStore.getState().activeRoom;

    const getRoomIdForMessage = (msgType, msgData) => {
      if (msgData?.roomId) return msgData.roomId;
      if (msgData?.room?.activeRoom) return msgData.room.activeRoom;
      if (msgData?.activeRoom) return msgData.activeRoom;
      if (msgData?.room?.roomMeta?.roomId) return msgData.room.roomMeta.roomId;
      if (msgData?.room?.roomMeta?.room_id) return msgData.room.roomMeta.room_id;
      if (msgData?.roomMeta?.roomId) return msgData.roomMeta.roomId;
      if (msgData?.roomMeta?.room_id) return msgData.roomMeta.room_id;
      return null;
    };

    if (matchEndState?.active) {
      const lockRoomId = matchEndState.roomId || activeRoom;
      const messageRoomId = getRoomIdForMessage(type, data);
      const isLockedRoom = lockRoomId && (!messageRoomId || messageRoomId === lockRoomId);
      if (isLockedRoom && type !== 'active-room') {
        return;
      }
      if (type === 'active-room' && messageRoomId && lockRoomId && messageRoomId === lockRoomId) {
        return;
      }
    }

    const endedRoom = endedRoomRef.current;
    const endedRoomActive = endedRoom?.roomId && Date.now() < endedRoom.until;
    const endedRoomId = endedRoom?.roomId;
    const messageRoomId = getRoomIdForMessage(type, data);
    if (endedRoomActive && endedRoomId && messageRoomId && messageRoomId === endedRoomId) {
      if (['room', 'room-meta', 'players', 'player-update', 'cached-room', 'active-room'].includes(type)) {
        return;
      }
    }

    const applyRoomBans = (rawBans, roomMetaOverride = null) => {
      const state = useOverlayStore.getState();
      const normalized = normalizeRoomBans(rawBans, {
        roomMeta: roomMetaOverride || state.roomMeta,
        player1State: state.player1State,
        player2State: state.player2State,
      });
      setRoomBans(normalized);
    };

    switch (type) {
      case 'room': {
        const room = data.room || {};
        const activeRoom = room.activeRoom || null;
        const players = room.players || [];
        const roomMetaFromRoom = room.roomMeta || null;
        const roomBansFromRoom = room.roomBans || null;
        const currentActiveRoom = useOverlayStore.getState().activeRoom;
        if (activeRoom && activeRoom !== currentActiveRoom) {
          roomEpochRef.current += 1;
          endedRoomRef.current = { roomId: null, until: 0 };
          clearRoom();
          clearMatchEndTimer();
        }
        if (activeRoom) setActiveRoom(activeRoom);

        if (players.length > 0) {
          const currentUser_id = data.currentUser_id || useOverlayStore.getState().currentUser_id;
          const roomMeta = roomMetaFromRoom || useOverlayStore.getState().roomMeta;
          const roomBans = roomBansFromRoom || useOverlayStore.getState().roomBans;
          const isSpectator = data.isSpectator ?? useOverlayStore.getState().isSpectator;
          const slots = resolvePlayerSlots({ players, currentUser_id, roomMeta, roomBans, isSpectator });
          setPlayer1State(slots.player1 || null);
          setPlayer2State(slots.player2 || null);
        }

        if (data.season) setSeasonInfo(data.season);

        if (roomMetaFromRoom) {
          const currentRoomMeta = useOverlayStore.getState().roomMeta;
          const incomingHasPlayerIds = roomMetaFromRoom.player1_id || roomMetaFromRoom.player2_id;
          const currentHasPlayerIds = currentRoomMeta?.player1_id || currentRoomMeta?.player2_id;
          const isRoomChange = roomMetaFromRoom.roomId && roomMetaFromRoom.roomId !== currentRoomMeta?.roomId;

          // Only update roomMeta if incoming has better data or it's a room change
          if (isRoomChange || incomingHasPlayerIds || !currentHasPlayerIds) {
            setRoomMeta(roomMetaFromRoom);
          }

          const shouldClear = roomMetaFromRoom?.phase === 'ended'
            || roomMetaFromRoom?.status === 'ended'
            || roomMetaFromRoom?.status === 'cancelled';
          if (shouldClear) {
            setRoomBans(EMPTY_ROOM_BANS);
            scheduleMatchEndCleanup(roomMetaFromRoom?.roomId || roomMetaFromRoom?.room_id || activeRoom, roomMetaFromRoom?.status || roomMetaFromRoom?.phase);
          } else if (roomBansFromRoom) {
            // Use the best available roomMeta for ban assignment
            const authRoomMeta = incomingHasPlayerIds ? roomMetaFromRoom : (currentHasPlayerIds ? currentRoomMeta : roomMetaFromRoom);
            applyRoomBans(roomBansFromRoom, authRoomMeta);
          }
        } else if (roomBansFromRoom) {
          applyRoomBans(roomBansFromRoom);
        }

        if (data.queueState) setQueueState(data.queueState);

        if (autoSpectatorMode) {
          const userId = data.currentUser_id || useOverlayStore.getState().currentUser_id;
          const roomMeta = roomMetaFromRoom || useOverlayStore.getState().roomMeta;
          const resolved = resolveIsSpectator({ players: players || [], currentUser_id: userId, roomMeta });
          setIsSpectator(data.isSpectator !== undefined ? data.isSpectator : resolved);
        }
        console.log('[RelayServer] Room loaded:', {
          room: activeRoom,
          players: players?.length,
          isSpectator: data.isSpectator,
        });
        break;
      }
      case 'active-room': {
        const currentActiveRoom = useOverlayStore.getState().activeRoom;
        if (data.activeRoom && data.activeRoom !== currentActiveRoom) {
          roomEpochRef.current += 1;
          endedRoomRef.current = { roomId: null, until: 0 };
          clearRoom();
          clearMatchEndTimer();
        }
        if (data.activeRoom) setActiveRoom(data.activeRoom);
        break;
      }
      case 'players': {
        const state = useOverlayStore.getState();
        const currentUser_id = state.currentUser_id;
        // Use roomMeta from message data if available (for deterministic slot assignment)
        // This prevents race conditions where players arrive before room-meta is processed
        const roomMeta = data.roomMeta || state.roomMeta;
        const roomBans = data.roomBans || state.roomBans;
        const slots = resolvePlayerSlots({
          players: data.players,
          currentUser_id,
          roomMeta,
          roomBans,
          isSpectator: state.isSpectator,
        });
        setPlayer1State(slots.player1 || null);
        setPlayer2State(slots.player2 || null);

        if (autoSpectatorMode && currentUser_id) {
          setIsSpectator(resolveIsSpectator({ players: data.players || [], currentUser_id, roomMeta }));
        }
        break;
      }
      case 'room-meta': {
        if (data.roomMeta) {
          const currentRoomMeta = useOverlayStore.getState().roomMeta;
          const incomingHasPlayerIds = data.roomMeta.player1_id || data.roomMeta.player2_id;
          const currentHasPlayerIds = currentRoomMeta?.player1_id || currentRoomMeta?.player2_id;
          const isRoomChange = data.roomMeta.roomId && data.roomMeta.roomId !== currentRoomMeta?.roomId;

          // Only update roomMeta if:
          // 1. It's a room change, OR
          // 2. Incoming data has player IDs (more complete), OR
          // 3. Current state doesn't have player IDs (no good data to preserve)
          if (isRoomChange || incomingHasPlayerIds || !currentHasPlayerIds) {
            setRoomMeta(data.roomMeta);
          }

          const shouldClear = data.roomMeta?.phase === 'ended'
            || data.roomMeta?.status === 'ended'
            || data.roomMeta?.status === 'cancelled';
          if (shouldClear) {
            setRoomBans(EMPTY_ROOM_BANS);
            scheduleMatchEndCleanup(data.roomMeta?.roomId || data.roomMeta?.room_id, data.roomMeta?.status || data.roomMeta?.phase);
          } else if (data.roomBans) {
            // Use the best available roomMeta for ban assignment
            const authRoomMeta = incomingHasPlayerIds ? data.roomMeta : (currentHasPlayerIds ? currentRoomMeta : data.roomMeta);
            applyRoomBans(data.roomBans, authRoomMeta);
          }
        } else if (data.roomBans) {
          applyRoomBans(data.roomBans);
        }

        if (data.queueState) setQueueState(data.queueState);
        if (autoSpectatorMode) {
          const state = useOverlayStore.getState();
          const currentUser_id = state.currentUser_id;
          if (currentUser_id) {
            const players = [state.player1State, state.player2State].filter(Boolean);
            const roomMeta = data.roomMeta || state.roomMeta;
            setIsSpectator(resolveIsSpectator({ players, currentUser_id, roomMeta }));
          }
        }
        break;
      }
      case 'cached-room': {
        console.log('[RelayServer] Cached room data received:', data.roomId);
        const room = data.room || {};
        const players = room.players || [];
        const roomMetaFromRoom = room.roomMeta || null;
        const roomBansFromRoom = room.roomBans || null;
        const currentActiveRoom = useOverlayStore.getState().activeRoom;
        const gateState = roomGateRef.current;
        if (currentActiveRoom && data.roomId !== currentActiveRoom) {
          break;
        }
        if (!currentActiveRoom && data.roomId && gateState.active && gateState.roomId === data.roomId) {
          setActiveRoom(data.roomId);
          clearMatchEndTimer();
        }

        // CRITICAL: Use roomMeta from cached room data - it has authoritative player1_id/player2_id
        // This must be set BEFORE resolving player slots to prevent race conditions
        const cachedRoomMeta = roomMetaFromRoom;
        if (cachedRoomMeta?.player1_id || cachedRoomMeta?.player2_id) {
          setRoomMeta(cachedRoomMeta);
        }

        const userId = useOverlayStore.getState().currentUser_id;
        // Use the cached roomMeta directly, not the potentially stale state
        const authRoomMeta = cachedRoomMeta || useOverlayStore.getState().roomMeta;

        const slots = resolvePlayerSlots({
          players,
          currentUser_id: userId,
          roomMeta: authRoomMeta,
          roomBans: roomBansFromRoom,
          isSpectator: useOverlayStore.getState().isSpectator,
        });
        setPlayer1State(slots.player1 || null);
        setPlayer2State(slots.player2 || null);

        // Apply room bans with the authoritative roomMeta to ensure correct player assignment
        if (roomBansFromRoom) applyRoomBans(roomBansFromRoom, authRoomMeta);

        if (autoSpectatorMode && userId) {
          setIsSpectator(resolveIsSpectator({ players: players || [], currentUser_id: userId, roomMeta: authRoomMeta }));
        }

        console.log('[RelayServer] Populated overlay from cached room data:', {
          roomId: data.roomId,
          playerCount: players?.length,
          player1_id: authRoomMeta?.player1_id,
          player2_id: authRoomMeta?.player2_id,
        });
        break;
      }
      default:
        break;
    }
  }, [
    autoSpectatorMode,
    clearMatchEndTimer,
    clearRoom,
    setActiveRoom,
    setIsSpectator,
    setPlayer1State,
    setPlayer2State,
    setQueueState,
    setRoomBans,
    setRoomMeta,
    setSeasonInfo,
    scheduleMatchEndCleanup,
  ]);

  const scheduleRoomMessage = useCallback((type, data) => {
    const now = Date.now();
    const grace = roomGraceRef.current.until;
    const epoch = roomEpochRef.current;
    if (now < grace) {
      roomGraceRef.current.pending = { type, data, epoch };
      if (!roomGraceRef.current.timer) {
        roomGraceRef.current.timer = setTimeout(() => {
          const pending = roomGraceRef.current.pending;
          roomGraceRef.current.pending = null;
          roomGraceRef.current.timer = null;
          if (pending && pending.epoch === roomEpochRef.current) {
            processRoomMessage(pending.type, pending.data);
          }
        }, Math.max(0, grace - now));
      }
      return;
    }

    processRoomMessage(type, data);
  }, [processRoomMessage]);

  // Handle messages from worker
  const handleWorkerMessage = useCallback((event) => {
    const { type, ...data } = event.data;
    const spoofEnabled = useOverlayStore.getState().spoofEnabled;
    const gateState = roomGateRef.current;

    const getMessageRoomId = (msgType, msgData) => {
      if (msgData?.roomId) return msgData.roomId;
      if (msgData?.room?.activeRoom) return msgData.room.activeRoom;
      if (msgData?.activeRoom) return msgData.activeRoom;
      if (msgData?.room?.roomMeta?.roomId) return msgData.room.roomMeta.roomId;
      if (msgData?.room?.roomMeta?.room_id) return msgData.room.roomMeta.room_id;
      if (msgData?.roomMeta?.roomId) return msgData.roomMeta.roomId;
      if (msgData?.roomMeta?.room_id) return msgData.roomMeta.room_id;
      return null;
    };

    const matchEndState = useOverlayStore.getState().matchEndState;
    const activeRoom = useOverlayStore.getState().activeRoom;
    const messageRoomId = getMessageRoomId(type, data);
    const lockRoomId = matchEndState?.roomId || activeRoom;
    const isLockedRoom = matchEndState?.active && lockRoomId && (!messageRoomId || messageRoomId === lockRoomId);
    if (isLockedRoom && ['room', 'room-meta', 'players', 'player-update', 'cached-room'].includes(type)) {
      return;
    }
    if (matchEndState?.active && messageRoomId && lockRoomId && messageRoomId !== lockRoomId) {
      clearMatchEndTimer();
    }

    const endedRoom = endedRoomRef.current;
    const endedRoomActive = endedRoom?.roomId && Date.now() < endedRoom.until;
    if (endedRoomActive && endedRoom.roomId && messageRoomId && messageRoomId === endedRoom.roomId) {
      if (['room', 'room-meta', 'players', 'player-update', 'cached-room', 'active-room'].includes(type)) {
        return;
      }
    }
    if (endedRoomActive && endedRoom?.roomId && type === 'room-changed' && data.action === 'subscribe' && data.roomId === endedRoom.roomId) {
      return;
    }

    const activateRoomGate = (roomId) => {
      if (!roomId) return;
      gateState.active = true;
      gateState.roomId = roomId;
      gateState.queue = [];
      if (roomGraceRef.current.timer) {
        clearTimeout(roomGraceRef.current.timer);
        roomGraceRef.current.timer = null;
        roomGraceRef.current.pending = null;
      }
    };

    const releaseRoomGate = (roomId) => {
      if (!gateState.active) return;
      if (roomId && gateState.roomId && roomId !== gateState.roomId) return;
      const pending = gateState.queue.slice();
      gateState.active = false;
      gateState.roomId = null;
      gateState.queue = [];
      return pending;
    };

    const enqueueIfGated = (msgType, msgData) => {
      if (!gateState.active) return false;
      const msgRoomId = getMessageRoomId(msgType, msgData);
      if (gateState.roomId && msgRoomId && msgRoomId !== gateState.roomId) {
        return true;
      }
      gateState.queue.push({ type: msgType, data: msgData });
      return true;
    };

    switch (type) {
      case 'match-ended': {
        if (spoofEnabled) break;
        const resolvedRoomId = data.roomId || data.room_id || lockRoomId || activeRoom;
        scheduleMatchEndCleanup(resolvedRoomId, data.status || 'ended');
        break;
      }
      case 'connected':
        setIsConnected(data.isConnected);
        if (data.isConnected) {
          setConnectionError(null);
        }
        break;

      case 'error':
        setConnectionError(data.error);
        break;

      case 'entities':
        if (data.heroes) setHeroes(data.heroes);
        if (data.weapons) setWeapons(data.weapons);
        if (data.tomes) setTomes(data.tomes);
        if (data.items) setItems(data.items);
        if (data.heroes?.length > 0 || data.items?.length > 0) {
          setLoaded(true);
        }
        console.log('[RelayServer] Entities loaded:', {
          heroes: data.heroes?.length || 0,
          weapons: data.weapons?.length || 0,
          tomes: data.tomes?.length || 0,
          items: data.items?.length || 0,
        });
        break;

      case 'profile':
        if (data.userId) {
          setCurrentUser_id(data.userId);
          console.log('[RelayServer] User ID:', data.userId);
        }
        break;

      case 'season':
        if (data.season) {
          setSeasonInfo(data.season);
        }
        break;

      case 'session-stats':
        if (data.session) {
          setSessionStats(data.session);
        }
        break;

      case 'room': {
        if (spoofEnabled) break;
        const room = data.room || {};
        const activeRoom = room.activeRoom || null;
        const roomMetaFromRoom = room.roomMeta || null;
        const roomBansFromRoom = room.roomBans || null;
        // Room data from HTTP response releases the room gate
        const pendingAfterRoom = gateState.active
          ? releaseRoomGate(activeRoom || roomMetaFromRoom?.roomId || roomMetaFromRoom?.room_id || data.roomId)
          : null;
        // CRITICAL: If this is a complete room message (from HTTP initial fetch),
        // process it immediately to ensure roomMeta and roomBans are not lost.
        // The grace period should only delay subsequent incremental updates.
        if (roomMetaFromRoom && roomBansFromRoom) {
          // Complete room data - process immediately without grace period
          if (activeRoom) {
            const currentActiveRoom = useOverlayStore.getState().activeRoom;
            if (activeRoom !== currentActiveRoom) {
              roomEpochRef.current += 1;
            }
          }
          processRoomMessage(type, data);
          // Set grace period AFTER processing to delay subsequent incremental updates
          roomGraceRef.current.until = Date.now() + 350;
        } else {
          // Incremental update - use grace period scheduling
          if (activeRoom) {
            const currentActiveRoom = useOverlayStore.getState().activeRoom;
            if (activeRoom !== currentActiveRoom) {
              roomGraceRef.current.until = Date.now() + 350;
            }
          }
          scheduleRoomMessage(type, data);
        }
        if (pendingAfterRoom?.length) {
          pendingAfterRoom.forEach((queued) => {
            processRoomMessage(queued.type, queued.data);
          });
        }
        break;
      }

      case 'active-room':
        if (matchEndState?.active && lockRoomId && data.activeRoom === lockRoomId) {
          break;
        }
        if (data.activeRoom) {
          const currentActiveRoom = useOverlayStore.getState().activeRoom;
          if (data.activeRoom !== currentActiveRoom) {
            clearMatchEndTimer();
            // Activate hard gate on room change and request cached room data
            activateRoomGate(data.activeRoom);
            workerRef.current?.postMessage({ type: 'fetch-room', roomId: data.activeRoom });
            break;
          }
        }
        if (enqueueIfGated(type, data)) break;
        scheduleRoomMessage(type, data);
        break;

      case 'players': {
        if (spoofEnabled) break;
        if (enqueueIfGated(type, data)) break;
        scheduleRoomMessage(type, data);
        break;
      }

      case 'room-meta': {
        if (spoofEnabled) break;
        if (gateState.active && data.roomMeta) {
          const metaRoomId = getMessageRoomId(type, data);
          const canRelease = !gateState.roomId || !metaRoomId || metaRoomId === gateState.roomId;
          if (canRelease) {
            const pendingAfterMeta = releaseRoomGate(metaRoomId);
            processRoomMessage(type, data);
            if (pendingAfterMeta?.length) {
              pendingAfterMeta.forEach((queued) => {
                processRoomMessage(queued.type, queued.data);
              });
            }
            break;
          }
        }
        if (enqueueIfGated(type, data)) break;
        scheduleRoomMessage(type, data);
        break;
      }

      case 'room-changed':
        if (spoofEnabled) break;
        console.log('[RelayServer] Room changed:', data.action, data.roomId);
        if (matchEndState?.active && lockRoomId && data.roomId === lockRoomId) {
          break;
        }
        if (data.action === 'subscribe') {
          const currentActiveRoom = useOverlayStore.getState().activeRoom;
          if (data.roomId && data.roomId !== currentActiveRoom) {
            clearMatchEndTimer();
            endedRoomRef.current = { roomId: null, until: 0 };
            // Activate hard gate on room change and request cached room data
            activateRoomGate(data.roomId);
            workerRef.current?.postMessage({ type: 'fetch-room', roomId: data.roomId });
          }
        } else if (data.action === 'unsubscribe') {
          const currentActiveRoom = useOverlayStore.getState().activeRoom;
          if (!data.roomId || data.roomId === currentActiveRoom) {
            // Do not mutate state during gate; wait for API response
            if (!gateState.active) {
              roomEpochRef.current += 1;
              clearRoom();
            }
          }
        }
        break;

      case 'player-update': {
        if (spoofEnabled) break;
        if (enqueueIfGated(type, data)) break;
        // Skip updates during drag operations OR rectangle selection to prevent CPU spikes
        const state = useOverlayStore.getState();
        const isDragging = state.isDragging;
        const isSelectingRectangle = state.isSelectingRectangle;

        if (isDragging || isSelectingRectangle) {
          // Silently ignore updates while dragging or selecting - they'll resume when done
          break;
        }

        // Efficient single-player update - only updates the changed player
        const { player, playerId } = data;
        const room = data.room || {};
        const activeRoom = room.activeRoom || null;
        const msgRoomMeta = room.roomMeta || null;
        const msgRoomBans = room.roomBans || null;
        const currentActiveRoom = state.activeRoom;
        if (activeRoom && currentActiveRoom && activeRoom !== currentActiveRoom) {
          console.log('[RelayServer] Ignoring player-update for non-active room:', activeRoom, 'vs', currentActiveRoom);
          break;
        }
        if (activeRoom && !currentActiveRoom) {
          roomEpochRef.current += 1;
          setActiveRoom(activeRoom);
        }

        const currentUser_id = state.currentUser_id;
        // Use roomMeta and roomBans from message if available (prevents race conditions)
        const roomMeta = msgRoomMeta || state.roomMeta;
        const roomBans = msgRoomBans || state.roomBans;
        const isSpectator = state.isSpectator;
        const player1 = state.player1State;
        const player2 = state.player2State;

        // If we received roomMeta from message and state's roomMeta is empty, update it
        if (msgRoomMeta?.player1_id && !state.roomMeta?.player1_id) {
          setRoomMeta(msgRoomMeta);
        }

        // Determine authoritative player IDs for slot assignment
        // Priority: roomMeta > roomBans > existing slot assignments
        const authPlayer1_id = roomMeta?.player1_id ?? roomBans?.player1?.player1_id ?? null;
        const authPlayer2_id = roomMeta?.player2_id ?? roomBans?.player2?.player2_id ?? null;

        // DETERMINISTIC slot assignment
        // 1. In non-spectator mode: player = me, opponent = them
        // 2. In spectator mode: use authoritative player IDs (roomMeta or roomBans)
        // 3. Fallback: use existing slot if player already assigned there

        let targetSlot = null;

        if (!isSpectator && currentUser_id) {
          // Playing mode: assign based on currentUser_id
          targetSlot = playerId === currentUser_id ? 1 : 2;
        } else if (authPlayer1_id || authPlayer2_id) {
          // Spectator mode with authoritative player IDs: assign based on player1_id/player2_id
          if (playerId === authPlayer1_id) {
            targetSlot = 1;
          } else if (playerId === authPlayer2_id) {
            targetSlot = 2;
          }
        } else {
          // Fallback: check if player already has a slot, don't reassign
          if (player1?.playerId === playerId) {
            targetSlot = 1;
          } else if (player2?.playerId === playerId) {
            targetSlot = 2;
          } else {
            // New player without any authoritative IDs: assign to first empty slot
            targetSlot = !player1 ? 1 : !player2 ? 2 : null;
          }
        }

        // Update the determined slot
        if (targetSlot === 1) {
          setPlayer1State(player);
          // console.log('[RelayServer] Updated player1 slot with', playerId);
        } else if (targetSlot === 2) {
          setPlayer2State(player);
          // console.log('[RelayServer] Updated player2 slot with', playerId);
        } else {
          console.warn('[RelayServer] No slot assigned for player', playerId);
        }

        // Update spectator mode using proper detection
        if (autoSpectatorMode && currentUser_id) {
          const allPlayers = [player1, player2, player].filter(p => p?.playerId);
          const uniquePlayers = Array.from(new Set(allPlayers.map(p => p.playerId)));
          const playerStates = uniquePlayers.map(pid =>
            allPlayers.find(p => p.playerId === pid)
          ).filter(Boolean);

          const newIsSpectator = resolveIsSpectator({
            players: playerStates,
            currentUser_id,
            roomMeta
          });
          // console.log('[RelayServer] Spectator detection:', {
          //   currentIsSpectator: isSpectator,
          //   newIsSpectator,
          //   currentUser_id,
          //   playerStates: playerStates.map(p => p.playerId),
          // });
          if (newIsSpectator !== isSpectator) {
            console.log('[RelayServer] Changing spectator mode from', isSpectator, 'to', newIsSpectator);
            setIsSpectator(newIsSpectator);
          }
        }
        break;
      }

      case 'cached-room': {
        // Cached room data from API releases the room gate
        const room = data.room || {};
        const pendingAfterCachedRoom = gateState.active
          ? releaseRoomGate(data.roomId || room.roomMeta?.roomId || room.roomMeta?.room_id)
          : null;
        if (pendingAfterCachedRoom) {
          processRoomMessage(type, data);
        } else {
          scheduleRoomMessage(type, data);
        }
        if (pendingAfterCachedRoom?.length) {
          pendingAfterCachedRoom.forEach((queued) => {
            processRoomMessage(queued.type, queued.data);
          });
        }
        break;
      }
    }
  }, [
    setIsConnected,
    setConnectionError,
    setHeroes,
    setWeapons,
    setTomes,
    setItems,
    setLoaded,
    setCurrentUser_id,
    setActiveRoom,
    setPlayer1State,
    setPlayer2State,
    setRoomMeta,
    setSeasonInfo,
    setSessionStats,
    setIsSpectator,
    autoSpectatorMode,
    clearMatchEndTimer,
    clearRoom,
    scheduleMatchEndCleanup,
    scheduleRoomMessage,
    processRoomMessage,
  ]);

  // Keep ref updated with latest handler (must be in useEffect, not during render)
  useEffect(() => {
    handleWorkerMessageRef.current = handleWorkerMessage;
  }, [handleWorkerMessage]);

  // Initialize worker - only runs once on mount
  // Uses ref to access latest handler without causing re-initialization
  useEffect(() => {
    const graceState = roomGraceRef.current;
    // Create worker using Vite's worker import
    workerRef.current = new Worker(
      new URL('../workers/networkWorker.js', import.meta.url),
      { type: 'module' }
    );

    // Use a stable wrapper that calls the ref - this prevents worker recreation
    // when handler dependencies change
    workerRef.current.onmessage = (event) => {
      handleWorkerMessageRef.current?.(event);
    };
    workerRef.current.onerror = (error) => {
      console.error('[RelayServer] Worker error:', error);
      setConnectionError('Network worker error');
    };

    // Start connection
    workerRef.current.postMessage({ type: 'connect' });

    return () => {
      if (graceState.timer) {
        clearTimeout(graceState.timer);
        graceState.timer = null;
        graceState.pending = null;
      }
      clearMatchEndTimer();
      workerRef.current?.postMessage({ type: 'disconnect' });
      workerRef.current?.terminate();
    };
  }, [clearMatchEndTimer, setConnectionError]); // Only depend on setConnectionError, not handleWorkerMessage

  // Reconnect function
  const reconnect = useCallback(() => {
    workerRef.current?.postMessage({ type: 'reconnect' });
  }, []);

  // Get connection state from store
  const { isConnected } = useOverlayStore();

  return {
    isConnected,
    reconnect,
  };
}

/**
 * Provider component that initializes the relay server connection
 */
export function RelayServerProvider({ children }) {
  useRelayServer();
  return children;
}
