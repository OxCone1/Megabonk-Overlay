const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const jsondiffpatch = require('jsondiffpatch');

const DEFAULT_WS_URL = 'ws://127.0.0.1:17502/ws';
const DEFAULT_PLAYER_ID = '1';
const DEFAULT_LOG_PATH = path.join(process.cwd(), 'logs', 'ws-diff.log');

const args = process.argv.slice(2);
const getArgValue = (flag, fallback) => {
  const index = args.findIndex((arg) => arg === flag || arg.startsWith(`${flag}=`));
  if (index < 0) return fallback;
  const value = args[index].includes('=') ? args[index].split('=').slice(1).join('=') : args[index + 1];
  return value ?? fallback;
};

const wsUrl = getArgValue('--ws', DEFAULT_WS_URL);
const playerIdFilter = String(getArgValue('--player', DEFAULT_PLAYER_ID));
const logPath = getArgValue('--log', DEFAULT_LOG_PATH);
const emitInitial = String(getArgValue('--emit-initial', 'false')).toLowerCase() === 'true';

const diffpatcher = jsondiffpatch.create({
  objectHash: (obj) => obj?.id ?? obj?.ingameId ?? JSON.stringify(obj),
  arrays: {
    detectMove: false,
    includeValueOnMove: false,
  },
});

const localImageMapPath = path.join(process.cwd(), 'obs-megabonk-overlay', 'image_map.json');
let localImageMap = null;
try {
  localImageMap = JSON.parse(fs.readFileSync(localImageMapPath, 'utf8'));
} catch (error) {
  console.warn(`[ws-diff] Failed to load image map at ${localImageMapPath}. Names will fall back to IDs.`);
}

const buildLookup = (list) => {
  const map = new Map();
  if (!Array.isArray(list)) return map;
  list.forEach((entry) => {
    if (entry?.ingameId != null) {
      map.set(Number(entry.ingameId), entry);
    }
  });
  return map;
};

const itemLookup = buildLookup(localImageMap?.items);
const tomeLookup = buildLookup(localImageMap?.tomes);
const weaponLookup = buildLookup(localImageMap?.weapons);

const normalizeRarity = (rarity) => {
  if (rarity == null) return 'common';
  if (typeof rarity === 'number') {
    return ['common', 'common', 'rare', 'epic', 'legendary'][rarity] || 'common';
  }
  return String(rarity).toLowerCase();
};

const getItemName = (item) => {
  if (!item) return 'Unknown Item';
  const lookup = itemLookup.get(Number(item.id));
  return lookup?.name || item?.name || `Item ${item.id}`;
};

const getTomeName = (tome) => {
  if (!tome) return 'Unknown Tome';
  const lookup = tomeLookup.get(Number(tome.id));
  return lookup?.name || tome?.name || `Tome ${tome.id}`;
};

const getWeaponName = (weapon) => {
  if (!weapon) return 'Unknown Weapon';
  const lookup = weaponLookup.get(Number(weapon.id));
  return lookup?.name || weapon?.name || `Weapon ${weapon.id}`;
};

const ensureLogDir = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

ensureLogDir(logPath);

// Create a persistent write stream for the log file for reliability
let logStream;
try {
  logStream = fs.createWriteStream(logPath, { flags: 'a', encoding: 'utf8' });
} catch (err) {
  console.error(`[ws-diff] Failed to open log file ${logPath}:`, err);
  logStream = null;
}

// Per-player update counter (used to render [Nth] prefix)
const updateCounter = new Map();
let currentProcessingUpdateCount = null;

const writeLog = (message) => {
  const line = `${message}\n`;
  // Write to console
  process.stdout.write(line);
  // Write to stream if available, fallback to appendFileSync
  if (logStream && !logStream.destroyed) {
    const ok = logStream.write(line);
    if (!ok) {
      // backpressure, handle 'drain'
      logStream.once('drain', () => {});
    }
  } else {
    try {
      fs.appendFileSync(logPath, line, 'utf8');
    } catch (err) {
      // Last resort: print error to stderr
      console.error(`[ws-diff] Failed to write to log file ${logPath}:`, err);
    }
  }
};

// Ensure stream is closed on exit
const closeLogStream = () => {
  if (logStream && !logStream.destroyed) {
    try {
      logStream.end();
    } catch (e) {
      // ignore
    }
  }
};
process.on('exit', closeLogStream);
process.on('SIGINT', () => { closeLogStream(); process.exit(0); });
process.on('SIGTERM', () => { closeLogStream(); process.exit(0); });

const formatTimestamp = (date) => date.toLocaleString('en-US', { hour12: false });

const formatTimeInfo = (curr, prev) => {
  const timeElapsed = curr?.timeElapsed ?? 0;
  const pauseTime = curr?.pauseTime ?? 0;
  const runTime = timeElapsed - pauseTime;

  const prevTimeElapsed = prev?.timeElapsed ?? 0;
  const prevPauseTime = prev?.pauseTime ?? 0;
  const prevRunTime = prevTimeElapsed - prevPauseTime;

  const deltaTimeElapsed = timeElapsed - prevTimeElapsed;
  const deltaPauseTime = pauseTime - prevPauseTime;
  const deltaRunTime = runTime - prevRunTime;

  return {
    timeElapsed,
    pauseTime,
    runTime,
    deltaTimeElapsed,
    deltaPauseTime,
    deltaRunTime,
  };
};

const formatDeltaLine = (category, label, delta, timeInfo) => {
  const deltaStr = (typeof delta === 'number' && delta < 0) ? `[${delta}]` : `${delta}`;
  const uc = currentProcessingUpdateCount != null ? currentProcessingUpdateCount : 0;
  const updatePrefix = `[${uc}] `;
  return `${updatePrefix}[${formatTimestamp(new Date())}] [${category}] ${label} — ${deltaStr} — timeElapsed: ${timeInfo.timeElapsed} (Δ${timeInfo.deltaTimeElapsed}), pauseTime: ${timeInfo.pauseTime} (Δ${timeInfo.deltaPauseTime}), runTime: ${timeInfo.runTime} (Δ${timeInfo.deltaRunTime})`;
};

const buildItemMap = (items = []) => {
  const map = new Map();
  items.forEach((item) => {
    if (item?.id == null) return;
    const rarity = normalizeRarity(item.rarity);
    const key = `${item.id}-${rarity}`;
    map.set(key, { ...item, rarity, count: item.count || 1 });
  });
  return map;
};

const buildTomeMap = (tomes = []) => {
  const map = new Map();
  tomes.forEach((tome) => {
    if (tome?.id == null) return;
    map.set(tome.id, { ...tome, level: tome.level || 0 });
  });
  return map;
};

const buildWeaponMap = (weapons = []) => {
  const map = new Map();
  weapons.forEach((weapon) => {
    if (weapon?.id == null) return;
    map.set(weapon.id, { ...weapon, level: weapon.level || 0 });
  });
  return map;
};

const diffStats = (prev, curr, timeInfo) => {
  const prevStats = prev?.character?.stats || {};
  const currStats = curr?.character?.stats || {};
  const keys = new Set([...Object.keys(prevStats), ...Object.keys(currStats)]);

  keys.forEach((key) => {
    const prevVal = prevStats[key] ?? 0;
    const currVal = currStats[key] ?? 0;
    if (prevVal !== currVal) {
      const delta = currVal - prevVal;
      writeLog(formatDeltaLine('Stat', key, delta, timeInfo));
    }
  });
};

const diffItems = (prev, curr, timeInfo) => {
  const prevMap = buildItemMap(prev?.equipment?.items || []);
  const currMap = buildItemMap(curr?.equipment?.items || []);

  currMap.forEach((currItem, key) => {
    const prevItem = prevMap.get(key);
    if (!prevItem) {
      writeLog(formatDeltaLine('Item', getItemName(currItem), currItem.count || 1, timeInfo));
    } else if ((prevItem.count || 1) !== (currItem.count || 1)) {
      const delta = (currItem.count || 1) - (prevItem.count || 1);
      writeLog(formatDeltaLine('Item', getItemName(currItem), delta, timeInfo));
    }
  });

  prevMap.forEach((prevItem, key) => {
    if (!currMap.has(key)) {
      const count = prevItem.count || 1;
      writeLog(formatDeltaLine('Item', getItemName(prevItem), -count, timeInfo));
    }
  });
};

const diffTomes = (prev, curr, timeInfo) => {
  const prevMap = buildTomeMap(prev?.equipment?.tomes || []);
  const currMap = buildTomeMap(curr?.equipment?.tomes || []);

  currMap.forEach((currTome, id) => {
    const prevTome = prevMap.get(id);
    if (!prevTome) {
      writeLog(formatDeltaLine('Tome', getTomeName(currTome), currTome.level || 1, timeInfo));
    } else if ((currTome.level || 0) !== (prevTome.level || 0)) {
      const delta = (currTome.level || 0) - (prevTome.level || 0);
      writeLog(formatDeltaLine('Tome', getTomeName(currTome), delta, timeInfo));
    }
  });

  prevMap.forEach((prevTome, id) => {
    if (!currMap.has(id)) {
      writeLog(formatDeltaLine('Tome', getTomeName(prevTome), -(prevTome.level || 1), timeInfo));
    }
  });
};

const diffWeapons = (prev, curr, timeInfo) => {
  const prevMap = buildWeaponMap(prev?.equipment?.weapons || []);
  const currMap = buildWeaponMap(curr?.equipment?.weapons || []);

  currMap.forEach((currWeapon, id) => {
    const prevWeapon = prevMap.get(id);
    if (!prevWeapon) {
      writeLog(formatDeltaLine('Weapon', getWeaponName(currWeapon), currWeapon.level || 1, timeInfo));
    } else if ((currWeapon.level || 0) !== (prevWeapon.level || 0)) {
      const delta = (currWeapon.level || 0) - (prevWeapon.level || 0);
      writeLog(formatDeltaLine('Weapon', getWeaponName(currWeapon), delta, timeInfo));
    }
  });

  prevMap.forEach((prevWeapon, id) => {
    if (!currMap.has(id)) {
      writeLog(formatDeltaLine('Weapon', getWeaponName(prevWeapon), -(prevWeapon.level || 1), timeInfo));
    }
  });
};

const diffInteractions = (prev, curr, timeInfo) => {
  const prevChests = prev?.combat?.chests || {};
  const currChests = curr?.combat?.chests || {};
  const prevShrines = prev?.combat?.shrines || {};
  const currShrines = curr?.combat?.shrines || {};
  const prevShady = prev?.combat?.shadyGuys || {};
  const currShady = curr?.combat?.shadyGuys || {};

  const chestKeys = ['normal', 'free', 'corrupt'];
  chestKeys.forEach((key) => {
    const delta = (currChests?.[key] || 0) - (prevChests?.[key] || 0);
    if (delta !== 0) {
      const label = key === 'free' ? 'Free Chest' : key === 'corrupt' ? 'Corrupt Chest' : 'Chest';
      writeLog(formatDeltaLine('Interaction', label, delta, timeInfo));
    }
  });

  const shrineKeys = [
    { key: 'charge_normal', label: 'Charge Shrine' },
    { key: 'charge_golden', label: 'Golden Shrine' },
    { key: 'moai', label: 'Moai' },
  ];
  shrineKeys.forEach(({ key, label }) => {
    const delta = (currShrines?.[key] || 0) - (prevShrines?.[key] || 0);
    if (delta !== 0) {
      writeLog(formatDeltaLine('Interaction', label, delta, timeInfo));
    }
  });

  const shadyKeys = ['common', 'rare', 'epic', 'legendary'];
  shadyKeys.forEach((key) => {
    const delta = (currShady?.[key] || 0) - (prevShady?.[key] || 0);
    if (delta !== 0) {
      const label = `${key.charAt(0).toUpperCase()}${key.slice(1)} Shady`;
      writeLog(formatDeltaLine('Interaction', label, delta, timeInfo));
    }
  });

  // MICROWAVE: handle per-rarity counters { common, rare, epic, legendary }
  const prevMicrowaves = prev?.combat?.microwavesActivated ?? {};
  const currMicrowaves = curr?.combat?.microwavesActivated ?? {};

  // If microwaves are reported as a number (legacy), treat as common total
  const normalizeMicrowaveObject = (mic) => {
    if (mic == null) return { common: 0, rare: 0, epic: 0, legendary: 0 };
    if (typeof mic === 'number') return { common: mic, rare: 0, epic: 0, legendary: 0 };
    return {
      common: mic.common ?? 0,
      rare: mic.rare ?? 0,
      epic: mic.epic ?? 0,
      legendary: mic.legendary ?? 0,
    };
  };

  const prevMicObj = normalizeMicrowaveObject(prevMicrowaves);
  const currMicObj = normalizeMicrowaveObject(currMicrowaves);
  ['common', 'rare', 'epic', 'legendary'].forEach((rarity) => {
    const delta = (currMicObj[rarity] || 0) - (prevMicObj[rarity] || 0);
    if (delta !== 0) {
      // Format label as "Microwave — Rarity"
      const rarityLabel = `${rarity.charAt(0).toUpperCase()}${rarity.slice(1)}`;
      const uc = currentProcessingUpdateCount != null ? currentProcessingUpdateCount : 0;
      const updatePrefix = `[${uc}] `;
      const line = `${updatePrefix}[${formatTimestamp(new Date())}] [Interaction] Microwave — ${rarityLabel} — timeElapsed: ${timeInfo.timeElapsed} (Δ${timeInfo.deltaTimeElapsed}), pauseTime: ${timeInfo.pauseTime} (Δ${timeInfo.deltaPauseTime}), runTime: ${timeInfo.runTime} (Δ${timeInfo.deltaRunTime})`;
      writeLog(line);
    }
  });

  // Portals Entered
  const prevPortals = prev?.combat?.portalsEntered || 0;
  const currPortals = curr?.combat?.portalsEntered || 0;
  const deltaPortals = currPortals - prevPortals;
  if (deltaPortals !== 0) {
    writeLog(formatDeltaLine('Interaction', 'Portal Entered', deltaPortals, timeInfo));
  }
};

const diffLevels = (prev, curr, timeInfo) => {
  const prevLevel = prev?.character?.level ?? 0;
  const currLevel = curr?.character?.level ?? 0;
  const delta = currLevel - prevLevel;
  if (delta !== 0) {
    writeLog(formatDeltaLine('Stat', 'Level', delta, timeInfo));
  }
};

const stateByPlayer = new Map();

const trySubscribePlayer = (pid) => {
  if (!pid) return;
  const chan = `gamesync:player:${pid}`;
  if (subscribedPlayers.has(chan)) return;
  ws.send(JSON.stringify({ subscribe: { channel: chan, flag: 1 } }));
  subscribedPlayers.add(chan);
  writeLog(`[${formatTimestamp(new Date())}] Subscribed to ${chan}`);
};

const applyUpdate = (playerId, playerState) => {
  // Map to trackedPlayerId - only process the player we care about
  if (String(playerId) !== String(trackedPlayerId)) return;

  // Increment per-player update counter and set current for the processing scope
  const currentCount = (updateCounter.get(playerId) || 0) + 1;
  updateCounter.set(playerId, currentCount);
  currentProcessingUpdateCount = currentCount;

  try {
    const prevState = stateByPlayer.get(playerId);
    if (!prevState) {
      const empty = {
        character: { level: 0, stats: {} },
        equipment: { items: [], tomes: [], weapons: [] },
        combat: {},
      };
      const timeInfo = formatTimeInfo(playerState, empty);
      writeLog(formatDeltaLine('Tick', 'Update', 0, timeInfo));

      // Optionally emit initial snapshot as deltas
      if (emitInitial) {
        diffLevels(empty, playerState, timeInfo);
        diffStats(empty, playerState, timeInfo);
        diffItems(empty, playerState, timeInfo);
        diffTomes(empty, playerState, timeInfo);
        diffWeapons(empty, playerState, timeInfo);
        diffInteractions(empty, playerState, timeInfo);
      }

      stateByPlayer.set(playerId, playerState);
      return;
    }

    const timeInfo = formatTimeInfo(playerState, prevState);
    writeLog(formatDeltaLine('Tick', 'Update', 0, timeInfo));

    diffpatcher.diff(prevState, playerState);

    diffLevels(prevState, playerState, timeInfo);
    diffStats(prevState, playerState, timeInfo);
    diffItems(prevState, playerState, timeInfo);
    diffTomes(prevState, playerState, timeInfo);
    diffWeapons(prevState, playerState, timeInfo);
    diffInteractions(prevState, playerState, timeInfo);

    stateByPlayer.set(playerId, playerState);
  } finally {
    // Clear currentProcessingUpdateCount after handling
    currentProcessingUpdateCount = null;
  }
};

const ws = new WebSocket(wsUrl);
let heartbeatInterval = null;
let relayToken = null;

// Track subscriptions and the actual tracked player id (supports slot '1'/'2')
const subscribedRooms = new Set();
const subscribedPlayers = new Set();
let trackedPlayerId = playerIdFilter; // may be updated to actual numeric id when room context arrives

ws.on('open', () => {
  writeLog(`[${formatTimestamp(new Date())}] Connected to ${wsUrl} (tracked ${trackedPlayerId})`);
});

ws.on('message', (data) => {
  let message = null;
  try {
    message = JSON.parse(data.toString());
  } catch (error) {
    return;
  }

  if (!message?.type) return;

  if (message.type === 'welcome') {
    relayToken = message.token || null;
    writeLog(`[${formatTimestamp(new Date())}] Received welcome (token ${relayToken ? 'yes' : 'no'})`);

    // Register exactly like the SPA client so we receive updates the same way
    ws.send(JSON.stringify({
      type: 'register',
      origin: 'megabonk-spa',
      clientType: 'spa',
      token: relayToken,
    }));
    ws.send(JSON.stringify({ type: 'get-context', token: relayToken }));

    // Try to subscribe to the tracked player channel (may be slot '1'/'2' and resolved later)
    trySubscribePlayer(trackedPlayerId);

    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN && relayToken) {
        ws.send(JSON.stringify({ type: 'heartbeat', token: relayToken }));
      }
    }, 30000);
  }

  if (message.type === 'context-update') {
    if (message.updateType === 'game' || !message.updateType) {
      const players = message.context?.room?.players || [];
      players.forEach((player) => applyUpdate(player.playerId, player));

      // If context provides active room, subscribe to room channel
      const activeRoom = message.context?.room?.activeRoom;
      if (activeRoom && !subscribedRooms.has(activeRoom)) {
        const roomChan = `gamesync:room:${activeRoom}`;
        ws.send(JSON.stringify({ subscribe: { channel: roomChan, flag: 1 } }));
        subscribedRooms.add(activeRoom);
        writeLog(`[${formatTimestamp(new Date())}] Subscribed to ${roomChan}`);
      }

      // Resolve slot-based player filter (if user passed '1' or '2')
      const roomMeta = message.context?.room?.roomMeta || {};
      if (playerIdFilter === '1' || playerIdFilter === '2') {
        const slot = Number(playerIdFilter);
        const mapped = slot === 1 ? roomMeta.player1_id : roomMeta.player2_id;
        if (mapped && String(mapped) !== String(trackedPlayerId)) {
          trackedPlayerId = String(mapped);
          writeLog(`[${formatTimestamp(new Date())}] Resolved slot ${slot} -> playerId ${trackedPlayerId}`);
          trySubscribePlayer(trackedPlayerId);
        }
      }
    }
  }

  if (message.type === 'player-update') {
    // If user requested slot-based tracking (1 or 2), try to resolve actual playerId from room metadata
    if ((playerIdFilter === '1' || playerIdFilter === '2') && message.room?.roomMeta) {
      const slot = Number(playerIdFilter);
      const mapped = slot === 1 ? message.room.roomMeta.player1_id : message.room.roomMeta.player2_id;
      if (mapped && String(mapped) !== String(trackedPlayerId)) {
        trackedPlayerId = String(mapped);
        writeLog(`[${formatTimestamp(new Date())}] Resolved slot ${slot} -> playerId ${trackedPlayerId} (via player-update)`);
        trySubscribePlayer(trackedPlayerId);
      }
    }

    // Apply update only if it matches the tracked player (to avoid noise)
    if (String(message.playerId) === String(trackedPlayerId)) {
      applyUpdate(message.playerId, message.player);
    } else {
      // If not matching, log for visibility when debugging
    //   writeLog(`[${formatTimestamp(new Date())}] Ignored player-update for ${message.playerId} (tracking ${trackedPlayerId})`);
    }
  }

  // Some messages come as 'push' for gamesync channels
  if (message.push && message.push.channel) {
    const chan = message.push.channel;
    const pub = message.push.pub || {};
    writeLog(`[${formatTimestamp(new Date())}] Push on ${chan}`);

    // Player channel pushes often include a 'player' or direct player data
    if (chan.startsWith('gamesync:player:')) {
      const data = pub.data || {};
      // If data contains 'player' object, use it
      if (data.player) {
        const pid = String(data.player.playerId || data.player.player_id || trackedPlayerId);
        applyUpdate(pid, data.player);
      } else if (data.run_data || data.playerId) {
        // Older payload shapes
        const pid = String(data.playerId || trackedPlayerId);
        applyUpdate(pid, data.run_data || data.player || {});
      }
    }

    // Room channel pushes may include player updates inside 'data'
    if (chan.startsWith('gamesync:room:') && pub.data && pub.data.player) {
      const pid = String(pub.data.player.playerId || pub.data.player.player_id || trackedPlayerId);
      applyUpdate(pid, pub.data.player);
    }
  }
});

ws.on('close', () => {
  writeLog(`[${formatTimestamp(new Date())}] WebSocket closed`);
  if (heartbeatInterval) clearInterval(heartbeatInterval);
});

ws.on('error', (error) => {
  writeLog(`[${formatTimestamp(new Date())}] WebSocket error: ${error.message}`);
});
