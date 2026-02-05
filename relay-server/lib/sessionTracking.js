const fs = require('fs');
const path = require('path');
const os = require('os');

function getSessionDataPath() {
  if (process.env.RELAY_SESSION_PATH) {
    return process.env.RELAY_SESSION_PATH;
  }

  const baseDir = process.env.LOCALAPPDATA
    || (process.platform === 'darwin'
      ? path.join(os.homedir(), 'Library', 'Application Support')
      : path.join(os.homedir(), '.config'));
  const dataDir = path.join(baseDir, 'MegaBonkRelay');
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch (e) {
    // ignore
  }
  return path.join(dataDir, 'relay-session.json');
}

function normalizeNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function createSessionTracker({ log }) {
  const SESSION_FILE = getSessionDataPath();
  let store = { users: {} };

  function load() {
    try {
      if (fs.existsSync(SESSION_FILE)) {
        const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
        store = JSON.parse(raw) || { users: {} };
      }
    } catch (e) {
      store = { users: {} };
    }
  }

  function save() {
    try {
      fs.writeFileSync(SESSION_FILE, JSON.stringify(store, null, 2));
      if (log) log(`[Session] Saved session data to ${SESSION_FILE}`);
    } catch (e) {
      if (log) log(`[Session] Failed to save session data: ${e.message}`);
    }
  }

  function ensureSession(userId) {
    if (!userId) return null;
    if (!store.users[userId]) {
      store.users[userId] = {
        active: false,
        startedAt: null,
        stoppedAt: null,
        startRating: null,
        startRank: null,
        currentRating: null,
        currentRank: null,
        lastRating: null,
        lastRank: null,
        games: [],
        lastMatchMeta: null,
        lastUpdated: null,
        maxGames: 100,
      };
    }
    return store.users[userId];
  }

  function getSession(userId) {
    return userId ? store.users[userId] || null : null;
  }

  function startSession(userId, { rating, rank } = {}) {
    const session = ensureSession(userId);
    if (!session) return null;
    const resolvedRating = normalizeNumber(rating);
    const resolvedRank = normalizeNumber(rank);
    const now = Date.now();
    session.active = true;
    session.startedAt = now;
    session.stoppedAt = null;
    session.startRating = resolvedRating ?? session.currentRating ?? null;
    session.startRank = resolvedRank ?? session.currentRank ?? null;
    session.currentRating = resolvedRating ?? session.currentRating ?? null;
    session.currentRank = resolvedRank ?? session.currentRank ?? null;
    session.lastRating = session.currentRating;
    session.lastRank = session.currentRank;
    session.games = [];
    session.lastMatchMeta = null;
    session.lastUpdated = now;
    save();
    return session;
  }

  function stopSession(userId) {
    const session = ensureSession(userId);
    if (!session) return null;
    session.active = false;
    session.stoppedAt = Date.now();
    session.lastUpdated = Date.now();
    save();
    return session;
  }

  function recordMatchMeta(userId, roomMeta) {
    const session = ensureSession(userId);
    if (!session) return null;
    
    // Only record match if the user was a participant (player1 or player2)
    const isParticipant = roomMeta && userId && (
      roomMeta.player1_id === userId || roomMeta.player2_id === userId
    );
    
    if (!isParticipant) {
      // User is spectating, don't record match metadata
      return session;
    }
    
    session.lastMatchMeta = roomMeta
      ? {
        roomId: roomMeta.roomId || roomMeta.room_id || null,
        winnerId: roomMeta.winnerId ?? roomMeta.winner_id ?? null,
        player1_id: roomMeta.player1_id ?? null,
        player2_id: roomMeta.player2_id ?? null,
        endedAt: Date.now(),
      }
      : null;
    session.lastUpdated = Date.now();
    save();
    return session;
  }

  function applyRatingChange(userId, { rating, rank, roomMeta } = {}) {
    const session = ensureSession(userId);
    if (!session || !session.active) return null;
    const nextRating = normalizeNumber(rating);
    const nextRank = normalizeNumber(rank);
    if (nextRating === null) return session;

    if (nextRating > 0 && (!session.startRating || session.startRating <= 0)) {
      session.startRating = nextRating;
      if (nextRank !== null && (!session.startRank || session.startRank <= 0)) {
        session.startRank = nextRank;
      }
    }

    if (session.lastRating === null || session.lastRating === undefined) {
      session.startRating = session.startRating ?? nextRating;
      session.currentRating = nextRating;
      session.lastRating = nextRating;
      session.currentRank = nextRank ?? session.currentRank ?? null;
      session.lastRank = session.currentRank;
      session.lastUpdated = Date.now();
      save();
      return session;
    }

    if (session.lastRating === nextRating) {
      if (nextRank !== null && nextRank !== undefined) {
        session.currentRank = nextRank;
        session.lastRank = nextRank;
        session.lastUpdated = Date.now();
        save();
      }
      return session;
    }

    const delta = nextRating - session.lastRating;
    const meta = roomMeta || session.lastMatchMeta || {};
    const winnerId = meta?.winnerId ?? null;
    const player1Id = meta?.player1_id ?? null;
    const player2Id = meta?.player2_id ?? null;
    
    // Only record the game if the user was a participant (not spectating)
    const isParticipant = userId && (player1Id === userId || player2Id === userId);
    if (!isParticipant) {
      // User is spectating, update rating but don't record a game
      session.currentRating = nextRating;
      session.currentRank = nextRank ?? session.currentRank ?? null;
      session.lastRating = nextRating;
      session.lastRank = session.currentRank;
      session.lastUpdated = Date.now();
      save();
      return session;
    }
    
    const opponentId = userId === player1Id ? player2Id : userId === player2Id ? player1Id : null;
    const result = winnerId
      ? (winnerId === userId ? 'win' : 'loss')
      : 'unknown';

    const entry = {
      timestamp: Date.now(),
      delta,
      ratingAfter: nextRating,
      rank: nextRank,
      result,
      roomId: meta?.roomId ?? null,
      opponentId,
      winnerId,
    };

    session.games = [...(session.games || []), entry];
    const maxGames = Math.max(10, Math.min(200, session.maxGames || 50));
    if (session.games.length > maxGames) {
      session.games.splice(0, session.games.length - maxGames);
    }

    session.currentRating = nextRating;
    session.currentRank = nextRank ?? session.currentRank ?? null;
    session.lastRating = nextRating;
    session.lastRank = session.currentRank;
    session.lastUpdated = Date.now();
    save();
    return session;
  }

  function applyRatingDelta(userId, { delta, rank, roomMeta, result } = {}) {
    const session = ensureSession(userId);
    if (!session || !session.active) return null;
    const ratingDelta = normalizeNumber(delta);
    if (ratingDelta === null) return session;

    const nextRank = normalizeNumber(rank);
    const meta = roomMeta || session.lastMatchMeta || {};
    const winnerId = meta?.winnerId ?? null;
    const player1Id = meta?.player1_id ?? null;
    const player2Id = meta?.player2_id ?? null;

    const isParticipant = userId && (player1Id === userId || player2Id === userId);
    if (!isParticipant) {
      session.lastUpdated = Date.now();
      save();
      return session;
    }

    const baseRating = normalizeNumber(session.lastRating)
      ?? normalizeNumber(session.currentRating)
      ?? normalizeNumber(session.startRating);
    const nextRating = baseRating !== null ? baseRating + ratingDelta : null;

    const opponentId = userId === player1Id ? player2Id : userId === player2Id ? player1Id : null;
    const resolvedResult = result
      || (winnerId ? (winnerId === userId ? 'win' : 'loss') : 'unknown');

    const entry = {
      timestamp: Date.now(),
      delta: ratingDelta,
      ratingAfter: nextRating,
      rank: nextRank,
      result: resolvedResult,
      roomId: meta?.roomId ?? null,
      opponentId,
      winnerId,
    };

    session.games = [...(session.games || []), entry];
    const maxGames = Math.max(10, Math.min(200, session.maxGames || 50));
    if (session.games.length > maxGames) {
      session.games.splice(0, session.games.length - maxGames);
    }

    if (nextRating !== null) {
      if (nextRating > 0 && (!session.startRating || session.startRating <= 0)) {
        session.startRating = nextRating;
      }
      session.currentRating = nextRating;
      session.lastRating = nextRating;
    }

    if (nextRank !== null && nextRank !== undefined) {
      session.currentRank = nextRank;
      session.lastRank = nextRank;
    }

    session.lastUpdated = Date.now();
    save();
    return session;
  }

  function updateRank(userId, rank) {
    const session = ensureSession(userId);
    if (!session || !session.active) return null;
    const nextRank = normalizeNumber(rank);
    if (nextRank === null) return session;
    session.currentRank = nextRank;
    session.lastRank = nextRank;
    session.lastUpdated = Date.now();
    save();
    return session;
  }

  function getPublicSession(userId) {
    const session = ensureSession(userId);
    if (!session) return null;
    return {
      active: !!session.active,
      startedAt: session.startedAt ?? null,
      stoppedAt: session.stoppedAt ?? null,
      startRating: session.startRating ?? null,
      startRank: session.startRank ?? null,
      currentRating: session.currentRating ?? null,
      currentRank: session.currentRank ?? null,
      games: Array.isArray(session.games) ? session.games : [],
      lastUpdated: session.lastUpdated ?? null,
    };
  }

  load();

  return {
    getSession,
    getPublicSession,
    startSession,
    stopSession,
    recordMatchMeta,
    applyRatingChange,
    applyRatingDelta,
    updateRank,
    SESSION_FILE,
    reload: load,
  };
}

module.exports = {
  createSessionTracker,
};
