function createRoomCache({ maxSize = 10, log }) {
  const cache = new Map(); // roomId -> { room, raw, lastAccessed, timestamp }

  function touch(roomId) {
    const entry = cache.get(roomId);
    if (entry) {
      entry.lastAccessed = Date.now();
    }
    return entry || null;
  }

  function evictIfNeeded() {
    if (cache.size <= maxSize) return;
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [key, value] of cache.entries()) {
      if (value.lastAccessed < oldestTime) {
        oldestTime = value.lastAccessed;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      cache.delete(oldestKey);
      log(`[RoomCache] Evicted oldest room: ${oldestKey} (cache size: ${cache.size})`);
    }
  }

  function setRoom(roomId, roomBundle, rawRoomData = null) {
    if (!roomId) return;
    const now = Date.now();
    cache.set(roomId, {
      room: roomBundle,
      raw: rawRoomData,
      lastAccessed: now,
      timestamp: now,
    });
    evictIfNeeded();
    log(`[RoomCache] Cached room ${roomId} (cache size: ${cache.size})`);
  }

  function updateRoom(roomId, partialRoomBundle) {
    if (!roomId || !partialRoomBundle) return;
    const existing = cache.get(roomId);
    const now = Date.now();
    const room = {
      ...(existing?.room || {}),
      ...partialRoomBundle,
    };
    cache.set(roomId, {
      room,
      raw: existing?.raw || null,
      lastAccessed: now,
      timestamp: existing?.timestamp || now,
    });
  }

  function updateRoomRaw(roomId, rawRoomData) {
    if (!roomId) return;
    const existing = cache.get(roomId);
    const now = Date.now();
    cache.set(roomId, {
      room: existing?.room || null,
      raw: rawRoomData,
      lastAccessed: now,
      timestamp: existing?.timestamp || now,
    });
  }

  function getRoom(roomId) {
    const entry = touch(roomId);
    return entry?.room || null;
  }

  function getRoomRaw(roomId) {
    const entry = touch(roomId);
    return entry?.raw || null;
  }

  function hasRoom(roomId) {
    return cache.has(roomId);
  }

  function listRooms() {
    return Array.from(cache.keys());
  }

  return {
    setRoom,
    updateRoom,
    updateRoomRaw,
    getRoom,
    getRoomRaw,
    hasRoom,
    listRooms,
  };
}

module.exports = {
  createRoomCache,
};
