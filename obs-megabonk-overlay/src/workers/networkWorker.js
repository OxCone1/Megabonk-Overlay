/**
 * Network Worker - Offloads WebSocket and HTTP operations from main thread
 * This worker handles all network communication with the relay server
 * and posts processed data back to the main thread.
 */

const RELAY_SERVER_URL = 'http://127.0.0.1:17502';
const RELAY_WS_URL = 'ws://127.0.0.1:17502/ws';

let ws = null;
let reconnectTimeout = null;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
let heartbeatInterval = null;
let relaySessionToken = null;
let sessionPollInterval = null;
let lastSessionUpdatedAt = null;
const ROOM_FETCH_DEDUPE_MS = 1500;
const ROOM_FETCH_MAX_RETRIES = 5;
const ROOM_FETCH_RETRY_BASE_MS = 500;
const roomFetchInFlight = new Set();
const roomFetchLastAt = new Map();
const roomFetchRetryCount = new Map();
const roomFetchRetryTimer = new Map();

function normalizeNumericId(value) {
  if (value === null || value === undefined) return value;
  const num = Number(value);
  return Number.isFinite(num) ? num : value;
}

// Transform player data (pure function)
function transformPlayerData(player) {
  return {
    playerId: normalizeNumericId(player.playerId),
    timeElapsed: player.timeElapsed || 0,
    isPaused: player.isPaused || false,
    pauseTime: player.pauseTime || 0,
    status: player.status || 'unknown',
    character: {
      id: normalizeNumericId(player.character?.id),
      name: player.character?.name,
      level: player.character?.level,
      stats: player.character?.stats || {},
    },
    equipment: {
      weapons: (player.equipment?.weapons || []).map(w => ({
        id: normalizeNumericId(w.id),
        level: w.level || 0,
        name: w.name,
        imageSrc: w.imageSrc,
      })),
      tomes: (player.equipment?.tomes || []).map(t => ({
        id: normalizeNumericId(t.id),
        level: t.level || 0,
        name: t.name,
        imageSrc: t.imageSrc,
      })),
      items: (player.equipment?.items || []).map(i => ({
        id: normalizeNumericId(i.id),
        count: i.count || 1,
        rarity: i.rarity,
        name: i.name,
        imageSrc: i.imageSrc,
      })),
    },
    combat: {
      killCount: player.combat?.killCount || 0,
      currentGold: player.combat?.currentGold || 0,
      totalDamageDealt: player.combat?.totalDamageDealt || 0,
      totalDamageTaken: player.combat?.totalDamageTaken || 0,
      shadyGuys: player.combat?.shadyGuys || 0,
      portalsEntered: player.combat?.portalsEntered || 0,
      microwavesActivated: player.combat?.microwavesActivated || 0,
      boomboxesActivated: player.combat?.boomboxesActivated || 0,
      shrines: player.combat?.shrines || {},
      gameStats: player.combat?.gameStats || {},
      damageSources: player.combat?.damageSources || {},
    },
    map: player.map || null,
  };
}

// Post message to main thread
function postToMain(type, data) {
  self.postMessage({ type, ...data });
}

// Fetch helper with error handling
async function fetchJSON(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[NetworkWorker] Fetch error:', url, err);
    return null;
  }
}

async function fetchSessionStats() {
  const sessionData = await fetchJSON(`${RELAY_SERVER_URL}/api/session`);
  if (!sessionData) return;
  const updatedAt = sessionData.lastUpdated || sessionData.session?.lastUpdated || null;
  if (updatedAt && updatedAt === lastSessionUpdatedAt) return;
  lastSessionUpdatedAt = updatedAt;
  postToMain('session-stats', { session: sessionData.session || sessionData });
}

// Fetch initial data from HTTP API
async function fetchInitialData() {
  // Fetch entities
  const entities = await fetchJSON(`${RELAY_SERVER_URL}/api/entities`);
  if (entities) {
    postToMain('entities', { 
      heroes: entities.heroes || [],
      weapons: entities.weapons || [],
      tomes: entities.tomes || [],
      items: entities.items || [],
    });
  }
  
  // Fetch profile
  const profileData = await fetchJSON(`${RELAY_SERVER_URL}/api/profile`);
  if (profileData?.profile?.userId) {
    postToMain('profile', { userId: profileData.profile.userId });
  }

  // Fetch season info
  const seasonData = await fetchJSON(`${RELAY_SERVER_URL}/api/season`);
  if (seasonData) {
    const season = seasonData.activeSeason || seasonData.season || seasonData;
    if (season) {
      postToMain('season', { season });
    }
  }
  
  // Fetch current room state
  const roomData = await fetchJSON(`${RELAY_SERVER_URL}/api/room`);
  if (roomData) {
    const room = roomData.room || {};
    const players = (room.players || []).map(transformPlayerData);
    postToMain('room', {
      room: { ...room, players },
      isSpectator: roomData.isSpectator,
      season: roomData.season,
      currentUser_id: roomData.currentUser_id,
      queueState: roomData.queueState || null,
    });
  }

  // Fetch session stats (if available)
  await fetchSessionStats();
}

function clearRoomRetry(roomId) {
  const timer = roomFetchRetryTimer.get(roomId);
  if (timer) {
    clearTimeout(timer);
  }
  roomFetchRetryTimer.delete(roomId);
  roomFetchRetryCount.delete(roomId);
}

function scheduleRoomRetry(roomId, reason) {
  if (!roomId) return;
  const current = roomFetchRetryCount.get(roomId) || 0;
  if (current >= ROOM_FETCH_MAX_RETRIES) return;
  const delay = ROOM_FETCH_RETRY_BASE_MS * Math.pow(2, current);
  roomFetchRetryCount.set(roomId, current + 1);
  const existing = roomFetchRetryTimer.get(roomId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => {
    fetchCachedRoomData(roomId, { force: true });
  }, delay);
  roomFetchRetryTimer.set(roomId, timer);
  console.log(`[NetworkWorker] Room cache miss (${reason || 'unknown'}). Retrying ${roomId} in ${delay}ms`);
}

// Fetch cached room data
async function fetchCachedRoomData(roomId, options = {}) {
  if (!roomId) return;
  const now = Date.now();
  const lastAt = roomFetchLastAt.get(roomId) || 0;
  if (roomFetchInFlight.has(roomId) || (!options.force && (now - lastAt) < ROOM_FETCH_DEDUPE_MS)) return;
  roomFetchInFlight.add(roomId);
  roomFetchLastAt.set(roomId, now);

  let response = null;
  try {
    const res = await fetch(`${RELAY_SERVER_URL}/api/room/${roomId}`);
    if (!res.ok) {
      if (res.status === 404) {
        scheduleRoomRetry(roomId, `http-${res.status}`);
      }
      roomFetchInFlight.delete(roomId);
      return;
    }
    response = await res.json();
  } catch (err) {
    console.error('[NetworkWorker] Fetch error:', `${RELAY_SERVER_URL}/api/room/${roomId}`, err);
    roomFetchInFlight.delete(roomId);
    return;
  }

  if (!response?.cached || !response?.room) {
    if (response?.error === 'Room not found in cache') {
      scheduleRoomRetry(roomId, 'cache-miss');
    }
    roomFetchInFlight.delete(roomId);
    return;
  }

  const room = response.room || {};
  const players = (room.players || []).map(transformPlayerData);

  postToMain('cached-room', {
    roomId,
    room: { ...room, players },
  });

  clearRoomRetry(roomId);
  roomFetchInFlight.delete(roomId);
}

// Handle WebSocket messages
function handleWSMessage(event) {
  try {
    const message = JSON.parse(event.data);
    
    switch (message.type) {
      case 'welcome':
        console.log('[NetworkWorker] Connected, clientId:', message.clientId);
        relaySessionToken = message.token || null;
        // Register as SPA client
        ws.send(JSON.stringify({
          type: 'register',
          origin: 'megabonk-spa',
          clientType: 'spa',
          token: relaySessionToken,
        }));
        // Request current context
        ws.send(JSON.stringify({ type: 'get-context', token: relaySessionToken }));
        break;
        
      case 'context-update': {
        const { updateType, context } = message;
        
        if (updateType === 'game' || !updateType) {
          const room = context.room || {};
          if (room.activeRoom) {
            postToMain('active-room', { activeRoom: room.activeRoom });
          }
          // Send room-meta BEFORE players to ensure roomMeta is available for slot resolution
          postToMain('room-meta', {
            roomMeta: room.roomMeta || null,
            roomBans: room.roomBans || null,
            queueState: context.queueState || null,
          });
          if (room.players?.length > 0) {
            const players = room.players.map(transformPlayerData);
            // Include roomMeta and roomBans with players so they can be used for deterministic slot assignment
            postToMain('players', { 
              players, 
              roomMeta: room.roomMeta || null,
              roomBans: room.roomBans || null 
            });
          }
        }
        
        if (updateType === 'entities') {
          postToMain('entities', {
            heroes: context.heroes || [],
            weapons: context.weapons || [],
            tomes: context.tomes || [],
            items: context.items || [],
          });
        }

        if (updateType === 'season' && context?.activeSeason) {
          postToMain('season', { season: context.activeSeason });
        }
        
        if (updateType === 'profile' && context.profile?.userId) {
          postToMain('profile', { userId: context.profile.userId });
        }
        
        // Full context update (no updateType = get-context response)
        if (!updateType && context.profile?.userId) {
          postToMain('profile', { userId: context.profile.userId });
        }
        if (!updateType && context.activeSeason) {
          postToMain('season', { season: context.activeSeason });
        }
        // Also post season data when updateType is 'game' (incremental updates may include season)
        if (updateType === 'game' && context.activeSeason) {
          postToMain('season', { season: context.activeSeason });
        }
        break;
      }
        
      case 'room-changed':
        postToMain('room-changed', {
          action: message.action,
          roomId: message.roomId,
        });
        if (message.action === 'unsubscribe' && message.roomId) {
          clearRoomRetry(message.roomId);
        }
        break;
      case 'match-ended':
        postToMain('match-ended', {
          roomId: message.roomId,
          status: message.status,
          winnerId: message.winnerId,
        });
        break;
        
      case 'player-update': {
        // Single player update - more efficient than full context update
        const player = transformPlayerData(message.player);
        postToMain('player-update', {
          playerId: message.playerId,
          player,
          room: message.room || null,
          playerCount: message.playerCount,
        });
        break;
      }
        
      case 'room-data-available':
        fetchCachedRoomData(message.roomId);
        break;
        
      case 'heartbeat-ack':
        // Heartbeat acknowledged
        break;
    }
  } catch (error) {
    console.error('[NetworkWorker] Failed to parse message:', error);
  }
}

// Connect to WebSocket
function connect() {
  if (ws?.readyState === WebSocket.OPEN) return;
  
  try {
    ws = new WebSocket(RELAY_WS_URL);
    
    ws.onopen = () => {
      console.log('[NetworkWorker] WebSocket connected');
      postToMain('connected', { isConnected: true });
      reconnectAttempts = 0;
      
      // Fetch initial data via HTTP
      fetchInitialData();

      if (!sessionPollInterval) {
        sessionPollInterval = setInterval(() => {
          fetchSessionStats();
        }, 5000);
      }
    };
    
    ws.onmessage = handleWSMessage;
    
    ws.onclose = (event) => {
      console.log('[NetworkWorker] WebSocket closed:', event.code);
      postToMain('connected', { isConnected: false });

      if (sessionPollInterval) {
        clearInterval(sessionPollInterval);
        sessionPollInterval = null;
      }
      
      // Attempt reconnect
      if (reconnectAttempts < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
        reconnectAttempts++;
        console.log(`[NetworkWorker] Reconnecting in ${delay}ms (attempt ${reconnectAttempts})`);
        reconnectTimeout = setTimeout(connect, delay);
      } else {
        postToMain('error', { error: 'Failed to connect after multiple attempts' });
      }
    };
    
    ws.onerror = (error) => {
      console.error('[NetworkWorker] WebSocket error:', error);
      postToMain('error', { error: 'WebSocket connection error' });
    };
  } catch (error) {
    console.error('[NetworkWorker] Failed to create WebSocket:', error);
    postToMain('error', { error: 'Failed to create WebSocket connection' });
  }
}

// Start heartbeat
function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);
  heartbeatInterval = setInterval(() => {
    if (ws?.readyState === WebSocket.OPEN) {
      if (!relaySessionToken) return;
      ws.send(JSON.stringify({ type: 'heartbeat', token: relaySessionToken }));
    }
  }, 30000);
}

// Handle messages from main thread
self.onmessage = (event) => {
  const { type, ...data } = event.data;
  
  switch (type) {
    case 'connect':
      connect();
      startHeartbeat();
      break;
      
    case 'disconnect':
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (sessionPollInterval) clearInterval(sessionPollInterval);
      if (ws) ws.close();
      break;
      
    case 'fetch-room':
      fetchCachedRoomData(data.roomId);
      break;
      
    case 'reconnect':
      reconnectAttempts = 0;
      if (ws) ws.close();
      connect();
      break;
  }
};

console.log('[NetworkWorker] Worker initialized');
