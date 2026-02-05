/**
 * MegaBonk WS Relay Server
 * Standalone WebSocket relay server - compiles to .exe with pkg
 * 
 * Usage: MegaBonkRelay.exe [port]
 * Default port: 17502
 */

const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('./lib/logger');
const { createSettingsStore } = require('./lib/settings');
const { createSessionTracker } = require('./lib/sessionTracking');
const { createRoomCache } = require('./lib/roomCache');
const { randomUUID } = require('crypto');

// Configuration
const PORT = process.env.RELAY_PORT || process.argv[2] || 17502;

const { log, logFullResponse } = createLogger();
const settingsStore = createSettingsStore({ log });
const sessionTracker = createSessionTracker({ log });

// ============================================================
// IN-MEMORY GAME CONTEXT STORAGE
// ============================================================

// Room data cache with LRU eviction (max 10 rooms)
const MAX_ROOM_CACHE_SIZE = 10;
const roomCache = createRoomCache({ maxSize: MAX_ROOM_CACHE_SIZE, log });

function createSessionToken() {
  try {
    return randomUUID();
  } catch (e) {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function cacheRoomBundle(roomId, roomBundle, rawRoomData = null) {
  roomCache.setRoom(roomId, roomBundle, rawRoomData);
}

function updateCachedRoomBundle(roomId, roomBundle) {
  roomCache.updateRoom(roomId, roomBundle);
}

function updateCachedRoomRaw(roomId, rawRoomData) {
  roomCache.updateRoomRaw(roomId, rawRoomData);
}

function getCachedRoomBundle(roomId) {
  return roomCache.getRoom(roomId);
}

function getCachedRoomRaw(roomId) {
  return roomCache.getRoomRaw(roomId);
}

function hasRoomInCache(roomId) {
  return roomCache.hasRoom(roomId);
}

function listCachedRoomIds() {
  return roomCache.listRooms();
}

const EXTENSION_REFRESH_REQUESTS = [
  { url: 'https://game.megabonk.su/api/profile/', method: 'GET' },
  // { url: 'https://game.megabonk.su/api/room/active/', method: 'GET' },
  { url: 'https://game.megabonk.su/api/heroes', method: 'GET' },
  { url: 'https://game.megabonk.su/api/weapons', method: 'GET' },
  { url: 'https://game.megabonk.su/api/tomes', method: 'GET' },
  { url: 'https://game.megabonk.su/api/items', method: 'GET' },
  { url: 'https://game.megabonk.su/api/seasons/active', method: 'GET' },
  { url: 'https://game.megabonk.su/api/seasons/all', method: 'GET' },
  { url: 'https://game.megabonk.su/api/friends/', method: 'GET' },
];

// Dynamic request builder for player-specific endpoints
function buildPlayerSpecificRequests(userId) {
  if (!userId) return [];
  return [
    { url: `https://game.megabonk.su/api/players/${userId}/seasons`, method: 'GET' },
  ];
}

const REFRESH_COOLDOWN_MS = 10000;
let lastRefreshRequestAt = 0;

function requestExtensionRefresh(ws, clientInfo, options = {}) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const now = Date.now();
  const force = options.force === true;
  if (!force && !isCoreDataMissing()) return;
  const currentUserId = gameContext.profile?.userId || null;
  const requestedRecently = clientInfo?.refreshRequestedAt && (now - clientInfo.refreshRequestedAt) < REFRESH_COOLDOWN_MS;
  const userUnchanged = clientInfo?.refreshRequestedUserId === currentUserId;
  if (!force && requestedRecently && userUnchanged) return;
  if (clientInfo) {
    clientInfo.refreshRequestedAt = now;
    clientInfo.refreshRequestedUserId = currentUserId || null;
  }
  lastRefreshRequestAt = now;

  const userId = gameContext.profile?.userId;
  const allRequests = [...EXTENSION_REFRESH_REQUESTS];
  
  // Add player-specific requests if we have a user ID
  if (userId) {
    allRequests.push(...buildPlayerSpecificRequests(userId));
  }

  const payload = {
    action: 'page-fetch',
    useAuthToken: true,
    tokenKeys: ['access_token', 'token', 'auth_token', 'authToken'],
    authHeaderName: 'Authorization',
    authScheme: 'Bearer',
    requests: allRequests,
  };

  ws.send(JSON.stringify({ type: 'command', payload }));
  log(`[Relay] Requested extension refresh from client ${clientInfo?.id || 'unknown'}${options.reason ? ` (${options.reason})` : ''}`);
}

function isCoreDataMissing() {
  const hasEntities = gameContext.heroes.size > 0
    && gameContext.weapons.size > 0
    && gameContext.tomes.size > 0
    && gameContext.items.size > 0;
  const hasProfile = !!gameContext.profile?.userId;
  const hasSeason = !!gameContext.activeSeason;
  const needsPlayerStats = hasProfile && !gameContext.seasonPlayerStats;
  return !hasEntities || !hasProfile || !hasSeason || needsPlayerStats;
}

function ensureExtensionRefreshFromAny(reason) {
  if (!isCoreDataMissing()) return;
  const now = Date.now();
  if (now - lastRefreshRequestAt < REFRESH_COOLDOWN_MS) return;
  let sent = 0;
  clients.forEach((info, ws) => {
    if (info?.type === CLIENT_TYPE.EXTENSION && ws.readyState === WebSocket.OPEN) {
      requestExtensionRefresh(ws, info, { reason });
      sent += 1;
    }
  });
  if (!sent) {
    log(`[Relay] Refresh needed (${reason || 'missing data'}) but no extension clients are connected.`);
  }
}

function processPageCommandResult(message) {
  const event = message?.event;
  if (!event || event.type !== 'PAGE_COMMAND_RESULT') return;

  if (event.action === 'page-fetch') {
    if (event.status === 200 && event.url && event.data) {
      processApiResponse({
        event: {
          type: 'API_RESPONSE',
          status: event.status,
          url: event.url,
          method: event.method || 'GET',
          data: event.data,
        },
      });
    }
  }
}

const gameContext = {
  // Static game data from API
  heroes: new Map(),       // ingameId -> hero data
  weapons: new Map(),      // ingameId -> weapon data
  tomes: new Map(),        // ingameId -> tome data
  items: new Map(),        // ingameId -> item data
  
  // Active season data
  activeSeason: null,      // Current active season with bans
  allSeasons: [],          // All seasons (active and inactive)
  seasonPlayerStats: null, // Current user season stats (rating, rank)
  
  // Friends data
  friends: [],             // List of friends
  pendingFriends: [],      // Pending friend requests

  // Profile data for the currently logged-in user
  profile: null,           // single profile object
  
  // Global bans from active season
  bans: {
    disabledHeroes: [],    // Heroes disabled for the season
    disabledWeapons: [],   // Weapons disabled for the season
    disabledTomes: [],     // Tomes disabled for the season
    disabledItems: [],     // Items disabled for the season
    bannableHeroes: [],    // Heroes that can be banned by players
    bannableWeapons: [],   // Weapons that can be banned by players
    bannableTomes: [],     // Tomes that can be banned by players
    bannableItems: [],     // Items that can be banned by players
    playerBanExcludedHeroes: [],
    playerBanExcludedWeapons: [],
    playerBanExcludedTomes: [],
    playerBanExcludedItems: []
  },
  
  // Translations by language code, e.g. { en: { ... }, ru: { ... } }
  translations: {},
  
  // Active game state from WebSocket events - supports multiple players
  room: {
    activeRoom: null,        // Current room ID
    players: new Map(),      // playerId -> player game state
    roomMeta: {
      roomId: null,
      lobbyNumber: null,
      queueType: null,
      status: null,
      phase: null,
      map: null,
      winnerId: null,
      player1_id: null,
      player2_id: null,
      player1Profile: null,
      player2Profile: null,
      gamePhaseStartedAt: null,
      player1ReadyBanSelection: null,
      player2ReadyBanSelection: null,
      currentPlayerReadyBanSelection: null,
      player1GameStatus: null,
      player2GameStatus: null,
      currentPlayerGameStatus: null,
      player1RunHasData: null,
      player2RunHasData: null,
    },
    roomBans: {
      system: { heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
      player1: { player1_id: null, heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
      player2: { player2_id: null, heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
    },
  },

  // Matchmaking/queue state
  queueState: {
    inQueue: false,
    queueType: null,
    seasonId: null,
    rating: 0,
    queueSize: 0,
    elapsedTime: 0,
    status: 'idle',
    proposalId: null,
    matchTimeout: null,
    playerAccepted: false,
    opponentAccepted: false,
    declinedBy: null,
    message: null,
    lastEvent: null,
  },
  
  // Metadata
  lastUpdated: {
    heroes: null,
    weapons: null,
    tomes: null,
    items: null,
    season: null,
    allSeasons: null,
    friends: null,
    profile: null,
    seasonPlayerStats: null,
    translations: null,
    game: null,
    room: null,
    queue: null
  }
};

function normalizeRoomPlayersArray(players) {
  if (Array.isArray(players)) return players;
  if (players instanceof Map) return Array.from(players.values());
  return Array.from(players?.values?.() || []);
}

function buildRoomBundle({ activeRoom, players, roomMeta, roomBans } = {}) {
  return {
    activeRoom: activeRoom || gameContext.room.activeRoom,
    players: normalizeRoomPlayersArray(players || gameContext.room.players),
    roomMeta: roomMeta || gameContext.room.roomMeta,
    roomBans: roomBans || gameContext.room.roomBans,
  };
}

const EMPTY_BANS_ENTRY = { heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } };

const EMPTY_ROOM_META = {
  roomId: null,
  lobbyNumber: null,
  queueType: null,
  status: null,
  phase: null,
  map: null,
  winnerId: null,
  player1_id: null,
  player2_id: null,
  player1Profile: null,
  player2Profile: null,
  gamePhaseStartedAt: null,
  player1ReadyBanSelection: null,
  player2ReadyBanSelection: null,
  currentPlayerReadyBanSelection: null,
  player1GameStatus: null,
  player2GameStatus: null,
  currentPlayerGameStatus: null,
  player1RunHasData: null,
  player2RunHasData: null,
};

const EMPTY_ROOM_BANS = {
  system: { ...EMPTY_BANS_ENTRY },
  player1: { player1_id: null, ...EMPTY_BANS_ENTRY },
  player2: { player2_id: null, ...EMPTY_BANS_ENTRY },
};

const ensureArray = (value) => (Array.isArray(value) ? value : []);

const normalizeId = (value) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : value;
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined) return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const extractRatingRank = (source, fallbackUserId) => {
  if (!source || typeof source !== 'object') return null;
  const rating = source.rating
    || source.rating_points
    || source.ratingPoints
    || source.points
    || source.mmr
    || source.elo
    || source.mega_points
    || source.megaPoints
    || source.score
    || null;
  const rank = source.rank
    || source.position
    || source.place
    || source.league_rank
    || source.rating_rank
    || null;
  if (rating === null && rank === null) return null;
  return {
    rating: normalizeNumber(rating) || rating,
    rank: normalizeNumber(rank) || rank,
    userId: source.user_id || source.userId || fallbackUserId || null,
  };
};

const resolveSeasonPlayerStats = (seasonData, userId) => {
  if (!seasonData || typeof seasonData !== 'object') return null;

  const directCandidates = [
    seasonData.player,
    seasonData.player_stats,
    seasonData.playerStats,
    seasonData.current_player,
    seasonData.currentPlayer,
    seasonData.user,
    seasonData.user_stats,
    seasonData.userStats,
  ].filter(Boolean);

  for (const candidate of directCandidates) {
    const extracted = extractRatingRank(candidate, userId);
    if (extracted) return extracted;
  }

  const playersList = Array.isArray(seasonData.players) ? seasonData.players : null;
  if (playersList && userId) {
    const match = playersList.find((entry) => entry?.user_id === userId || entry?.userId === userId);
    const extracted = extractRatingRank(match, userId);
    if (extracted) return extracted;
  }

  const ladderList = Array.isArray(seasonData.ladder) ? seasonData.ladder : null;
  if (ladderList && userId) {
    const match = ladderList.find((entry) => entry?.user_id === userId || entry?.userId === userId);
    const extracted = extractRatingRank(match, userId);
    if (extracted) return extracted;
  }

  const fallback = extractRatingRank(seasonData, userId);
  return fallback || null;
};

const getCurrentRating = () => {
  const rating = normalizeNumber(gameContext.queueState?.rating);
  if (rating !== null && rating > 0) return rating;
  const seasonRating = normalizeNumber(gameContext.seasonPlayerStats?.rating);
  return seasonRating !== null ? seasonRating : null;
};

const getCurrentRank = () => {
  const seasonRank = normalizeNumber(gameContext.seasonPlayerStats?.rank);
  return seasonRank !== null ? seasonRank : null;
};

function ensureSessionActive(reason) {
  const userId = gameContext.profile?.userId || null;
  if (!userId) return;
  const existing = sessionTracker.getSession(userId);
  if (existing?.active) return;
  const rating = getCurrentRating();
  const rank = getCurrentRank();
  const session = sessionTracker.startSession(userId, { rating, rank });
  if (session) {
    log(`[Session] Auto-started session for user ${userId}${reason ? ` (${reason})` : ''}`);
  }
}

const normalizeItems = (items) => ({
  common: ensureArray(items?.common),
  rare: ensureArray(items?.rare),
  epic: ensureArray(items?.epic),
  legendary: ensureArray(items?.legendary),
});

const normalizeBanEntry = (entry) => ({
  heroes: ensureArray(entry?.heroes),
  weapons: ensureArray(entry?.weapons),
  tomes: ensureArray(entry?.tomes),
  items: normalizeItems(entry?.items),
});

const normalizePlayerBanEntry = (entry, idKey, idValue) => ({
  ...(idKey ? { [idKey]: normalizeId(idValue || entry?.[idKey] || entry?.playerId || entry?.id || null) } : {}),
  heroes: ensureArray(entry?.heroes),
  weapons: ensureArray(entry?.weapons),
  tomes: ensureArray(entry?.tomes),
  items: normalizeItems(entry?.items),
});

function normalizeRoomBans(roomBans, roomMeta = gameContext.room.roomMeta) {
  if (!roomBans) {
    return {
      system: normalizeBanEntry(null),
      player1: normalizePlayerBanEntry(null, 'player1_id', roomMeta?.player1_id || null),
      player2: normalizePlayerBanEntry(null, 'player2_id', roomMeta?.player2_id || null),
    };
  }

  return {
    system: normalizeBanEntry(roomBans.system || roomBans.room || null),
    player1: normalizePlayerBanEntry(roomBans.player1 || roomBans.p1 || null, 'player1_id', roomMeta?.player1_id || null),
    player2: normalizePlayerBanEntry(roomBans.player2 || roomBans.p2 || null, 'player2_id', roomMeta?.player2_id || null),
  };
}

function detectAppliedRoomBans(roomBans, roomMeta = gameContext.room.roomMeta) {
  if (!roomBans) return null;
  const sourcePlayer1 = roomBans.player1 || roomBans.p1 || null;
  const sourcePlayer2 = roomBans.player2 || roomBans.p2 || null;

  const metaPlayer1_id = normalizeId(roomMeta?.player1_id ?? null);
  const metaPlayer2_id = normalizeId(roomMeta?.player2_id ?? null);

  const rawPlayer1_id = normalizeId(sourcePlayer1?.player1_id ?? sourcePlayer1?.playerId ?? sourcePlayer1?.id ?? null);
  const rawPlayer2_id = normalizeId(sourcePlayer2?.player2_id ?? sourcePlayer2?.playerId ?? sourcePlayer2?.id ?? null);

  if (rawPlayer1_id && metaPlayer1_id && rawPlayer1_id === metaPlayer1_id) return true;
  if (rawPlayer2_id && metaPlayer2_id && rawPlayer2_id === metaPlayer2_id) return true;

  if (rawPlayer1_id && metaPlayer2_id && rawPlayer1_id === metaPlayer2_id) return false;
  if (rawPlayer2_id && metaPlayer1_id && rawPlayer2_id === metaPlayer1_id) return false;

  return null;
}

function mapSourceBansToApplied(roomBans, roomMeta = gameContext.room.roomMeta) {
  if (!roomBans) return normalizeRoomBans(null, roomMeta);
  const applied = detectAppliedRoomBans(roomBans, roomMeta);
  if (applied === true) return normalizeRoomBans(roomBans, roomMeta);
  const sourcePlayer1 = roomBans.player1 || roomBans.p1 || null;
  const sourcePlayer2 = roomBans.player2 || roomBans.p2 || null;

  return {
    system: normalizeBanEntry(roomBans.system || roomBans.room || null),
    player1: normalizePlayerBanEntry(sourcePlayer2, 'player1_id', roomMeta?.player1_id || null),
    player2: normalizePlayerBanEntry(sourcePlayer1, 'player2_id', roomMeta?.player2_id || null),
  };
}

function swapRoomMetaPlayers(roomMeta) {
  if (!roomMeta) return roomMeta;
  return {
    ...roomMeta,
    player1_id: roomMeta.player2_id || null,
    player2_id: roomMeta.player1_id || null,
    player1Profile: roomMeta.player2Profile || null,
    player2Profile: roomMeta.player1Profile || null,
    player1ReadyBanSelection: roomMeta.player2ReadyBanSelection || null,
    player2ReadyBanSelection: roomMeta.player1ReadyBanSelection || null,
    player1GameStatus: roomMeta.player2GameStatus || null,
    player2GameStatus: roomMeta.player1GameStatus || null,
    player1RunHasData: roomMeta.player2RunHasData || null,
    player2RunHasData: roomMeta.player1RunHasData || null,
  };
}

function swapRoomBans(roomBans, nextMeta) {
  if (!roomBans) return roomBans;
  const player1 = roomBans.player2 || { ...EMPTY_ROOM_BANS.player1 };
  const player2 = roomBans.player1 || { ...EMPTY_ROOM_BANS.player2 };
  return {
    ...roomBans,
    player1: { ...player1, player1_id: nextMeta?.player1_id || player1?.player1_id || null },
    player2: { ...player2, player2_id: nextMeta?.player2_id || player2?.player2_id || null },
  };
}

function alignRoomMetaToCurrentUser(roomMeta, roomBans) {
  const currentUserId = gameContext.profile?.userId || null;
  if (!currentUserId || !roomMeta?.player1_id || !roomMeta?.player2_id) {
    return { roomMeta, roomBans, swapped: false };
  }
  if (currentUserId === roomMeta.player1_id) {
    return { roomMeta, roomBans, swapped: false };
  }
  if (currentUserId === roomMeta.player2_id) {
    const swappedMeta = swapRoomMetaPlayers(roomMeta);
    const swappedBans = swapRoomBans(roomBans, swappedMeta);
    return { roomMeta: swappedMeta, roomBans: swappedBans, swapped: true };
  }
  return { roomMeta, roomBans, swapped: false };
}

function updateRoomMetaFromData(roomData) {
  if (!roomData || typeof roomData !== 'object') return;
  const incomingRoomId = roomData.room_id || roomData.roomId || gameContext.room.roomMeta.roomId;
  const isRoomChange = !!incomingRoomId && incomingRoomId !== gameContext.room.roomMeta.roomId;
  const baseMeta = isRoomChange ? { ...EMPTY_ROOM_META } : gameContext.room.roomMeta;

  const incomingPhase = roomData.phase || baseMeta.phase;
  const incomingWinner = roomData.winner_id || roomData.winnerId;
  const resolvedWinner = incomingWinner !== undefined && incomingWinner !== null
    ? incomingWinner
    : (incomingPhase && incomingPhase !== 'ended' ? null : baseMeta.winnerId);

  let nextRoomMeta = {
    roomId: incomingRoomId,
    lobbyNumber: roomData.lobby_number || roomData.lobbyNumber || baseMeta.lobbyNumber,
    queueType: roomData.queue_type || roomData.queueType || baseMeta.queueType,
    status: roomData.status || baseMeta.status,
    phase: incomingPhase,
    map: roomData.map || baseMeta.map,
    winnerId: resolvedWinner,
    player1_id: roomData.player1_id || baseMeta.player1_id,
    player2_id: roomData.player2_id || baseMeta.player2_id,
    player1Profile: roomData.player1_profile || baseMeta.player1Profile,
    player2Profile: roomData.player2_profile || baseMeta.player2Profile,
    gamePhaseStartedAt: roomData.game_phase_started_at || baseMeta.gamePhaseStartedAt,
    player1ReadyBanSelection: roomData.player1_ready_ban_selection || baseMeta.player1ReadyBanSelection,
    player2ReadyBanSelection: roomData.player2_ready_ban_selection || baseMeta.player2ReadyBanSelection,
    currentPlayerReadyBanSelection: roomData.current_player_ready_ban_selection || baseMeta.currentPlayerReadyBanSelection,
    player1GameStatus: roomData.player1_game_status || baseMeta.player1GameStatus,
    player2GameStatus: roomData.player2_game_status || baseMeta.player2GameStatus,
    currentPlayerGameStatus: roomData.current_player_game_status || baseMeta.currentPlayerGameStatus,
    player1RunHasData: roomData.player1_run?.game_data != null
      ? true
      : (roomData.player1_run ? false : baseMeta.player1RunHasData),
    player2RunHasData: roomData.player2_run?.game_data != null
      ? true
      : (roomData.player2_run ? false : baseMeta.player2RunHasData),
  };

  const aligned = alignRoomMetaToCurrentUser(nextRoomMeta, gameContext.room.roomBans);
  nextRoomMeta = aligned.roomMeta;
  let nextRoomBans = aligned.roomBans || gameContext.room.roomBans;
  gameContext.room.roomMeta = nextRoomMeta;

  const resolvedRoomId = incomingRoomId || gameContext.room.roomMeta.roomId;

  const shouldClearBans = incomingPhase === 'ended'
    || gameContext.room.roomMeta.status === 'ended'
    || gameContext.room.roomMeta.status === 'cancelled';

  if (shouldClearBans) {
    gameContext.room.roomBans = { ...EMPTY_ROOM_BANS };
  } else if (roomData.room_bans) {
    const normalizedBans = mapSourceBansToApplied(roomData.room_bans, gameContext.room.roomMeta);
    gameContext.room.roomBans = normalizedBans;
  } else if (aligned.swapped && nextRoomBans) {
    gameContext.room.roomBans = nextRoomBans;
  }

  if (resolvedRoomId) {
    cacheRoomBundle(
      resolvedRoomId,
      buildRoomBundle({ activeRoom: resolvedRoomId }),
      roomData
    );
  }

  gameContext.lastUpdated.room = Date.now();
}

function updateQueueState(partial) {
  if (!partial || typeof partial !== 'object') return;
  const prevRating = normalizeNumber(gameContext.queueState?.rating);
  gameContext.queueState = {
    ...gameContext.queueState,
    ...partial,
    lastEvent: partial.lastEvent || gameContext.queueState.lastEvent,
  };
  gameContext.lastUpdated.queue = Date.now();

  const userId = gameContext.profile?.userId || null;
  const nextRating = normalizeNumber(gameContext.queueState?.rating);
  if (userId && nextRating !== null && prevRating !== nextRating) {
    sessionTracker.applyRatingChange(userId, {
      rating: nextRating,
      rank: getCurrentRank(),
      roomMeta: gameContext.room.roomMeta,
    });
  }
}

function resolveMatchRatingDelta({ eventData, currentUserId, roomMeta, winnerId }) {
  if (!eventData || !currentUserId || !roomMeta) return null;
  const isParticipant = roomMeta.player1_id === currentUserId || roomMeta.player2_id === currentUserId;
  if (!isParticipant) return null;

  const delta1 = normalizeNumber(eventData.player1_rating_change);
  const delta2 = normalizeNumber(eventData.player2_rating_change);
  const deltas = [delta1, delta2].filter((value) => Number.isFinite(value));
  if (deltas.length === 0) return null;

  const positiveDelta = deltas.find((value) => value > 0) ?? null;
  const negativeDelta = deltas.find((value) => value < 0) ?? null;

  if (winnerId && winnerId === currentUserId) {
    return positiveDelta ?? deltas[0];
  }
  if (winnerId && winnerId !== currentUserId) {
    return negativeDelta ?? deltas[0];
  }

  return deltas[0];
}

function applyPlayerBansUpdate(roomId, bans) {
  if (!bans || typeof bans !== 'object') return;
  if (roomId && gameContext.room.roomMeta.roomId && roomId !== gameContext.room.roomMeta.roomId) return;

  const currentUser_id = gameContext.profile?.userId;
  let target = null;
  if (currentUser_id && gameContext.room.roomMeta.player1_id && gameContext.room.roomMeta.player2_id) {
    if (currentUser_id === gameContext.room.roomMeta.player1_id) target = 'player1';
    else if (currentUser_id === gameContext.room.roomMeta.player2_id) target = 'player2';
  }

  if (!target) return;

  const appliedTarget = target === 'player1' ? 'player1' : 'player2';
  const idKey = appliedTarget === 'player1' ? 'player1_id' : 'player2_id';
  const idValue = appliedTarget === 'player1'
    ? gameContext.room.roomMeta.player1_id
    : gameContext.room.roomMeta.player2_id;
  const normalizedEntry = normalizePlayerBanEntry(bans, idKey, idValue);
  gameContext.room.roomBans = {
    ...gameContext.room.roomBans,
    [appliedTarget]: normalizedEntry,
  };
  const activeRoomId = gameContext.room.roomMeta.roomId || gameContext.room.activeRoom;
  if (activeRoomId) {
    cacheRoomBundle(activeRoomId, buildRoomBundle({ activeRoom: activeRoomId }));
  }
  gameContext.lastUpdated.room = Date.now();
  broadcastContextUpdate('game');
}

function processFinderEvent(eventData) {
  if (!eventData || typeof eventData !== 'object') return;

  switch (eventData.event) {
    case 'queue_joined':
      updateQueueState({
        inQueue: true,
        queueType: eventData.queue_type || null,
        seasonId: eventData.season_id || null,
        rating: eventData.rating || 0,
        queueSize: eventData.queue_size || 0,
        elapsedTime: eventData.elapsed_time || 0,
        status: 'searching',
        proposalId: null,
        matchTimeout: null,
        playerAccepted: false,
        opponentAccepted: false,
        declinedBy: null,
        message: eventData.message || null,
        lastEvent: 'queue_joined',
      });
      broadcastContextUpdate('game');
      break;
    case 'queue_left':
      updateQueueState({
        inQueue: false,
        status: 'idle',
        proposalId: null,
        matchTimeout: null,
        playerAccepted: false,
        opponentAccepted: false,
        declinedBy: null,
        message: eventData.message || null,
        lastEvent: 'queue_left',
      });
      broadcastContextUpdate('game');
      break;
    case 'match_found':
      updateQueueState({
        inQueue: false,
        status: 'match_found',
        proposalId: eventData.proposal_id || null,
        matchTimeout: eventData.timeout || null,
        playerAccepted: false,
        opponentAccepted: false,
        declinedBy: null,
        message: eventData.message || null,
        lastEvent: 'match_found',
      });
      broadcastContextUpdate('game');
      break;
    case 'opponent_accepted':
      updateQueueState({
        proposalId: eventData.proposal_id || null,
        opponentAccepted: true,
        message: eventData.message || null,
        lastEvent: 'opponent_accepted',
      });
      broadcastContextUpdate('game');
      break;
    case 'match_accept_pending':
      updateQueueState({
        status: 'accept_pending',
        proposalId: eventData.proposal_id || null,
        message: eventData.message || null,
        lastEvent: 'match_accept_pending',
      });
      broadcastContextUpdate('game');
      break;
    case 'match_cancelled':
      updateQueueState({
        inQueue: false,
        status: 'match_cancelled',
        proposalId: eventData.proposal_id || null,
        matchTimeout: null,
        declinedBy: eventData.declined_by || eventData.declinedBy || null,
        message: eventData.reason || eventData.message || null,
        lastEvent: 'match_cancelled',
      });
      broadcastContextUpdate('game');
      break;
    case 'match_confirmed':
      updateQueueState({
        inQueue: false,
        status: 'match_confirmed',
        proposalId: eventData.proposal_id || null,
        playerAccepted: true,
        opponentAccepted: true,
        declinedBy: null,
        message: eventData.message || null,
        lastEvent: 'match_confirmed',
      });
      if (eventData.room_id) {
        gameContext.room.activeRoom = eventData.room_id;
        updateRoomMetaFromData({ room_id: eventData.room_id, lobby_number: eventData.lobby_number });
        const cachedRoomRaw = getCachedRoomRaw(eventData.room_id);
        if (cachedRoomRaw) {
          updateRoomMetaFromData(cachedRoomRaw);
        }
      }
      broadcastContextUpdate('game');
      break;
    default:
      break;
  }
}

function processPlayerChannelEvent(eventData) {
  if (!eventData || typeof eventData !== 'object') return;

  switch (eventData.event) {
    case 'room_update':
    case 'room_updated':
      if (eventData.room) {
        updateRoomMetaFromData(eventData.room);
        gameContext.room.activeRoom = eventData.room.room_id || gameContext.room.activeRoom;
        broadcastContextUpdate('game');
      }
      break;
    case 'opponent_bans_updated': {
      const roomId = eventData.room_id || gameContext.room.activeRoom;
      if (roomId) {
        const cachedRoomRaw = getCachedRoomRaw(roomId);
        if (cachedRoomRaw) {
          updateRoomMetaFromData(cachedRoomRaw);
        } else {
          updateRoomMetaFromData({ room_id: roomId, phase: 'ban_selection' });
        }
        broadcastContextUpdate('game');
      }
      break;
    }
    case 'match_start':
      if (eventData.room) {
        updateRoomMetaFromData(eventData.room);
      } else {
        updateRoomMetaFromData({
          room_id: eventData.room_id,
          phase: eventData.phase,
          status: eventData.status,
          map: eventData.map,
          player1_id: eventData.player1_id,
          player2_id: eventData.player2_id,
          game_phase_started_at: eventData.game_phase_started_at,
        });
      }

      if (eventData.bans) {
        const currentUser_id = gameContext.profile?.userId;
        const player1_id = gameContext.room.roomMeta.player1_id;
        const player2_id = gameContext.room.roomMeta.player2_id;
        const bansPayload = eventData.bans;

        if (bansPayload.system) {
          gameContext.room.roomBans = {
            ...gameContext.room.roomBans,
            system: normalizeRoomBans({ system: bansPayload.system }).system,
          };
        }

        const fromPlayerRaw = bansPayload.from_player || bansPayload.player1 || null;
        const fromOpponentRaw = bansPayload.from_opponent || bansPayload.player2 || null;

        if (bansPayload.player1 || bansPayload.player2) {
                const mappedBans = mapSourceBansToApplied({ player1: bansPayload.player1 || {}, player2: bansPayload.player2 || {} }, gameContext.room.roomMeta);
                gameContext.room.roomBans = { ...gameContext.room.roomBans, player1: mappedBans.player1, player2: mappedBans.player2 };
        } else if (currentUser_id && player1_id && player2_id) {
          if (fromPlayerRaw || fromOpponentRaw) {
                  const fromPlayer = normalizePlayerBanEntry(fromPlayerRaw || {}, 'player1_id', gameContext.room.roomMeta.player1_id);
                  const fromOpponent = normalizePlayerBanEntry(fromOpponentRaw || {}, 'player2_id', gameContext.room.roomMeta.player2_id);

                  if (currentUser_id === player1_id) {
                    gameContext.room.roomBans = { ...gameContext.room.roomBans, player1: fromOpponent, player2: fromPlayer };
                  } else if (currentUser_id === player2_id) {
                    gameContext.room.roomBans = { ...gameContext.room.roomBans, player1: fromPlayer, player2: fromOpponent };
                  }
          }
        }

        const roomId = gameContext.room.roomMeta.roomId || eventData.room_id || gameContext.room.activeRoom;
        if (roomId) {
          cacheRoomBundle(roomId, buildRoomBundle({ activeRoom: roomId }));
          broadcastToType(CLIENT_TYPE.SPA, {
            type: 'room-data-available',
            roomId: roomId,
            timestamp: Date.now(),
          });
        }
        gameContext.lastUpdated.room = Date.now();
      }
      broadcastContextUpdate('game');
      break;
    default:
      break;
  }
}

/**
 * Process API response and update game context
 */
function processApiResponse(message) {
  const event = message.event;
  if (!event || event.type !== 'API_RESPONSE' || event.status !== 200) {
    return;
  }
  
  const url = event.url || '';
  const data = event.data?.value;
  
  if (!data) return;
  
  // Detect API endpoint and process accordingly
  if (url.match(/\/api\/players\/\d+\/seasons/)) {
    processPlayerSeasonsData(data);
  } else if (url.includes('/api/heroes')) {
    processHeroesData(data);
  } else if (url.includes('/api/weapons')) {
    processWeaponsData(data);
  } else if (url.includes('/api/tomes')) {
    processTomesData(data);
  } else if (url.includes('/api/items')) {
    processItemsData(data);
  } else if (url.includes('/api/seasons/active')) {
    processActiveSeasonData(data);
  } else if (url.includes('/api/seasons/all')) {
    processAllSeasonsData(data);
  } else if (url.includes('/api/friends')) {
    processFriendsData(data);
  } else if (url.includes('/api/profile')) {
    processProfileData(data);
  } else if (url.includes('/api/i18n/translations')) {
    processTranslationsData(data);
  } else if (url.match(/\/api\/room\/active(\/\d+)?/)) {
    processActiveRoomData(data);
  } else if (url.match(/\/api\/room\/[a-zA-Z0-9-]+(\?.*)?$/)) {
    // Extract room ID from URL (supports query params) and cache the room data
    const roomIdMatch = url.match(/\/api\/room\/([a-zA-Z0-9-]+)(\?.*)?$/);
    if (roomIdMatch) {
      processRoomApiData(roomIdMatch[1], data);
    }
  }
}

function processActiveRoomData(data) {
  const activeRoom = data?.active_room || data?.activeRoom || null;
  if (!activeRoom) return;

  updateRoomMetaFromData(activeRoom);
  if (activeRoom.room_id) {
    const normalizedBans = activeRoom.room_bans
      ? mapSourceBansToApplied(activeRoom.room_bans, gameContext.room.roomMeta)
      : gameContext.room.roomBans;
    const normalizedPlayers = normalizeRoomPlayers(activeRoom.players);
    if (normalizedPlayers.length > 0 && (gameContext.room.activeRoom === activeRoom.room_id || !gameContext.room.activeRoom)) {
      gameContext.room.players.clear();
      normalizedPlayers.forEach(playerState => {
        gameContext.room.players.set(playerState.playerId, playerState);
      });
    }
    gameContext.room.activeRoom = activeRoom.room_id;
    const roomBundle = buildRoomBundle({
      activeRoom: activeRoom.room_id,
      players: normalizedPlayers,
      roomMeta: gameContext.room.roomMeta,
      roomBans: normalizedBans,
    });
    cacheRoomBundle(activeRoom.room_id, roomBundle, activeRoom);
  }

  broadcastContextUpdate('game');
}

function processHeroesData(data) {
  const heroes = data.heroes || data;
  if (!Array.isArray(heroes)) return;
  
  gameContext.heroes.clear();
  heroes.forEach(hero => {
    gameContext.heroes.set(hero.ingameId, {
      id: hero.id,
      ingameId: hero.ingameId,
      name: hero.name,
      imageSrc: hero.imageSrc,
      weaponId: hero.weaponId,
      weaponName: hero.weaponName
    });
  });
  gameContext.lastUpdated.heroes = Date.now();
  log(`[GameContext] Updated heroes: ${gameContext.heroes.size} entries`);
  broadcastContextUpdate('entities');
}

function processWeaponsData(data) {
  const weapons = data.weapons || data;
  if (!Array.isArray(weapons)) return;
  
  gameContext.weapons.clear();
  weapons.forEach(weapon => {
    gameContext.weapons.set(weapon.ingameId, {
      id: weapon.id,
      ingameId: weapon.ingameId,
      name: weapon.name,
      imageSrc: weapon.imageSrc
    });
  });
  gameContext.lastUpdated.weapons = Date.now();
  log(`[GameContext] Updated weapons: ${gameContext.weapons.size} entries`);
  broadcastContextUpdate('entities');
}

function processTomesData(data) {
  const tomes = data.tomes || data;
  if (!Array.isArray(tomes)) return;
  
  gameContext.tomes.clear();
  tomes.forEach(tome => {
    gameContext.tomes.set(tome.ingameId, {
      id: tome.id,
      ingameId: tome.ingameId,
      name: tome.name,
      imageSrc: tome.imageSrc
    });
  });
  gameContext.lastUpdated.tomes = Date.now();
  log(`[GameContext] Updated tomes: ${gameContext.tomes.size} entries`);
  broadcastContextUpdate('entities');
}

function processItemsData(data) {
  const items = data.items || data;
  if (!Array.isArray(items)) return;
  
  gameContext.items.clear();
  items.forEach(item => {
    gameContext.items.set(item.ingameId, {
      id: item.id,
      ingameId: item.ingameId,
      name: item.name,
      imageSrc: item.imageSrc,
      rarity: item.rarity
    });
  });
  gameContext.lastUpdated.items = Date.now();
  log(`[GameContext] Updated items: ${gameContext.items.size} entries`);
  broadcastContextUpdate('entities');
}

function processActiveSeasonData(data) {
  const seasons = Array.isArray(data) ? data : [data];
  const activeSeason = seasons.find(s => s.is_active || s.is_current) || seasons[0];
  
  if (!activeSeason) return;
  
  gameContext.activeSeason = {
    id: activeSeason.id,
    name: activeSeason.name,
    startDate: activeSeason.start_date,
    endDate: activeSeason.end_date,
    previewImage: activeSeason.preview_image,
    isActive: activeSeason.is_active,
    isCurrent: activeSeason.is_current,
    timeLimit: activeSeason.time_limit,
    pauseLimit: activeSeason.pause_limit,
    mapSelectionType: activeSeason.map_selection_type,
    seasonMaps: activeSeason.season_maps || []
  };

  const currentUserId = gameContext.profile?.userId || null;
  const playerStats = resolveSeasonPlayerStats(activeSeason, currentUserId);
  if (playerStats) {
    gameContext.seasonPlayerStats = {
      rating: playerStats.rating || null,
      rank: playerStats.rank || null,
      userId: playerStats.userId || currentUserId,
      seasonId: activeSeason.id,
      updatedAt: Date.now(),
    };
    ensureSessionActive('active-season');
    if (currentUserId) {
      sessionTracker.applyRatingChange(currentUserId, {
        rating: playerStats.rating || null,
        rank: playerStats.rank || null,
        roomMeta: gameContext.room.roomMeta,
      });
    }
  }
  
  // Update bans
  gameContext.bans = {
    disabledHeroes: (activeSeason.disabled_heroes || []).map(h => ({
      ingameId: h.ingameId,
      name: h.name,
      imageSrc: h.imageSrc
    })),
    disabledWeapons: (activeSeason.disabled_weapons || []).map(w => ({
      ingameId: w.ingameId,
      name: w.name,
      imageSrc: w.imageSrc
    })),
    disabledTomes: (activeSeason.disabled_tomes || []).map(t => ({
      ingameId: t.ingameId,
      name: t.name,
      imageSrc: t.imageSrc
    })),
    disabledItems: (activeSeason.disabled_items || []).map(i => ({
      ingameId: i.ingameId,
      name: i.name,
      imageSrc: i.imageSrc,
      rarity: i.rarity
    })),
    bannableHeroes: (activeSeason.bannable_heroes || []).map(h => ({
      ingameId: h.ingameId,
      name: h.name,
      imageSrc: h.imageSrc
    })),
    bannableWeapons: (activeSeason.bannable_weapons || []).map(w => ({
      ingameId: w.ingameId,
      name: w.name,
      imageSrc: w.imageSrc
    })),
    bannableTomes: (activeSeason.bannable_tomes || []).map(t => ({
      ingameId: t.ingameId,
      name: t.name,
      imageSrc: t.imageSrc
    })),
    bannableItems: (activeSeason.bannable_items || []).map(i => ({
      ingameId: i.ingameId,
      name: i.name,
      imageSrc: i.imageSrc,
      rarity: i.rarity
    })),
    playerBanExcludedHeroes: activeSeason.player_ban_excluded_heroes || [],
    playerBanExcludedWeapons: activeSeason.player_ban_excluded_weapons || [],
    playerBanExcludedTomes: activeSeason.player_ban_excluded_tomes || [],
    playerBanExcludedItems: activeSeason.player_ban_excluded_items || []
  };
  
  gameContext.lastUpdated.season = Date.now();
  log(`[GameContext] Updated active season: ${activeSeason.name}`);
  log(`[GameContext] Bans - Heroes: ${gameContext.bans.disabledHeroes.length} disabled, ${gameContext.bans.bannableHeroes.length} bannable`);
  broadcastContextUpdate('season');
}

function processAllSeasonsData(data) {
  const seasons = Array.isArray(data) ? data : [data];
  
  gameContext.allSeasons = seasons.map(season => ({
    id: season.id,
    name: season.name,
    startDate: season.start_date,
    endDate: season.end_date,
    previewImage: season.preview_image,
    isActive: season.is_active,
    isCurrent: season.is_current,
    timeLimit: season.time_limit,
    pauseLimit: season.pause_limit,
    mapSelectionType: season.map_selection_type
  }));
  
  gameContext.lastUpdated.allSeasons = Date.now();
  log(`[GameContext] Updated all seasons: ${gameContext.allSeasons.length} seasons`);
  broadcastContextUpdate('seasons');
}

function processPlayerSeasonsData(data) {
  const seasonsPayload = Array.isArray(data)
    ? data
    : (Array.isArray(data?.seasons) ? data.seasons : []);

  if (!Array.isArray(seasonsPayload) || seasonsPayload.length === 0) return;

  const activeSeason = seasonsPayload.find(s => s?.is_active || s?.is_current)
    || (gameContext.activeSeason?.id
      ? seasonsPayload.find(s => s?.id === gameContext.activeSeason.id)
      : null)
    || seasonsPayload[0];

  if (!activeSeason) return;

  const currentUserId = gameContext.profile?.userId || null;
  const playerStats = resolveSeasonPlayerStats(activeSeason, currentUserId);

  if (!playerStats) return;

  gameContext.seasonPlayerStats = {
    rating: playerStats.rating || null,
    rank: playerStats.rank || null,
    userId: playerStats.userId || currentUserId,
    seasonId: activeSeason.id || null,
    updatedAt: Date.now(),
  };

  gameContext.lastUpdated.seasonPlayerStats = Date.now();

  ensureSessionActive('player-seasons');
  if (currentUserId) {
    sessionTracker.applyRatingChange(currentUserId, {
        rating: playerStats.rating || null,
        rank: playerStats.rank || null,
      roomMeta: gameContext.room.roomMeta,
    });
  }

  log(`[GameContext] Updated player season stats: season=${activeSeason.name || activeSeason.id} rating=${playerStats.rating || 'n/a'} rank=${playerStats.rank || 'n/a'}`);
  broadcastContextUpdate('season');
}

function processFriendsData(data) {
  gameContext.friends = (data.friends || []).map(friend => ({
    id: friend.id,
    userId: friend.user_id,
    nickname: friend.nickname,
    avatar: friend.avatar,
    country: friend.country,
    megaPoints: friend.mega_points,
    friendCode: friend.friend_code,
    status: friend.status,
    isInitiator: friend.is_initiator,
    twitchUrl: friend.twitch_url,
    onlineStatus: friend.online_status,
    player: friend.player ? {
      rating: friend.player.rating,
      totalRuns: friend.player.total_runs,
      successfulRuns: friend.player.successful_runs,
      totalKills: friend.player.total_kills,
      totalDeaths: friend.player.total_deaths,
      bestTier: friend.player.best_tier
    } : null
  }));
  
  gameContext.pendingFriends = data.pending || [];
  
  gameContext.lastUpdated.friends = Date.now();
  log(`[GameContext] Updated friends: ${gameContext.friends.length} friends, ${gameContext.pendingFriends.length} pending`);
  broadcastContextUpdate('friends');
}

function processProfileData(data) {
  if (!data || typeof data !== 'object') return;

  const userId = data.user_id;
  if (userId === undefined || userId === null) return;

  const profile = {
    id: data.id,
    userId: data.user_id,
    nickname: data.nickname,
    avatar: data.avatar,
    country: data.country,
    registrationDate: data.registration_date,
    hoursPlayed: data.hours_played,
    megaPoints: data.mega_points,
    friendCode: data.friend_code,
    isStreamerMode: data.is_streamer_mode,
    twitchUrl: data.twitch_url,
    nicknameChangedAt: data.nickname_changed_at,
    canChangeNickname: data.can_change_nickname,
    daysUntilNicknameChange: data.days_until_nickname_change,
    avatarChangedAt: data.avatar_changed_at,
    canChangeAvatar: data.can_change_avatar,
    daysUntilAvatarChange: data.days_until_avatar_change,
    badgeSettings: data.badge_settings,
    achievementShowcaseSettings: data.achievement_showcase_settings,
    selectedBackground: data.selected_background,
    selectedSignature: data.selected_signature
  };

  gameContext.profile = profile;
  gameContext.lastUpdated.profile = Date.now();
  log(`[GameContext] Updated profile: user_id=${userId} nickname=${profile.nickname}`);
  const alignedRoom = alignRoomMetaToCurrentUser(gameContext.room.roomMeta, gameContext.room.roomBans);
  if (alignedRoom.swapped) {
    gameContext.room.roomMeta = alignedRoom.roomMeta;
    if (alignedRoom.roomBans) {
      gameContext.room.roomBans = alignedRoom.roomBans;
    }
    gameContext.lastUpdated.room = Date.now();
    const activeRoomId = gameContext.room.roomMeta.roomId || gameContext.room.activeRoom;
    if (activeRoomId) {
      cacheRoomBundle(activeRoomId, buildRoomBundle({ activeRoom: activeRoomId }));
    }
  }
  ensureSessionActive('profile');
  ensureExtensionRefreshFromAny('profile-updated');
  broadcastContextUpdate('profile');
}

function processTranslationsData(data) {
  // expected shape: { language: 'en', translations: { ... } }
  if (!data || typeof data !== 'object') return;
  const lang = data.language || (data?.translations && data.translations.language) || null;
  const translations = data.translations || null;
  if (!lang || !translations) return;

  gameContext.translations[lang] = translations;
  gameContext.lastUpdated.translations = Date.now();
  log(`[GameContext] Updated translations: lang=${lang} keys=${Object.keys(translations).length}`);
  broadcastContextUpdate('translations');
}

function normalizeRoomPlayers(roomPlayers) {
  const list = Array.isArray(roomPlayers) ? roomPlayers : [];
  const normalizedPlayers = [];

  list.forEach(player => {
    const playerId = player.player_id || player.id;
    if (!playerId) return;

    const runData = player.run_data || player;
    if (!runData) return;

    const resolvedRunData = resolveRunDataNames(runData);

    const playerState = {
      playerId: playerId,
      status: runData.status || 'in_progress',
      timeElapsed: runData.time_elapsed_seconds || runData.time_elapsed || 0,
      isPaused: runData.is_paused || false,
      pauseTime: runData.pause_time || 0,
      startedAt: Date.now(),
      lastUpdated: Date.now(),

      character: {
        id: runData.character?.id,
        name: resolvedRunData.characterName,
        level: runData.character?.level,
        stats: runData.character?.stats
      },

      equipment: {
        weapons: resolvedRunData.weapons,
        tomes: resolvedRunData.tomes,
        items: resolvedRunData.items
      },

      combat: {
        killCount: runData.kill_count || runData.combat?.kill_count,
        currentGold: runData.combat?.current_gold,
        totalDamageDealt: runData.combat?.total_damage_dealt,
        totalDamageTaken: runData.combat?.total_damage_taken,
        chests: runData.combat?.chests,
        shrines: runData.combat?.shrines,
        shadyGuys: runData.combat?.shady_guys,
        portalsEntered: runData.combat?.portals_entered || runData.combat?.game_stats?.portals_entered,
        microwavesActivated: runData.combat?.microwaves_activated || runData.combat?.microwaves || runData.combat?.game_stats?.microwaves_activated,
        boomboxesActivated: runData.combat?.boomboxes_activated,
        gameStats: runData.combat?.game_stats,
        damageSources: runData.combat?.damage_sources
      },

      map: runData.map ? {
        id: runData.map.id,
        tier: runData.map.tier,
        stage: runData.map.stage
      } : null,
    };

    normalizedPlayers.push(playerState);
  });

  return normalizedPlayers;
}

/**
 * Process /api/room/{room_id} response and cache it
 * This provides initial game state when joining/switching rooms
 */
function processRoomApiData(roomId, data) {
  if (!data || typeof data !== 'object') return;
  updateRoomMetaFromData(data);

  const normalizedPlayers = normalizeRoomPlayers(data.players);

  if (normalizedPlayers.length > 0 && (gameContext.room.activeRoom === roomId || !gameContext.room.activeRoom)) {
    normalizedPlayers.forEach(playerState => {
      gameContext.room.players.set(playerState.playerId, playerState);
    });
  }

  const roomBundle = buildRoomBundle({
    activeRoom: roomId,
    players: normalizedPlayers,
    roomMeta: gameContext.room.roomMeta,
    roomBans: gameContext.room.roomBans,
  });
  cacheRoomBundle(roomId, roomBundle, data);

  log(`[GameContext] Cached room API data: roomId=${roomId}`);

  broadcastToType(CLIENT_TYPE.SPA, {
    type: 'room-data-available',
    roomId: roomId,
    timestamp: Date.now(),
  });

  if (gameContext.room.activeRoom === roomId || !gameContext.room.activeRoom) {
    if (normalizedPlayers.length > 0) {
      gameContext.room.activeRoom = roomId;
      gameContext.lastUpdated.game = Date.now();
      log(`[GameContext] Populated ${normalizedPlayers.length} players from room API for room ${roomId}`);
    }
    broadcastContextUpdate('game');
  }

  broadcastContextUpdate('game');
}

/**
 * Process WebSocket event and update active game state
 */
function processWsEvent(message) {
  const event = message.event;
  if (!event || event.type !== 'WS_EVENT') {
    return;
  }
  
  const url = event.url || '';
  if (!url.includes('game.megabonk.su')) return;
  
  // Parse WebSocket message data
  let wsData;
  try {
    if (event.data?.type === 'string' && event.data?.value) {
      wsData = JSON.parse(event.data.value);
    } else if (event.data?.value) {
      wsData = event.data.value;
    }
  } catch (e) {
    return;
  }
  
  if (!wsData) return;
  
  // Handle outgoing subscribe/unsubscribe events (direction: 'out')
  if (event.direction === 'out') {
    if (wsData.connect?.name === 'js' && wsData.connect?.data?.token) {
      const activeRoomId = gameContext.room.activeRoom;
      if (activeRoomId) {
        log('[GameContext] WS reconnect detected; treating as room unsubscribe');
        handleRoomUnsubscribe(activeRoomId);
      }
      return;
    }

    // Handle subscribe events - new room joined
    if (wsData.subscribe?.channel?.startsWith('gamesync:room:')) {
      const roomId = wsData.subscribe.channel.replace('gamesync:room:', '');
      handleRoomSubscribe(roomId);
      return;
    }
    
    // Handle unsubscribe events - room left
    if (wsData.unsubscribe?.channel?.startsWith('gamesync:room:')) {
      const roomId = wsData.unsubscribe.channel.replace('gamesync:room:', '');
      handleRoomUnsubscribe(roomId);
      return;
    }

    if (wsData.rpc?.method === 'match_accept') {
      updateQueueState({
        status: gameContext.queueState.status === 'match_found' ? 'accept_pending' : gameContext.queueState.status,
        proposalId: wsData.rpc?.data?.proposal_id || gameContext.queueState.proposalId || null,
        playerAccepted: true,
        declinedBy: null,
        lastEvent: 'match_accept',
      });
      broadcastContextUpdate('game');
      return;
    }

    if (wsData.rpc?.method === 'match_decline') {
      const currentUserId = gameContext.profile?.userId || null;
      updateQueueState({
        inQueue: false,
        status: 'match_cancelled',
        proposalId: wsData.rpc?.data?.proposal_id || gameContext.queueState.proposalId || null,
        matchTimeout: null,
        declinedBy: currentUserId,
        message: 'declined',
        lastEvent: 'match_decline',
      });
      broadcastContextUpdate('game');
      return;
    }
    
    // Don't process other outgoing events for game state
    return;
  }
  
  // Only process incoming events (direction: 'in') for game state updates
  if (event.direction !== 'in') {
    return;
  }

  // Handle RPC responses with event data
  if (wsData.rpc?.data) {
    const rpcData = wsData.rpc.data;
    if (rpcData.event) {
      if (['queue_joined', 'queue_left', 'match_found', 'match_accept_pending', 'match_confirmed', 'match_cancelled'].includes(rpcData.event)) {
        processFinderEvent(rpcData);
      }
      if (rpcData.event === 'bans_updated') {
        applyPlayerBansUpdate(rpcData.room_id, rpcData.bans);
      }
      if (rpcData.event === 'bans_confirmed') {
        updateRoomMetaFromData({
          room_id: rpcData.room_id,
          phase: rpcData.phase,
          player1_ready_ban_selection: rpcData.player1_ready,
          player2_ready_ban_selection: rpcData.player2_ready,
        });
        broadcastContextUpdate('game');
      }
    }

    // Handle queue status responses
    if (rpcData.in_queue !== undefined) {
      updateQueueState({
        inQueue: !!rpcData.in_queue,
        queueType: rpcData.queue_type || null,
        seasonId: rpcData.season_id || null,
        rating: rpcData.rating || 0,
        queueSize: rpcData.queue_size || 0,
        elapsedTime: rpcData.elapsed_time || 0,
        status: rpcData.in_queue ? 'searching' : 'idle',
        lastEvent: 'queue_status',
      });
      broadcastContextUpdate('game');
    }
  }
  
  // Handle push events (game sync channel) - incoming data
  if (wsData.push?.channel?.startsWith('gamesync:room:')) {
    processGameSyncEvent(wsData.push);
    return;
  }

  if (wsData.push?.channel?.startsWith('gamesync:player:')) {
    processPlayerChannelEvent(wsData.push?.pub?.data);
    return;
  }

  if (wsData.push?.channel?.startsWith('finder:player:')) {
    processFinderEvent(wsData.push?.pub?.data);
    return;
  }
}

/**
 * Handle room subscription - player joined a room
 */
function handleRoomSubscribe(roomId) {
  log(`[GameContext] Room subscribed: ${roomId}`);
  
  // Clear previous room data if switching rooms
  if (gameContext.room.activeRoom && gameContext.room.activeRoom !== roomId) {
    gameContext.room.players.clear();
  }
  
  gameContext.room.activeRoom = roomId;
  gameContext.lastUpdated.game = Date.now();

  const cachedRoomRaw = getCachedRoomRaw(roomId);
  const cachedRoomBundle = getCachedRoomBundle(roomId);
  if (cachedRoomRaw) {
    updateRoomMetaFromData(cachedRoomRaw);
    log(`[GameContext] Room subscribe: using cached room data for ${roomId}`);
  } else {
    log(`[GameContext] Room subscribe: no cached data for ${roomId}, sending minimal context`);
  }

  if (cachedRoomBundle?.roomMeta) {
    gameContext.room.roomMeta = cachedRoomBundle.roomMeta;
    gameContext.lastUpdated.room = Date.now();
  }
  if (cachedRoomBundle?.roomBans) {
    gameContext.room.roomBans = cachedRoomBundle.roomBans;
    gameContext.lastUpdated.room = Date.now();
  }
  if (cachedRoomBundle?.players?.length) {
    gameContext.room.players.clear();
    cachedRoomBundle.players.forEach((playerState) => {
      if (playerState?.playerId != null) {
        gameContext.room.players.set(playerState.playerId, playerState);
      }
    });
  }
  
  // Broadcast room-changed for overlay to clear old state
  broadcastToType(CLIENT_TYPE.SPA, {
    type: 'room-changed',
    roomId: roomId,
    action: 'subscribe',
    timestamp: Date.now()
  });
  
  // IMMEDIATELY send full context including roomMeta so overlay can route player updates correctly
  broadcastContextUpdate('game');
  
  // If we have cached API data, tell overlay to fetch it
  if (cachedRoomBundle || cachedRoomRaw) {
    broadcastToType(CLIENT_TYPE.SPA, {
      type: 'room-data-available',
      roomId: roomId,
      timestamp: Date.now(),
    });
  }
}

/**
 * Handle room unsubscription - player left a room
 */
function handleRoomUnsubscribe(roomId) {
  log(`[GameContext] Room unsubscribed: ${roomId}`);
  
  // Clear game state if leaving active room
  if (gameContext.room.activeRoom === roomId) {
    gameContext.room.activeRoom = null;
    gameContext.room.players.clear();
    gameContext.room.roomMeta = { ...EMPTY_ROOM_META };
    gameContext.room.roomBans = { ...EMPTY_ROOM_BANS };
    gameContext.queueState = {
      inQueue: false,
      queueType: null,
      seasonId: null,
      rating: 0,
      queueSize: 0,
      elapsedTime: 0,
      status: 'idle',
      proposalId: null,
      matchTimeout: null,
      playerAccepted: false,
      opponentAccepted: false,
      declinedBy: null,
      message: null,
      lastEvent: null,
    };
    gameContext.lastUpdated.room = Date.now();
    gameContext.lastUpdated.queue = Date.now();
  }
  
  gameContext.lastUpdated.game = Date.now();
  
  // Broadcast room leave to SPA clients
  broadcastToType(CLIENT_TYPE.SPA, {
    type: 'room-changed',
    roomId: roomId,
    action: 'unsubscribe',
    timestamp: Date.now()
  });
  
  broadcastContextUpdate('game');
}

function processGameSyncEvent(pushData) {
  const channel = pushData.channel;
  const roomId = channel.replace('gamesync:room:', '');
  const eventData = pushData.pub?.data;
  
  if (!eventData) return;
  if (gameContext.room.activeRoom && roomId && gameContext.room.activeRoom !== roomId) {
    log(`[GameContext] Ignoring gamesync event for non-active room ${roomId} (active ${gameContext.room.activeRoom})`);
    return;
  }
  
  const eventType = eventData.event;
  
  if (eventType === 'run_data_updated') {
    updateActiveGame(roomId, eventData);
  } else if (eventType === 'room_update' || eventType === 'room_updated') {
    if (eventData.room) {
      updateRoomMetaFromData(eventData.room);
      gameContext.room.activeRoom = eventData.room.room_id || gameContext.room.activeRoom;
    }
    broadcastContextUpdate('game');
  } else if (eventType === 'match_start') {
    if (eventData.room) {
      updateRoomMetaFromData(eventData.room);
    } else {
      updateRoomMetaFromData({
        room_id: eventData.room_id || roomId,
        phase: eventData.phase,
        status: eventData.status,
        map: eventData.map,
      });
    }
    if (eventData.bans) {
      const currentUser_id = gameContext.profile?.userId;
      const player1_id = gameContext.room.roomMeta.player1_id;
      const player2_id = gameContext.room.roomMeta.player2_id;
      const bansPayload = eventData.bans;

      if (bansPayload.system) {
        gameContext.room.roomBans = {
          ...gameContext.room.roomBans,
          system: normalizeRoomBans({ system: bansPayload.system }).system,
        };
      }

      const fromPlayerRaw = bansPayload.from_player || bansPayload.player1 || null;
      const fromOpponentRaw = bansPayload.from_opponent || bansPayload.player2 || null;
      if (bansPayload.player1 || bansPayload.player2) {
        const mappedBans = mapSourceBansToApplied({ player1: bansPayload.player1 || {}, player2: bansPayload.player2 || {} }, gameContext.room.roomMeta);
        gameContext.room.roomBans = { ...gameContext.room.roomBans, player1: mappedBans.player1, player2: mappedBans.player2 };
      } else if (currentUser_id && player1_id && player2_id) {
        if (fromPlayerRaw || fromOpponentRaw) {
          const fromPlayer = normalizePlayerBanEntry(fromPlayerRaw || {}, 'player1_id', gameContext.room.roomMeta.player1_id);
          const fromOpponent = normalizePlayerBanEntry(fromOpponentRaw || {}, 'player2_id', gameContext.room.roomMeta.player2_id);

          if (currentUser_id === player1_id) {
            gameContext.room.roomBans = { ...gameContext.room.roomBans, player1: fromOpponent, player2: fromPlayer };
          } else if (currentUser_id === player2_id) {
            gameContext.room.roomBans = { ...gameContext.room.roomBans, player1: fromPlayer, player2: fromOpponent };
          }
        }
      }
      const activeRoomId = gameContext.room.roomMeta.roomId || roomId || gameContext.room.activeRoom;
      if (activeRoomId) {
        cacheRoomBundle(activeRoomId, buildRoomBundle({ activeRoom: activeRoomId }));
        broadcastToType(CLIENT_TYPE.SPA, {
          type: 'room-data-available',
          roomId: activeRoomId,
          timestamp: Date.now(),
        });
      }
      gameContext.lastUpdated.room = Date.now();
    }
    broadcastContextUpdate('game');
  } else if (eventType === 'run_ended' || eventType === 'run_completed') {
    endActiveGame(roomId, eventData);
  } else if (eventType === 'run_started') {
    startActiveGame(roomId, eventData);
  } else if (eventType === 'bans_confirmed') {
    updateRoomMetaFromData({
      room_id: roomId,
      phase: eventData.phase,
      player1_ready_ban_selection: eventData.player1_ready,
      player2_ready_ban_selection: eventData.player2_ready,
    });
    broadcastContextUpdate('game');
  } else if (eventType === 'room_cancelled') {
    const player1_id = gameContext.room.roomMeta.player1_id;
    const player2_id = gameContext.room.roomMeta.player2_id;
    let winnerId = null;
    if (eventData.surrendered_player_id && player1_id && player2_id) {
      if (eventData.surrendered_player_id === player1_id) winnerId = player2_id;
      if (eventData.surrendered_player_id === player2_id) winnerId = player1_id;
    }
    updateRoomMetaFromData({
      room_id: roomId,
      phase: eventData.phase,
      status: eventData.status,
      winner_id: eventData.winner_id || winnerId,
    });
    const currentUserId = gameContext.profile?.userId || null;
    if (currentUserId) {
      sessionTracker.recordMatchMeta(currentUserId, gameContext.room.roomMeta);
    }
    if (gameContext.room.activeRoom === roomId) {
      gameContext.room.roomBans = { ...EMPTY_ROOM_BANS };
      gameContext.lastUpdated.room = Date.now();
    }
    broadcastContextUpdate('game');
  } else if (eventType === 'match_ended') {
    const nextStatus = gameContext.room.roomMeta.status === 'cancelled' ? 'cancelled' : 'ended';
    const resolvedWinner = eventData.winner_id || gameContext.room.roomMeta.winnerId;
    updateRoomMetaFromData({
      room_id: roomId,
      phase: 'ended',
      status: nextStatus,
      winner_id: resolvedWinner,
    });
    const currentUserId = gameContext.profile?.userId || null;
    if (currentUserId) {
      sessionTracker.recordMatchMeta(currentUserId, gameContext.room.roomMeta);
      const roomMeta = gameContext.room.roomMeta;
      const activeRoomId = roomMeta?.roomId || roomMeta?.room_id || gameContext.room.activeRoom || null;
      const isActiveRoom = !activeRoomId || !roomId || activeRoomId === roomId;
      if (isActiveRoom) {
        const matchDelta = resolveMatchRatingDelta({
          eventData,
          currentUserId,
          roomMeta,
          winnerId: resolvedWinner,
        });
        if (matchDelta !== null && matchDelta !== undefined) {
          ensureSessionActive('match-ended');
          sessionTracker.applyRatingDelta(currentUserId, {
            delta: matchDelta,
            rank: getCurrentRank(),
            roomMeta: roomMeta,
            result: resolvedWinner
              ? (resolvedWinner === currentUserId ? 'win' : 'loss')
              : undefined,
          });
        }
      }
    }
    if (gameContext.room.activeRoom === roomId) {
      gameContext.room.roomBans = { ...EMPTY_ROOM_BANS };
      gameContext.lastUpdated.room = Date.now();
    }
    broadcastToType(CLIENT_TYPE.SPA, {
      type: 'match-ended',
      roomId: roomId,
      status: nextStatus,
      winnerId: resolvedWinner,
      timestamp: Date.now(),
    });
    broadcastContextUpdate('game');
  }
}

function startActiveGame(roomId, eventData) {
  const playerId = eventData.player_id;
  
  // If new room, clear previous players
  if (gameContext.room.activeRoom && gameContext.room.activeRoom !== roomId) {
    log(`[GameContext] Ignoring game start for non-active room ${roomId} (active ${gameContext.room.activeRoom})`);
    return;
  }
  if (!gameContext.room.activeRoom) {
    gameContext.room.activeRoom = roomId;
  }
  
  // Initialize player in the room
  gameContext.room.players.set(playerId, {
    playerId: playerId,
    status: 'starting',
    startedAt: Date.now(),
    runData: null
  });
  
  gameContext.lastUpdated.game = Date.now();
  log(`[GameContext] Game started: room=${roomId} player=${playerId} (${gameContext.room.players.size} players in room)`);
  broadcastContextUpdate('game');
}

function updateActiveGame(roomId, eventData) {
  const runData = eventData.run_data;
  const playerId = eventData.player_id;
  if (!runData || !playerId) return;
  
  // Update room if different
  if (gameContext.room.activeRoom && gameContext.room.activeRoom !== roomId) {
    log(`[GameContext] Ignoring run update for non-active room ${roomId} (active ${gameContext.room.activeRoom})`);
    return;
  }
  if (!gameContext.room.activeRoom) {
    gameContext.room.activeRoom = roomId;
  }
  
  // Get existing player data or create new
  const existingPlayer = gameContext.room.players.get(playerId);
  
  // Resolve entity names using stored game data
  const resolvedRunData = resolveRunDataNames(runData);
  
  const playerState = {
    playerId: playerId,
    status: runData.status || 'in_progress',
    timeElapsed: eventData.time_elapsed || runData.time_elapsed_seconds,
    isPaused: runData.is_paused,
    pauseTime: runData.pause_time,
    startedAt: existingPlayer?.startedAt || Date.now(),
    lastUpdated: Date.now(),
    
    // Character info
    character: {
      id: runData.character?.id,
      name: resolvedRunData.characterName,
      level: runData.character?.level,
      stats: runData.character?.stats
    },
    
    // Equipment with resolved names
    equipment: {
      weapons: resolvedRunData.weapons,
      tomes: resolvedRunData.tomes,
      items: resolvedRunData.items
    },
    
    // Combat stats
    combat: {
      killCount: runData.kill_count || runData.combat?.kill_count,
      currentGold: runData.combat?.current_gold,
      totalDamageDealt: runData.combat?.total_damage_dealt,
      totalDamageTaken: runData.combat?.total_damage_taken,
      chests: runData.combat?.chests,
      shrines: runData.combat?.shrines,
      shadyGuys: runData.combat?.shady_guys,
      portalsEntered: runData.combat?.portals_entered || runData.combat?.game_stats?.portals_entered,
      microwavesActivated: runData.combat?.microwaves_activated || runData.combat?.microwaves || runData.combat?.game_stats?.microwaves_activated,
      boomboxesActivated: runData.combat?.boomboxes_activated,
      gameStats: runData.combat?.game_stats,
      damageSources: runData.combat?.damage_sources
    },
    
    // Map info
    map: runData.map ? {
      id: runData.map.id,
      tier: runData.map.tier,
      stage: runData.map.stage
    } : null,
    
    // Raw data for reference
    // rawRunData: runData
  };
  
  gameContext.room.players.set(playerId, playerState);
  
  gameContext.lastUpdated.game = Date.now();
  log(`[GameContext] Player ${playerId} updated: room=${roomId} kills=${runData.kill_count} time=${Math.round(eventData.time_elapsed)}s (${gameContext.room.players.size} players)`);
  
  // Use player-specific update to reduce data transfer (only sends this player's data)
  broadcastPlayerUpdate(playerId);
}

function resolveRunDataNames(runData) {
  const result = {
    characterName: null,
    weapons: [],
    tomes: [],
    items: []
  };
  
  // Resolve character name
  if (runData.character?.id !== undefined) {
    const hero = gameContext.heroes.get(runData.character.id);
    result.characterName = hero?.name || `Hero #${runData.character.id}`;
  }
  
  // Resolve weapons
  if (runData.equipment?.weapons) {
    result.weapons = runData.equipment.weapons.map(w => {
      const weapon = gameContext.weapons.get(w.id);
      return {
        id: w.id,
        name: weapon?.name || `Weapon #${w.id}`,
        imageSrc: weapon?.imageSrc,
        level: w.level
      };
    });
  }
  
  // Resolve tomes
  if (runData.equipment?.tomes) {
    result.tomes = runData.equipment.tomes.map(t => {
      const tome = gameContext.tomes.get(t.id);
      return {
        id: t.id,
        name: tome?.name || `Tome #${t.id}`,
        imageSrc: tome?.imageSrc,
        level: t.level
      };
    });
  }
  
  // Resolve items
  if (runData.equipment?.items) {
    result.items = runData.equipment.items.map(i => {
      const item = gameContext.items.get(i.id);
      return {
        id: i.id,
        name: item?.name || `Item #${i.id}`,
        imageSrc: item?.imageSrc,
        rarity: i.rarity || item?.rarity,
        count: i.count
      };
    });
  }
  
  return result;
}

function endActiveGame(roomId, eventData) {
  const playerId = eventData?.player_id;
  
  if (gameContext.room.activeRoom === roomId) {
    if (playerId && gameContext.room.players.has(playerId)) {
      // End specific player's game
      const playerState = gameContext.room.players.get(playerId);
      playerState.status = 'ended';
      playerState.endedAt = Date.now();
      gameContext.room.players.set(playerId, playerState);
      log(`[GameContext] Player ${playerId} ended: room=${roomId}`);
    } else {
      // End all players in the room
      gameContext.room.players.forEach((player, id) => {
        player.status = 'ended';
        player.endedAt = Date.now();
      });
      log(`[GameContext] All players ended: room=${roomId}`);
    }

    const allEnded = Array.from(gameContext.room.players.values()).every(p => p.status === 'ended');
    if (allEnded) {
      gameContext.room.roomBans = { ...EMPTY_ROOM_BANS };
      gameContext.lastUpdated.room = Date.now();
    }
  }
  gameContext.lastUpdated.game = Date.now();
  broadcastContextUpdate('game');
}

/**
 * Get serializable game context for API responses
 */
function getSerializableContext() {
  return {
    heroes: Array.from(gameContext.heroes.values()),
    weapons: Array.from(gameContext.weapons.values()),
    tomes: Array.from(gameContext.tomes.values()),
    items: Array.from(gameContext.items.values()),
    activeSeason: gameContext.activeSeason,
    allSeasons: gameContext.allSeasons,
    seasonPlayerStats: gameContext.seasonPlayerStats,
    friends: gameContext.friends,
    pendingFriends: gameContext.pendingFriends,
    profile: gameContext.profile,
    bans: gameContext.bans,
    // Multi-player game state
    room: buildRoomBundle(),
    queueState: gameContext.queueState,
    stats: {
      heroCount: gameContext.heroes.size,
      weaponCount: gameContext.weapons.size,
      tomeCount: gameContext.tomes.size,
      itemCount: gameContext.items.size,
      hasActiveSeason: !!gameContext.activeSeason,
      hasActiveGame: gameContext.room.players.size > 0 && 
        Array.from(gameContext.room.players.values()).some(p => p.status !== 'ended'),
      playerCount: gameContext.room.players.size,
      friendCount: gameContext.friends.length,
      seasonCount: gameContext.allSeasons.length,
      hasProfile: !!gameContext.profile
    },
    lastUpdated: gameContext.lastUpdated
  };
}

// ============================================================
// END OF GAME CONTEXT STORAGE
// ============================================================

// ============================================================
// OVERLAY STATIC SERVING
// ============================================================
const OVERLAY_BASE_PATH = '/overlay';
const OVERLAY_API_PATH = '/api/overlay';
let overlayServingEnabled = true;
let overlayRoot = null;

function resolveOverlayRoot() {
  const candidates = [];
  if (process.env.RELAY_OVERLAY_ROOT) {
    candidates.push(process.env.RELAY_OVERLAY_ROOT);
  }
  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, 'overlay'));
  }
  if (process.execPath) {
    candidates.push(path.join(path.dirname(process.execPath), 'overlay'));
  }

  for (const candidate of candidates) {
    if (!candidate) continue;
    const resolved = path.resolve(candidate);
    if (fs.existsSync(path.join(resolved, 'index.html'))) {
      return resolved;
    }
  }
  return null;
}

function getOverlayRoot() {
  if (overlayRoot && fs.existsSync(overlayRoot)) return overlayRoot;
  overlayRoot = resolveOverlayRoot();
  return overlayRoot;
}

function overlayGate(req, res, next) {
  if (!overlayServingEnabled) {
    res.status(503).json({ error: 'overlay_disabled' });
    return;
  }
  const root = getOverlayRoot();
  if (!root) {
    res.status(404).json({ error: 'overlay_not_found' });
    return;
  }
  req.overlayRoot = root;
  next();
}

function serveOverlayStatic(req, res, next) {
  const root = req.overlayRoot || getOverlayRoot();
  if (!root) {
    res.status(404).json({ error: 'overlay_not_found' });
    return;
  }
  return express.static(root, { index: false, fallthrough: true })(req, res, next);
}

const app = express();

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: '1mb' }));

app.use(OVERLAY_BASE_PATH, overlayGate, serveOverlayStatic);

app.get([OVERLAY_API_PATH, `${OVERLAY_API_PATH}/status`], (req, res) => {
  const root = getOverlayRoot();
  res.status(200).json({ enabled: overlayServingEnabled, available: !!root });
});

app.post(`${OVERLAY_API_PATH}/start`, (req, res) => {
  const root = getOverlayRoot();
  if (!root) {
    res.status(404).json({ error: 'overlay_not_found', enabled: overlayServingEnabled, available: false });
    return;
  }
  overlayServingEnabled = true;
  res.status(200).json({ enabled: overlayServingEnabled, available: true });
});

app.post(`${OVERLAY_API_PATH}/stop`, (req, res) => {
  overlayServingEnabled = false;
  const root = getOverlayRoot();
  res.status(200).json({ enabled: overlayServingEnabled, available: !!root });
});

app.get(new RegExp(`^${OVERLAY_BASE_PATH}(?:/.*)?$`), overlayGate, (req, res) => {
  const root = req.overlayRoot || getOverlayRoot();
  if (!root) {
    res.status(404).json({ error: 'overlay_not_found' });
    return;
  }
  res.sendFile(path.join(root, 'index.html'));
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', clients: clients.size });
});

app.get(['/settings', '/api/settings'], (req, res) => {
  const userId = req.query.userId || null;
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  const settings = settingsStore.getUserSettings(userId) || null;
  res.status(200).json({ userId, settings, ...settings });
});

app.post(['/settings', '/api/settings'], (req, res) => {
  const payload = req.body || {};
  const targetUserId = req.query.userId || payload.userId;
  if (!targetUserId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  const existing = settingsStore.getUserSettings(targetUserId) || {};
  settingsStore.setUserSettings(targetUserId, {
    layoutString: payload.layoutString || existing.layoutString || null,
    updatedAt: payload.updatedAt || Date.now(),
    version: payload.version || 1,
  });
  settingsStore.saveSettings();
  res.status(200).json({ ok: true, userId: targetUserId });
});

app.get(['/session', '/api/session'], (req, res) => {
  const userId = gameContext.profile?.userId || null;
  if (!userId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  const session = sessionTracker.getPublicSession(userId);
  res.status(200).json({ session, userId, lastUpdated: session?.lastUpdated || null });
});

app.post(['/session/start', '/api/session/start'], (req, res) => {
  const payload = req.body || {};
  const targetUserId = payload.userId || gameContext.profile?.userId || null;
  if (!targetUserId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  const rating = payload.rating || getCurrentRating();
  const rank = payload.rank || getCurrentRank();
  const session = sessionTracker.startSession(targetUserId, { rating, rank });
  res.status(200).json({ session, userId: targetUserId });
});

app.post(['/session/stop', '/api/session/stop'], (req, res) => {
  const payload = req.body || {};
  const targetUserId = payload.userId || gameContext.profile?.userId || null;
  if (!targetUserId) {
    res.status(400).json({ error: 'userId is required' });
    return;
  }
  const session = sessionTracker.stopSession(targetUserId);
  res.status(200).json({ session, userId: targetUserId });
});

app.get(['/context', '/api/context'], (req, res) => {
  res.status(200).json(getSerializableContext());
});

app.get(['/room', '/api/room'], (req, res) => {
  const userId = gameContext.profile?.userId;
  const players = Array.from(gameContext.room.players.values());
  const isSpectator = userId ? !players.some(p => p.playerId === userId) : true;
  const room = buildRoomBundle({ players });

  res.status(200).json({
    room,
    playerCount: players.length,
    hasActiveGame: players.length > 0 && players.some(p => p.status !== 'ended'),
    isSpectator: isSpectator,
    currentUser_id: userId,
    queueState: gameContext.queueState,
    season: gameContext.activeSeason ? {
      name: gameContext.activeSeason.name,
      timeLimit: gameContext.activeSeason.timeLimit,
      pauseLimit: gameContext.activeSeason.pauseLimit,
      startDate: gameContext.activeSeason.startDate,
      endDate: gameContext.activeSeason.endDate,
    } : null,
    lastUpdated: gameContext.lastUpdated.game
  });
});

app.get(/^\/(api\/)?room\/[a-zA-Z0-9-]+$/, (req, res) => {
  const roomIdMatch = req.path.match(/^\/(api\/)?room\/([a-zA-Z0-9-]+)$/);
  const roomId = roomIdMatch ? roomIdMatch[2] : null;

  if (roomId && hasRoomInCache(roomId)) {
    const cachedRoom = getCachedRoomBundle(roomId);
    res.status(200).json({
      roomId: roomId,
      cached: true,
      room: cachedRoom,
      timestamp: Date.now(),
    });
    log(`[HTTP] Served cached room data for ${roomId}`);
  } else {
    res.status(404).json({
      error: 'Room not found in cache',
      roomId: roomId,
      availableRooms: listCachedRoomIds(),
    });
  }
});

app.get(['/game', '/api/game'], (req, res) => {
  const players = Array.from(gameContext.room.players.values());
  res.status(200).json({
    room: buildRoomBundle({ players }),
    hasActiveGame: players.length > 0 && players.some(p => p.status !== 'ended'),
    playerCount: players.length,
    lastUpdated: gameContext.lastUpdated.game
  });
});

app.get(['/season', '/api/season'], (req, res) => {
  res.status(200).json({
    activeSeason: gameContext.activeSeason,
    bans: gameContext.bans,
    lastUpdated: gameContext.lastUpdated.season
  });
});

app.get(['/seasons', '/api/seasons'], (req, res) => {
  res.status(200).json({
    allSeasons: gameContext.allSeasons,
    activeSeason: gameContext.activeSeason,
    lastUpdated: gameContext.lastUpdated.allSeasons
  });
});

app.get(['/friends', '/api/friends'], (req, res) => {
  res.status(200).json({
    friends: gameContext.friends,
    pendingFriends: gameContext.pendingFriends,
    lastUpdated: gameContext.lastUpdated.friends
  });
});

app.get(['/translations', '/api/translations'], (req, res) => {
  const lang = req.query.lang || null;

  if (lang) {
    const t = gameContext.translations[lang];
    if (t) {
      res.status(200).json({ language: lang, translations: t, lastUpdated: gameContext.lastUpdated.translations });
    } else {
      res.status(404).json({ error: 'translations not found for language', language: lang });
    }
    return;
  }

  res.status(200).json({ translations: gameContext.translations, lastUpdated: gameContext.lastUpdated.translations });
});

app.get(['/profile', '/api/profile'], (req, res) => {
  res.status(200).json({
    profile: gameContext.profile,
    lastUpdated: gameContext.lastUpdated.profile
  });
});

app.get(['/entities', '/api/entities'], (req, res) => {
  res.status(200).json({
    heroes: Array.from(gameContext.heroes.values()),
    weapons: Array.from(gameContext.weapons.values()),
    tomes: Array.from(gameContext.tomes.values()),
    items: Array.from(gameContext.items.values()),
    lastUpdated: {
      heroes: gameContext.lastUpdated.heroes,
      weapons: gameContext.lastUpdated.weapons,
      tomes: gameContext.lastUpdated.tomes,
      items: gameContext.lastUpdated.items
    }
  });
});

app.use((req, res) => {
  res.status(200).type('text/plain').send('MegaBonk WS Relay Server\n\nEndpoints:\n  /health - Server health\n  /overlay - Overlay web UI\n  /api/overlay/status - Overlay serving status\n  /context - Full game context\n  /game - Active game state (all players)\n  /season - Active season and bans info\n  /seasons - All seasons\n  /friends - Friends data\n  /profile - Profile data\n  /entities - Heroes, weapons, tomes, items\n');
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server, path: '/ws' });

// Track connected clients
const clients = new Map();
let clientIdCounter = 0;

// Client types
const CLIENT_TYPE = {
  EXTENSION: 'extension',
  SPA: 'spa',
  UNKNOWN: 'unknown'
};

wss.on('connection', (ws, req) => {
  const clientId = ++clientIdCounter;
  const clientInfo = {
    id: clientId,
    type: CLIENT_TYPE.UNKNOWN,
    connectedAt: Date.now(),
    ip: req.socket.remoteAddress,
    sessionToken: createSessionToken(),
  };
  
  clients.set(ws, clientInfo);
  log(`Client ${clientId} connected from ${clientInfo.ip}`);

  ws.on('message', (data) => {
    const dataStr = data.toString();
    const dataLen = dataStr.length;
    // Log message length and a short preview for debugging
    log(`Client ${clientId} message received: length=${dataLen} preview=${dataStr.slice(0, 200)}...`);

    try {
      const message = JSON.parse(dataStr);
      log(`Client ${clientId} JSON parsed OK, keys=${Object.keys(message).join(',')}`);
      handleMessage(ws, clientInfo, message);
    } catch (e) {
      log(`Client ${clientId} invalid JSON: ${e.message}`);
    }
  });

  ws.on('close', (code, reason) => {
    log(`Client ${clientId} disconnected: ${code}`);
    clients.delete(ws);
  });

  ws.on('error', (error) => {
    log(`Client ${clientId} error: ${error.message}`);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    clientId: clientId,
    token: clientInfo.sessionToken,
    timestamp: Date.now()
  }));
});

/**
 * Handle incoming message
 */
function handleMessage(ws, clientInfo, message) {
  if (clientInfo?.sessionToken) {
    const providedToken = message?.token;
    if (!providedToken || providedToken !== clientInfo.sessionToken) {
      log(`Client ${clientInfo.id} unauthorized message (missing/invalid token)`);
      return;
    }
  }

  // Identify client type
  if (message.origin === 'megabonk-extension') {
    clientInfo.type = CLIENT_TYPE.EXTENSION;
    if (isCoreDataMissing()) {
      requestExtensionRefresh(ws, clientInfo);
    }
  } else if (message.origin === 'megabonk-spa') {
    clientInfo.type = CLIENT_TYPE.SPA;
    ensureExtensionRefreshFromAny('spa-connect');
  }

  // Helpful debug logging for incoming messages
  try {
    const summaryType = message.type || (message.event && message.event.type) || 'unknown';
    log(`Received from client ${clientInfo.id} (type=${clientInfo.type}): ${summaryType}`);
    if (message.event && message.event.type === 'WS_EVENT') {
      const ev = message.event;
      log(`  WS_EVENT socket=${ev.socketId ? ev.socketId.substring(0,8) : '?'} dir=${ev.direction} size=${ev.data ? (ev.data.value||'').length || 0 : 0}`);
    }
  } catch (e) {
    // ignore logging errors
  }

  // Handle heartbeat
  if (message.type === 'heartbeat') {
    ws.send(JSON.stringify({
      type: 'heartbeat-ack',
      timestamp: Date.now()
    }));
    return;
  }

  // Handle registration
  if (message.type === 'register') {
    clientInfo.type = message.clientType || CLIENT_TYPE.UNKNOWN;
    log(`Client ${clientInfo.id} registered as ${clientInfo.type}`);
    if (clientInfo.type === CLIENT_TYPE.EXTENSION) {
      if (isCoreDataMissing()) {
        requestExtensionRefresh(ws, clientInfo);
      }
    } else if (clientInfo.type === CLIENT_TYPE.SPA) {
      ensureExtensionRefreshFromAny('spa-register');
    }
    return;
  }

  // Log WebSocket events (condensed)
  if (message.event && message.event.type === 'WS_EVENT') {
    const event = message.event;
    const direction = event.direction === 'in' ? 'IN' : 'OUT';
    const socketIdShort = event.socketId ? event.socketId.substring(0, 8) : '?';
    log(`[${clientInfo.id}] ${event.type} ${direction} ${socketIdShort}`);
  }

  // Log API events
  if (message.event && message.event.type === 'API_REQUEST') {
    const event = message.event;
    log(`[${clientInfo.id}] API_REQUEST ${event.method} ${event.url}`);
    // Log full request to response log
    logFullResponse('API_REQUEST', event.url, { method: event.method, headers: event.headers, body: event.body });
  }
  if (message.event && message.event.type === 'API_RESPONSE') {
    const event = message.event;
    log(`[${clientInfo.id}] API_RESPONSE ${event.status} ${event.method} ${event.url} (${event.duration}ms)`);
    // Log full response data without truncation
    logFullResponse('API_RESPONSE', event.url, event.data?.value || event.data);
    // Process API response for game context
    processApiResponse(message);
  }
  if (message.event && message.event.type === 'API_ERROR') {
    const event = message.event;
    log(`[${clientInfo.id}] API_ERROR ${event.method} ${event.url}: ${event.error}`);
    logFullResponse('API_ERROR', event.url, { error: event.error, status: event.status });
  }
  if (message.event && message.event.type === 'PAGE_COMMAND_RESULT') {
    const event = message.event;
    log(`[${clientInfo.id}] PAGE_COMMAND_RESULT ${event.action || 'unknown'} ${event.status || ''} ${event.url || ''}`);
    logFullResponse('PAGE_COMMAND_RESULT', event.url || 'unknown', event.data?.value || event.data || event);
    processPageCommandResult(message);
  }

  // Process WebSocket events for game state
  if (message.event && message.event.type === 'WS_EVENT') {
    const event = message.event;
    // Log full WS event data
    logFullResponse(`WS_EVENT_${event.direction?.toUpperCase() || 'UNKNOWN'}`, event.url, event.data?.value || event.data);
    processWsEvent(message);
  }

  // Don't broadcast raw extension events to SPA clients - they get context-update messages instead
  // Only forward events that aren't from the extension origin
  if (message.origin !== 'megabonk-extension') {
    // Broadcast to SPA clients
    broadcastToType(CLIENT_TYPE.SPA, message, ws);
  }

  // If this is from SPA and contains a command, route to extension
  if (clientInfo.type === CLIENT_TYPE.SPA && message.type === 'command') {
    broadcastToType(CLIENT_TYPE.EXTENSION, message, ws);
  }

  // Handle context request from SPA
  if (message.type === 'get-context') {
    ensureExtensionRefreshFromAny('context-request');
    ws.send(JSON.stringify({
      type: 'context-update',
      context: getSerializableContext(),
      timestamp: Date.now()
    }));
  }
}

/**
 * Broadcast message to all clients of a specific type
 */
function broadcastToType(type, message, excludeWs = null) {
  const messageStr = JSON.stringify(message);
  const msgLen = messageStr.length;
  let candidates = 0;
  let sent = 0;

  clients.forEach((info, ws) => {
    if (info.type === type) candidates++;
    if (ws !== excludeWs && info.type === type && ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(messageStr);
        sent++;
      } catch (e) {
        log(`Client ${info.id} send failed: ${e.message}`);
      }
    }
  });

  log(`Broadcast to type=${type}: candidates=${candidates} sent=${sent} msgLen=${msgLen}`);
}

/**
 * Broadcast single player update to all SPA clients
 * Use this for run_data_updated events to reduce data transfer
 * Only sends the updated player's data instead of all players
 */
function broadcastPlayerUpdate(playerId) {
  const playerState = gameContext.room.players.get(playerId);
  if (!playerState) return;
  
  const update = {
    type: 'player-update',
    playerId: playerId,
    player: playerState,
    room: {
      activeRoom: gameContext.room.activeRoom,
      roomMeta: gameContext.room.roomMeta,
      roomBans: gameContext.room.roomBans,
    },
    playerCount: gameContext.room.players.size,
    timestamp: Date.now()
  };
  
  broadcastToType(CLIENT_TYPE.SPA, update);
}

/**
 * Broadcast context update to all SPA clients
 * Call this when significant game state changes occur
 */
function broadcastContextUpdate(updateType) {
  let contextData;
  
  switch (updateType) {
    case 'game':
      const roomBundle = buildRoomBundle();
      contextData = {
        room: roomBundle,
        hasActiveGame: gameContext.room.players.size > 0 && 
          Array.from(gameContext.room.players.values()).some(p => p.status !== 'ended'),
        playerCount: gameContext.room.players.size,
        queueState: gameContext.queueState
      };
      break;
    case 'season':
      contextData = {
        activeSeason: gameContext.activeSeason,
        bans: gameContext.bans,
        seasonPlayerStats: gameContext.seasonPlayerStats
      };
      break;
    case 'seasons':
      contextData = {
        allSeasons: gameContext.allSeasons
      };
      break;
    case 'friends':
      contextData = {
        friends: gameContext.friends,
        pendingFriends: gameContext.pendingFriends
      };
      break;
    case 'profile':
      contextData = {
        profile: gameContext.profile
      };
      break;
    case 'entities':
      contextData = {
        heroes: Array.from(gameContext.heroes.values()),
        weapons: Array.from(gameContext.weapons.values()),
        tomes: Array.from(gameContext.tomes.values()),
        items: Array.from(gameContext.items.values())
      };
      break;
    case 'translations':
      contextData = {
        translations: gameContext.translations,
        lastUpdated: gameContext.lastUpdated.translations
      };
      break;
    default:
      contextData = getSerializableContext();
  }
  
  const update = {
    type: 'context-update',
    updateType: updateType,
    context: contextData,
    timestamp: Date.now()
  };
  
  broadcastToType(CLIENT_TYPE.SPA, update);
}

// Periodically request a refresh if core data is missing
setInterval(() => {
  ensureExtensionRefreshFromAny('periodic-check');
}, 30000);

// Start server
server.listen(PORT, '127.0.0.1', () => {
  log(`Server started on ws://127.0.0.1:${PORT}/ws`);
});

// Handle errors
server.on('error', (err) => {
  log(`Server error: ${err.message}`);
  if (err.code === 'EADDRINUSE') {
    log(`Port ${PORT} is already in use`);
    process.exit(1);
  }
});

// Graceful shutdown
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (err) => {
  log(`Uncaught exception: ${err?.stack || err?.message || err}`);
});
process.on('unhandledRejection', (reason) => {
  log(`Unhandled rejection: ${reason?.stack || reason?.message || reason}`);
});

function shutdown() {
  log('Shutting down...');
  wss.clients.forEach((ws) => {
    ws.close(1000, 'Server shutting down');
  });
  server.close(() => {
    log('Server closed');
    process.exit(0);
  });
  // Force exit after 3 seconds
  setTimeout(() => process.exit(0), 3000);
}

log('MegaBonk WS Relay Server initialized');
