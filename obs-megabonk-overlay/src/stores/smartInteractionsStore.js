import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { subscribeWithSelector } from 'zustand/middleware';
import * as jsondiffpatch from 'jsondiffpatch';
import { resolvePublicAssetPath } from '@/lib/publicAsset';

const toGameIconPath = (relativePath) => resolvePublicAssetPath(relativePath);

/**
 * Smart Interactions Store
 * 
 * Detects and manages game interaction events based on state diffs:
 * - Chests: Item gains from chest counter increases
 * - Moai: Stat/item gains from moai shrine counter increases
 * - Shrines: Stat gains from charge shrine interactions (normal/golden)
 * - Shady Guy: Item gains without corresponding chest/shrine/moai increases
 * - Other: Unattributed item gains that don't match known sources
 * - Microwave: Item upgrades (item removed + upgraded item added)
 * - Chaos Tome: Random stat gains during levelups when Chaos Tome equipped
 * - Tomes/Levelups: All tome-based stat gains on level up
 */

// Interaction type definitions with metadata
export const INTERACTION_TYPES = {
    CHEST: {
        id: 'chest',
        label: 'Chests',
        icon: toGameIconPath('/Game Icons/Interface/normal_chest.png'),
        color: 'text-amber-400',
        bgColor: 'bg-amber-500/20',
        borderColor: 'border-amber-500/40',
    },
    MOAI: {
        id: 'moai',
        label: 'Moai',
        icon: toGameIconPath('/Game Icons/Interface/moai.png'),
        color: 'text-stone-300',
        bgColor: 'bg-stone-500/20',
        borderColor: 'border-stone-500/40',
    },
    SHRINE: {
        id: 'shrine',
        label: 'Shrines',
        icon: toGameIconPath('/Game Icons/Interface/charge_normal.png'),
        color: 'text-purple-400',
        bgColor: 'bg-purple-500/20',
        borderColor: 'border-purple-500/40',
    },
    GOLDEN_SHRINE: {
        id: 'goldenShrine',
        label: 'Golden Shrines',
        icon: toGameIconPath('/Game Icons/Interface/charge_golden.png'),
        color: 'text-yellow-400',
        bgColor: 'bg-yellow-500/20',
        borderColor: 'border-yellow-500/40',
    },
    SHADY_GUY: {
        id: 'shadyGuy',
        label: 'Shady Guy',
        icon: toGameIconPath('/Game Icons/Interface/rare_shady.png'),
        color: 'text-green-400',
        bgColor: 'bg-green-500/20',
        borderColor: 'border-green-500/40',
    },
    MICROWAVE: {
        id: 'microwave',
        label: 'Microwave',
        icon: toGameIconPath('/Game Icons/Interface/rare_micro.png'),
        color: 'text-cyan-400',
        bgColor: 'bg-cyan-500/20',
        borderColor: 'border-cyan-500/40',
    },
    CHAOS_TOME: {
        id: 'chaosTome',
        label: 'Chaos Tome',
        icon: toGameIconPath('/Game Icons/Tomes/ChaosTome.png'),
        color: 'text-red-400',
        bgColor: 'bg-red-500/20',
        borderColor: 'border-red-500/40',
    },
    LEVELUP: {
        id: 'levelup',
        label: 'Level Up',
        icon: toGameIconPath('/Game Icons/Interface/arrow.png'),
        color: 'text-blue-400',
        bgColor: 'bg-blue-500/20',
        borderColor: 'border-blue-500/40',
    },
    OTHER: {
        id: 'other',
        label: 'Other',
        icon: toGameIconPath('/Game Icons/Interface/gold.png'),
        color: 'text-slate-300',
        bgColor: 'bg-slate-500/20',
        borderColor: 'border-slate-500/40',
    },
    STAT_CHANGE: {
        id: 'statChange',
        label: 'Stat Change',
        icon: '',
        color: 'text-white/90',
        bgColor: 'bg-transparent',
        borderColor: 'border-transparent',
    },
};

// Chaos Tome ingameId
const CHAOS_TOME_ID = 24;

const normalizePlayerKey = (playerId) => (
    playerId === 1 || playerId === '1' ? 'player1'
        : playerId === 2 || playerId === '2' ? 'player2'
            : playerId
);

// Hero passive stat mapping (ignore these per hero)
const HERO_PASSIVE_STAT_KEY_BY_HERO_ID = {
    0: 'Luck', // Fox
    1: 'MoveSpeedMultiplier', // Calcium
    2: 'Armor', // Sir Oofie
    3: 'CritChance', // CL4NK
    4: 'AttackSpeed', // Megachad
    5: 'DamageMultiplier', // Ogre
    6: 'GoldIncreaseMultiplier', // Robinette
    7: 'Thorns', // Athena
    8: 'AirborneDamage', // Birdo (if present)
    9: 'CritDamage', // Bush
    10: 'AttackSpeed', // Bandit
    11: 'MaxHealth', // Monke (already ignored globally)
    12: 'SizeMultiplier', // Noelle
    13: 'PickupRange', // Tony McZoom
    15: 'XpIncreaseMultiplier', // Spaceman
    16: 'Evasion', // Ninja
    17: 'Lifesteal', // Vlad
    19: 'Difficulty', // Sir Chadwell
};

const RARITY_MAP = {
    1: 'common',
    2: 'rare',
    3: 'epic',
    4: 'legendary',
    common: 'common',
    rare: 'rare',
    epic: 'epic',
    legendary: 'legendary',
};

const normalizeRarity = (rarity) => {
    if (rarity == null) return 'common';
    if (typeof rarity === 'number') return RARITY_MAP[rarity] || 'common';
    const numeric = Number(rarity);
    if (!Number.isNaN(numeric)) return RARITY_MAP[numeric] || String(rarity).toLowerCase();
    return RARITY_MAP[String(rarity).toLowerCase()] || String(rarity).toLowerCase();
};

export const STAT_CONFIG = {
    MaxHealth: { label: 'Max HP', unit: 'number' },
    HealthRegen: { label: 'HP Regen', unit: 'number' },
    Overheal: { label: 'Overheal', unit: 'percent' },
    Shield: { label: 'Shield', unit: 'number' },
    Thorns: { label: 'Thorns', unit: 'number' },
    Armor: { label: 'Armor', unit: 'percent' },
    Evasion: { label: 'Evasion', unit: 'percent' },
    Lifesteal: { label: 'Lifesteal', unit: 'percent' },
    DamageMultiplier: { label: 'Damage', unit: 'percent' },
    AttackSpeed: { label: 'Attack Speed', unit: 'percent' },
    CritChance: { label: 'Crit Chance', unit: 'percent' },
    CritDamage: { label: 'Crit Damage', unit: 'percent' },
    Projectiles: { label: 'Projectile Count', unit: 'number' },
    ProjectileBounces: { label: 'Projectile Bounces', unit: 'number' },
    SizeMultiplier: { label: 'Size', unit: 'percent' },
    DurationMultiplier: { label: 'Duration', unit: 'percent' },
    ProjectileSpeedMultiplier: { label: 'Projectile Speed', unit: 'percent' },
    MoveSpeedMultiplier: { label: 'Movement Speed', unit: 'percent' },
    KnockbackMultiplier: { label: 'Knockback', unit: 'percent' },
    EliteDamageMultiplier: { label: 'Damage to Elites', unit: 'percent' },
    ExtraJumps: { label: 'Extra Jumps', unit: 'number' },
    JumpHeight: { label: 'Jump Height', unit: 'percent' },
    Luck: { label: 'Luck', unit: 'percent' },
    Difficulty: { label: 'Difficulty', unit: 'percent' },
    PickupRange: { label: 'Pickup Range', unit: 'percent' },
    XpIncreaseMultiplier: { label: 'XP Gain', unit: 'percent' },
    GoldIncreaseMultiplier: { label: 'Gold Gain', unit: 'percent' },
    EliteSpawnIncrease: { label: 'Elite Spawn Increase', unit: 'percent' },
    PowerupBoostMultiplier: { label: 'Powerup Multiplier', unit: 'percent' },
    PowerupChance: { label: 'Powerup Drop Chance', unit: 'percent' },
};

const STAT_KEYS = new Set(Object.keys(STAT_CONFIG));
const ALWAYS_DISABLED_STATS = new Set(['DamageMultiplier', 'HealthRegen', 'Luck']);

const PENDING_SOURCE_TIMEOUT_MS = 600000;
const MICROWAVE_PENDING_TIMEOUT_MS = 60000;
const MICROWAVE_PENDING_TIMEOUT_SECONDS = 60;

const diffpatcher = jsondiffpatch.create({
    objectHash: (obj) => obj?.id ?? obj?.ingameId ?? JSON.stringify(obj),
    arrays: {
        detectMove: false,
        includeValueOnMove: false,
    },
});

const cloneSnapshot = (snapshot) => JSON.parse(JSON.stringify(snapshot || {}));

const getRunTimeSeconds = (snapshot) => {
    const timeElapsed = snapshot?.meta?.timeElapsed;
    const pauseTime = snapshot?.meta?.pauseTime;
    if (typeof timeElapsed !== 'number' || typeof pauseTime !== 'number') return null;
    const actual = timeElapsed - pauseTime;
    if (!Number.isFinite(actual)) return null;
    return Math.max(0, actual);
};

const DEFAULT_STAT_VISIBILITY = Object.keys(STAT_CONFIG).reduce((acc, key) => {
    acc[key] = true;
    return acc;
}, {});
DEFAULT_STAT_VISIBILITY.DamageMultiplier = false;
DEFAULT_STAT_VISIBILITY.HealthRegen = false;

// Maximum events to keep in history per player
const MAX_EVENT_HISTORY = 50;

// Event display duration in milliseconds
const EVENT_DISPLAY_DURATION = 5000;

/**
 * Create fake event data for debug purposes
 */
const createFakeEventData = (eventTypeId) => {
    switch (eventTypeId) {
        case 'chest':
            return {
                count: 1,
                chestType: 'normal',
                gainedItem: { id: 1, rarity: 'common', localData: null },
            };
        case 'freeChest':
            return {
                count: 1,
                chestType: 'free',
                gainedItem: { id: 2, rarity: 'rare', localData: null },
            };
        case 'moai':
            return {
                count: 1,
                gainedItem: { id: 3, rarity: 'epic', localData: null },
            };
        case 'shrine':
            return {
                count: 1,
                statChange: { stat: 'MaxHealth', displayDelta: 10, unit: 'number', label: 'Max HP' },
                noSource: true,
            };
        case 'goldenShrine':
            return {
                count: 1,
                statChange: { stat: 'CritChance', displayDelta: 5, unit: 'percent', label: 'Crit Chance' },
                noSource: true,
            };
        case 'shadyGuy':
            return {
                count: 1,
                shadyRarity: 'rare',
                gainedItem: { id: 4, rarity: 'rare', localData: null },
            };
        case 'microwave':
            return {
                count: 1,
                microwaveRarity: 'common',
                burnedItem: { id: 5, rarity: 'common', localData: null },
                replicatedItem: { id: 6, rarity: 'common', localData: null },
            };
        case 'chaosTome':
            return {
                count: 1,
                statChange: { stat: 'Luck', displayDelta: 10, unit: 'percent', label: 'Luck' },
                noSource: true,
            };
        case 'levelup':
            return {
                count: 1,
                statChange: { stat: 'DamageMultiplier', displayDelta: 10, unit: 'percent', label: 'Damage' },
                noSource: true,
            };
        case 'statChange':
            return {
                statChange: { stat: 'Armor', displayDelta: 5, unit: 'percent', label: 'Armor' },
                noSource: true,
            };
        default:
            return {};
    }
};

/**
 * Detect interaction type from a state diff
 * Returns an array of detected events with their details
 * 
 * CHEST DETECTION BEHAVIOR:
 * When a chest is opened, the game pauses (runTime = timeElapsed - pauseTime stays constant).
 * The chest counter increases, but we don't know yet if an item was gained or banished.
 * 
 * Resolution logic:
 * 1. If an item is gained in the same or next update → Create chest event with item
 * 2. If runTime starts increasing (game unpauses) without item gain → Item was banished, discard event
 * 3. If timeout (10 minutes) → Discard event (safety fallback)
 * 
 * This ensures we only show chest events when an item was actually obtained, and we silently
 * discard banished items without creating UI noise.
 */
function detectInteractions(
    prevSnapshot,
    currentSnapshot,
    diff,
    getLocalItemByIngameId,
    getLocalTomeByIngameId,
    debugLogging,
    pendingShadyQueue = [],
    pendingMicrowaveQueue = [],
    pendingChestQueue = [],
    pendingMoaiQueue = [],
    pendingShrineQueue = [],
    pendingPhantomQueue = []
) {
    if (!diff || !diff.hasChanges) {
        return {
            events: [],
            pendingShadyQueue,
            pendingMicrowaveQueue,
            pendingChestQueue,
            pendingMoaiQueue,
            pendingShrineQueue,
            pendingPhantomQueue,
        };
    }

    const events = [];
    const timestamp = Date.now();

    const prevShrines = prevSnapshot?.combat?.shrines || {};
    const currShrines = currentSnapshot?.combat?.shrines || {};
    const prevChests = prevSnapshot?.combat?.chests || {};
    const currChests = currentSnapshot?.combat?.chests || {};
    const prevLevel = prevSnapshot?.character?.level || 0;
    const currLevel = currentSnapshot?.character?.level || 0;
    const prevShady = prevSnapshot?.combat?.shadyGuys || {};
    const currShady = currentSnapshot?.combat?.shadyGuys || {};

    // Calculate counter changes
    const moaiDelta = (currShrines.moai || 0) - (prevShrines.moai || 0);
    const chargeNormalDelta = (currShrines.charge_normal || 0) - (prevShrines.charge_normal || 0);
    const chargeGoldenDelta = (currShrines.charge_golden || 0) - (prevShrines.charge_golden || 0);
    const normalChestDelta = (currChests.normal || 0) - (prevChests.normal || 0);
    const freeChestDelta = (currChests.free || 0) - (prevChests.free || 0);
    const corruptChestDelta = (currChests.corrupt || 0) - (prevChests.corrupt || 0);
    const totalChestDelta = normalChestDelta + freeChestDelta + corruptChestDelta;
    const levelDelta = currLevel - prevLevel;
    const autoLeveling = levelDelta > 0
        && currentSnapshot?.meta?.isPaused === false
        && (diff.stats ? Object.keys(diff.stats).length > 1 : false);

    // Check if player has Chaos Tome equipped
    const hasChaosT = currentSnapshot?.equipment?.tomes?.some(t => t?.id === CHAOS_TOME_ID);

    const logDebug = (label, payload) => {
        if (!debugLogging) return;
        console.log(`[SmartInteractions] ${label}`, payload);
    };

    const nextPendingShady = [...pendingShadyQueue];
    const nextPendingMicrowave = [...pendingMicrowaveQueue];
    const nextPendingChest = [...pendingChestQueue];
    const nextPendingMoai = [...pendingMoaiQueue];
    const nextPendingShrine = [...pendingShrineQueue];
    const nextPendingPhantom = [...pendingPhantomQueue];
    const attributedStats = new Set();

    const pushItems = (pool, item, count = 1) => {
        const safeCount = Math.max(0, count || 0);
        for (let i = 0; i < safeCount; i += 1) {
            pool.push({ ...item, count: 1 });
        }
    };

    const itemAddPool = [];
    const itemRemovePool = [];

    if (diff.items?.added?.length) {
        diff.items.added.forEach((item) => {
            pushItems(itemAddPool, { ...item, rarity: normalizeRarity(item.rarity) }, item.count || 1);
        });
    }

    if (diff.items?.changed?.length) {
        diff.items.changed.forEach((item) => {
            if (item.countDelta > 0) {
                pushItems(itemAddPool, { ...item, rarity: normalizeRarity(item.rarity) }, item.countDelta);
            } else if (item.countDelta < 0) {
                pushItems(itemRemovePool, { ...item, rarity: normalizeRarity(item.rarity) }, Math.abs(item.countDelta));
            }
        });
    }

    if (diff.items?.removed?.length) {
        diff.items.removed.forEach((item) => {
            pushItems(itemRemovePool, { ...item, rarity: normalizeRarity(item.rarity) }, item.count || 1);
        });
    }

    const runTimeSeconds = getRunTimeSeconds(currentSnapshot);
    const prevRunTimeSeconds = getRunTimeSeconds(prevSnapshot);

    logDebug('Snapshot deltas', {
        levelDelta,
        moaiDelta,
        chargeNormalDelta,
        chargeGoldenDelta,
        chestDeltas: { normalChestDelta, freeChestDelta, corruptChestDelta, totalChestDelta },
        shadyGuys: {
            common: (currShady.common || 0) - (prevShady.common || 0),
            rare: (currShady.rare || 0) - (prevShady.rare || 0),
            epic: (currShady.epic || 0) - (prevShady.epic || 0),
            legendary: (currShady.legendary || 0) - (prevShady.legendary || 0),
        },
        timingInfo: {
            runTimeSeconds,
            prevRunTimeSeconds,
            timeDelta: runTimeSeconds != null && prevRunTimeSeconds != null ? runTimeSeconds - prevRunTimeSeconds : null,
            isPaused: currentSnapshot?.meta?.isPaused,
        },
        hasChaosT,
        diffSummary: {
            statChanges: diff.stats ? Object.keys(diff.stats).length : 0,
            itemsAdded: diff.items?.added?.length || 0,
            itemsRemoved: diff.items?.removed?.length || 0,
            itemsChanged: diff.items?.changed?.length || 0,
        },
    });

    if (totalChestDelta > 0) {
        logDebug('ChestTrace', {
            totalChestDelta,
            normalChestDelta,
            freeChestDelta,
            corruptChestDelta,
            runTimeSeconds,
            prevRunTimeSeconds,
            timeDelta: runTimeSeconds != null && prevRunTimeSeconds != null ? runTimeSeconds - prevRunTimeSeconds : null,
            isPaused: currentSnapshot?.meta?.isPaused,
            itemAddPool: itemAddPool.map((item) => ({ id: item.id, rarity: item.rarity, count: item.count })),
        });
    }

    const allowStats = levelDelta > 0 || chargeNormalDelta > 0 || chargeGoldenDelta > 0;
    const availableStats = allowStats && diff.stats ? Object.values(diff.stats) : [];
    const takeNextStat = () => {
        while (availableStats.length > 0) {
            const statChange = availableStats.shift();
            if (attributedStats.has(statChange.stat)) continue;
            attributedStats.add(statChange.stat);
            return statChange;
        }
        return null;
    };

    const now = Date.now();

    // Queue pending sources that may resolve later
    if (moaiDelta > 0) {
        for (let i = 0; i < moaiDelta; i += 1) {
            nextPendingMoai.push({ id: `moai-pending-${timestamp}-${i}`, createdAt: now });
        }
    }

    const skipShrineSources = levelDelta > 0 && (chargeNormalDelta > 0 || chargeGoldenDelta > 0);

    if (!skipShrineSources) {
        if (chargeGoldenDelta > 0) {
            for (let i = 0; i < chargeGoldenDelta; i += 1) {
                nextPendingShrine.push({ id: `golden-shrine-pending-${timestamp}-${i}`, type: 'golden', createdAt: now });
            }
        }

        if (chargeNormalDelta > 0) {
            for (let i = 0; i < chargeNormalDelta; i += 1) {
                nextPendingShrine.push({ id: `shrine-pending-${timestamp}-${i}`, type: 'normal', createdAt: now });
            }
        }
    }

    // CHEST DETECTION: Queue pending chests to be resolved later
    // Chests pause the game, so we track the run time when opened
    // Resolution happens when:
    // 1. Item is gained in the same/next update -> Show chest with item
    // 2. Run time increases (game unpauses) without item -> Item was banished, close silently
    // 3. Timeout after 10 minutes -> Close silently (safety fallback)
    if (totalChestDelta > 0) {
        for (let i = 0; i < normalChestDelta + corruptChestDelta; i += 1) {
            nextPendingChest.push({
                id: `chest-pending-${timestamp}-normal-${i}`,
                chestType: 'normal',
                createdAt: now,
                createdAtRunTime: runTimeSeconds,
            });
        }
        for (let i = 0; i < freeChestDelta; i += 1) {
            nextPendingChest.push({
                id: `chest-pending-${timestamp}-free-${i}`,
                chestType: 'free',
                createdAt: now,
                createdAtRunTime: runTimeSeconds,
            });
        }
    }

    if (skipShrineSources && availableStats.length > 0) {
        availableStats.forEach((statChange, idx) => {
            attributedStats.add(statChange.stat);
            events.push({
                id: `stat-only-${timestamp}-${idx}`,
                type: INTERACTION_TYPES.STAT_CHANGE,
                timestamp,
                statChange,
                noSource: true,
            });
        });
        availableStats.length = 0;
    }

    const takeItemFromPool = (pool, predicate) => {
        if (!pool.length) return null;
        if (!predicate) return pool.shift();
        const idx = pool.findIndex(predicate);
        if (idx < 0) return pool.shift();
        return pool.splice(idx, 1)[0];
    };

    const resolvePendingWithItems = (pendingQueue, buildEvent, pickItem) => {
        const remaining = [];
        pendingQueue.forEach((pending) => {
            if (itemAddPool.length > 0) {
                const gainedItem = pickItem ? pickItem(itemAddPool) : itemAddPool.shift();
                events.push(buildEvent(pending, gainedItem));
                return;
            }
            if (now - pending.createdAt >= PENDING_SOURCE_TIMEOUT_MS) {
                events.push(buildEvent(pending, null));
                return;
            }
            remaining.push(pending);
        });
        return remaining;
    };

    // 5. MICROWAVE DETECTION: item removed then later added (same rarity, no other source)
    if (itemRemovePool.length > 0) {
        itemRemovePool.forEach((removedItem, idx) => {
            nextPendingMicrowave.push({
                id: `microwave-pending-${timestamp}-${idx}`,
                burnedItem: { ...removedItem, localData: getLocalItemByIngameId?.(removedItem.id) },
                rarity: normalizeRarity(removedItem.rarity),
                timestamp,
                createdAt: now,
                createdAtRunTime: runTimeSeconds,
            });
        });
    }

    const normalizePendingMicrowave = (pending) => ({
        ...pending,
        createdAt: pending.createdAt ?? pending.timestamp ?? now,
        createdAtRunTime: pending.createdAtRunTime ?? runTimeSeconds ?? null,
        rarity: normalizeRarity(pending.rarity),
    });

    const isMicrowaveExpired = (pending) => {
        if (pending?.createdAtRunTime != null && runTimeSeconds != null) {
            return (runTimeSeconds - pending.createdAtRunTime) > MICROWAVE_PENDING_TIMEOUT_SECONDS;
        }
        if (pending?.createdAt != null) {
            return (now - pending.createdAt) > MICROWAVE_PENDING_TIMEOUT_MS;
        }
        return false;
    };

    const pendingMicrowaveCandidates = nextPendingMicrowave.map(normalizePendingMicrowave);
    const activePendingMicrowave = [];
    const expiredPendingMicrowave = [];

    pendingMicrowaveCandidates.forEach((pending) => {
        if (isMicrowaveExpired(pending)) {
            expiredPendingMicrowave.push(pending);
            return;
        }
        activePendingMicrowave.push(pending);
    });

    const resolvePendingChests = (pendingQueue) => {
        const remaining = [];
        pendingQueue.forEach((rawPending) => {
            const pending = {
                ...rawPending,
                createdAt: rawPending.createdAt ?? now,
                createdAtRunTime: rawPending.createdAtRunTime ?? runTimeSeconds ?? null,
            };

            // Priority 1: Check if an item was gained (chest resolved with item)
            if (itemAddPool.length > 0) {
                // Take any available item (don't prioritize microwave rarities for chests)
                const gainedItem = takeItemFromPool(itemAddPool);
                
                logDebug('ChestResolvedWithItem', {
                    pendingId: pending.id,
                    chestType: pending.chestType,
                    itemId: gainedItem?.id,
                    itemRarity: gainedItem?.rarity,
                });
                
                events.push({
                    id: `chest-${pending.id}`,
                    type: INTERACTION_TYPES.CHEST,
                    timestamp: pending.createdAt,
                    count: 1,
                    chestType: pending.chestType,
                    gainedItem: gainedItem ? { ...gainedItem, localData: getLocalItemByIngameId?.(gainedItem.id) } : null,
                    sourceIcon: pending.chestType === 'free'
                        ? toGameIconPath('/Game Icons/Interface/free_chest.png')
                        : toGameIconPath('/Game Icons/Interface/normal_chest.png'),
                });
                return;
            }

            // Priority 2: Check if game time has progressed (game unpaused)
            // Only resolve as banished if:
            // 1. We have valid run time tracking
            // 2. Run time has actually increased (game unpaused)
            // 3. Still no item was gained in this update
            const hasRunTimeProgressed = pending.createdAtRunTime != null
                && runTimeSeconds != null
                && prevRunTimeSeconds != null
                && runTimeSeconds > pending.createdAtRunTime
                && runTimeSeconds > prevRunTimeSeconds; // Ensure time actually increased

            if (hasRunTimeProgressed) {
                // Item was banished - don't create an event, just close this interaction
                logDebug('ChestBanishResolved', {
                    pendingId: pending.id,
                    chestType: pending.chestType,
                    createdAtRunTime: pending.createdAtRunTime,
                    prevRunTimeSeconds,
                    runTimeSeconds,
                    timeDelta: runTimeSeconds - prevRunTimeSeconds,
                });
                return;
            }

            // Priority 3: Timeout fallback (safety mechanism)
            if (now - pending.createdAt >= PENDING_SOURCE_TIMEOUT_MS) {
                logDebug('ChestBanishTimeout', {
                    pendingId: pending.id,
                    chestType: pending.chestType,
                    ageMs: now - pending.createdAt,
                });
                return;
            }

            // Still waiting for resolution - keep in pending queue
            logDebug('ChestStillPending', {
                pendingId: pending.id,
                chestType: pending.chestType,
                createdAtRunTime: pending.createdAtRunTime,
                runTimeSeconds,
                prevRunTimeSeconds,
                itemsAvailable: itemAddPool.length,
            });
            
            remaining.push(pending);
        });
        return remaining;
    };

    const updatedPendingChest = resolvePendingChests(nextPendingChest);

    const updatedPendingMoai = resolvePendingWithItems(nextPendingMoai, (pending, gainedItem) => ({
        id: `moai-${pending.id}`,
        type: INTERACTION_TYPES.MOAI,
        timestamp: pending.createdAt,
        count: 1,
        gainedItem: gainedItem ? { ...gainedItem, localData: getLocalItemByIngameId?.(gainedItem.id) } : null,
        sourceIcon: INTERACTION_TYPES.MOAI.icon,
    }));

    const updatedPendingShrine = [];
    nextPendingShrine.forEach((pending) => {
        const picked = takeNextStat();
        if (!picked) {
            updatedPendingShrine.push(pending);
            return;
        }
        events.push({
            id: `shrine-${pending.id}`,
            type: pending.type === 'golden' ? INTERACTION_TYPES.GOLDEN_SHRINE : INTERACTION_TYPES.SHRINE,
            timestamp: pending.createdAt,
            count: 1,
            statChange: picked,
            noSource: autoLeveling,
        });
    });

    // 6. LEVEL UP / TOME DETECTION
    if (levelDelta > 0) {
        // Get current tomes for stat calculation
        const tomes = currentSnapshot?.equipment?.tomes || [];

        // Calculate expected tome stats
        const tomeStatChanges = {};

        tomes.forEach(tome => {
            if (!tome?.id) return;
            const tomeData = getLocalTomeByIngameId?.(tome.id);
            if (tomeData?.stats) {
                Object.entries(tomeData.stats).forEach(([stat, value]) => {
                    tomeStatChanges[stat] = (tomeStatChanges[stat] || 0) + value;
                });
            }
        });

        const remainingStatChanges = diff.stats
            ? Object.values(diff.stats).filter((statChange) => !attributedStats.has(statChange.stat))
            : [];

        const chaosLevelUp = diff.tomes?.leveledUp?.some((tome) => tome?.id === CHAOS_TOME_ID);

        remainingStatChanges.forEach((statChange, idx) => {
            const expectedFromTomes = tomeStatChanges[statChange.stat] || 0;
            if (expectedFromTomes) {
                events.push({
                    id: `levelup-stat-${timestamp}-${idx}`,
                    type: INTERACTION_TYPES.STAT_CHANGE,
                    timestamp,
                    statChange,
                    noSource: true,
                });
                attributedStats.add(statChange.stat);
                return;
            }

            if (hasChaosT && chaosLevelUp) {
                events.push({
                    id: `chaos-${timestamp}-${idx}`,
                    type: INTERACTION_TYPES.CHAOS_TOME,
                    timestamp,
                    statChange,
                    noSource: autoLeveling,
                });
                attributedStats.add(statChange.stat);
                return;
            }

            events.push({
                id: `levelup-stat-${timestamp}-${idx}`,
                type: INTERACTION_TYPES.STAT_CHANGE,
                timestamp,
                statChange,
                noSource: true,
            });
            attributedStats.add(statChange.stat);
        });
    }

    // 7. SHADY GUY DETECTION: use shadyGuys rarity counters
    const shadyRarities = ['common', 'rare', 'epic', 'legendary'];
    shadyRarities.forEach((rarity) => {
        const delta = (currShady[rarity] || 0) - (prevShady[rarity] || 0);
        if (delta > 0) {
            for (let i = 0; i < delta; i += 1) {
                nextPendingShady.push({
                    id: `shady-pending-${timestamp}-${rarity}-${i}`,
                    rarity,
                    timestamp,
                });
            }
        }
    });

    // Assign pending Shady events to phantom items first, then new items
    const remainingItems = [...itemAddPool];
    const shadedQueue = [...nextPendingShady];
    const resolvedShady = [];
    const phantomItems = [...nextPendingPhantom];

    while (shadedQueue.length > 0 && (phantomItems.length > 0 || remainingItems.length > 0)) {
        const pending = shadedQueue.shift();
        const gainedItem = phantomItems.length > 0 ? phantomItems.shift() : remainingItems.shift();
        if (!gainedItem) break;
        resolvedShady.push({
            id: `shady-${pending.id}`,
            type: INTERACTION_TYPES.SHADY_GUY,
            timestamp: pending.timestamp,
            shadyRarity: pending.rarity,
            sourceIcon: toGameIconPath(`/Game Icons/Interface/${pending.rarity}_shady.png`),
            gainedItem: { ...gainedItem, localData: getLocalItemByIngameId?.(gainedItem.id) },
        });
    }

    resolvedShady.forEach((event) => events.push(event));

    const updatedPendingShady = shadedQueue;
    const updatedPendingPhantom = phantomItems;

    // Microwave resolution: attach next source-less item add to pending microwave (same rarity)
    if (debugLogging && expiredPendingMicrowave.length > 0) {
        logDebug('MicrowaveExpired', {
            expired: expiredPendingMicrowave.map((pending) => ({
                id: pending.id,
                rarity: pending.rarity,
                createdAt: pending.createdAt,
                createdAtRunTime: pending.createdAtRunTime,
            })),
        });
    }

    const microwaveResolved = [];
    const updatedPendingMicrowave = [...activePendingMicrowave];
    const stillRemainingItems = [];

    remainingItems.forEach((addedItem) => {
        const matchIndex = updatedPendingMicrowave.findIndex(
            (pending) => normalizeRarity(pending.rarity) === normalizeRarity(addedItem.rarity)
        );
        if (matchIndex >= 0) {
            const pending = updatedPendingMicrowave.splice(matchIndex, 1)[0];
            microwaveResolved.push({
                id: `microwave-${pending.id}`,
                type: INTERACTION_TYPES.MICROWAVE,
                timestamp: pending.timestamp,
                microwaveRarity: normalizeRarity(pending.rarity),
                microIcon: toGameIconPath(`/Game Icons/Interface/${normalizeRarity(pending.rarity)}_micro.png`),
                burnedItem: pending.burnedItem,
                replicatedItem: { ...addedItem, localData: getLocalItemByIngameId?.(addedItem.id) },
            });
        } else {
            stillRemainingItems.push(addedItem);
        }
    });

    microwaveResolved.forEach((event) => events.push(event));

    stillRemainingItems.forEach((item) => {
        updatedPendingPhantom.push(item);
    });

    if (debugLogging) {
        logDebug('Pending queues', {
            shadyPending: updatedPendingShady.length,
            microwavePending: updatedPendingMicrowave.length,
            chestPending: updatedPendingChest.length,
            moaiPending: updatedPendingMoai.length,
            shrinePending: updatedPendingShrine.length,
            phantomItems: updatedPendingPhantom.length,
            remainingItems: stillRemainingItems.length,
        });
        logDebug('Attributed events', events.map((event) => ({
            id: event.id,
            type: event.type?.id,
            count: event.count,
            stat: event.statChange?.stat,
            item: event.gainedItem?.id || event.replicatedItem?.id || event.burnedItem?.id || null,
        })));
    }

    return {
        events,
        pendingShadyQueue: updatedPendingShady,
        pendingMicrowaveQueue: updatedPendingMicrowave,
        pendingChestQueue: updatedPendingChest,
        pendingMoaiQueue: updatedPendingMoai,
        pendingShrineQueue: updatedPendingShrine,
        pendingPhantomQueue: updatedPendingPhantom,
    };
}

export const useSmartInteractionsStore = create(
    subscribeWithSelector(
        persist(
            (set, get) => ({
                // Event queues per player (events waiting to be displayed)
                eventQueue: {
                    player1: [],
                    player2: [],
                },

                // Event history per player (all detected events)
                eventHistory: {
                    player1: [],
                    player2: [],
                },

                // Currently displaying events per player
                activeEvents: {
                    player1: [],
                    player2: [],
                },

                // Pending interaction queues
                pendingShady: {
                    player1: [],
                    player2: [],
                },
                pendingMicrowave: {
                    player1: [],
                    player2: [],
                },
                pendingChest: {
                    player1: [],
                    player2: [],
                },
                pendingMoai: {
                    player1: [],
                    player2: [],
                },
                pendingShrine: {
                    player1: [],
                    player2: [],
                },
                pendingPhantomItems: {
                    player1: [],
                    player2: [],
                },

                // Settings for which interaction types to show
                enabledInteractions: {
                    chest: true,
                    moai: true,
                    shrine: true,
                    goldenShrine: true,
                    shadyGuy: true,
                    microwave: true,
                    chaosTome: true,
                    levelup: true,
                    other: true,
                    statChange: true,
                },

                // Display settings
                displaySettings: {
                    duration: EVENT_DISPLAY_DURATION,
                    maxVisible: 3,
                    showStatChanges: true,
                    showItemChanges: true,
                    animationStyle: 'slide', // 'slide', 'fade', 'pop'
                    debugLogging: false,
                    uiScale: 1.2,
                },

                // Smart stat visibility controls
                showUnreliableStats: false,
                statVisibility: { ...DEFAULT_STAT_VISIBILITY },
                availableStatKeys: [],

                // Previous snapshots for change detection
                prevSnapshots: {
                    player1: null,
                    player2: null,
                },

                baselineCooldownUntil: {
                    player1: 0,
                    player2: 0,
                },

                // Toggle interaction type visibility
                toggleInteraction: (interactionId) => set((state) => ({
                    enabledInteractions: {
                        ...state.enabledInteractions,
                        [interactionId]: !state.enabledInteractions[interactionId],
                    },
                })),

                // Set all interactions enabled/disabled
                setAllInteractions: (enabled) => set(() => ({
                    enabledInteractions: Object.keys(INTERACTION_TYPES).reduce((acc, key) => {
                        acc[INTERACTION_TYPES[key].id] = enabled;
                        return acc;
                    }, {}),
                })),

                // Update display settings
                updateDisplaySettings: (settings) => set((state) => ({
                    displaySettings: { ...state.displaySettings, ...settings },
                })),

                setShowUnreliableStats: (enabled) => set(() => ({
                    showUnreliableStats: enabled,
                })),

                toggleStatVisibility: (statKey) => set((state) => ({
                    statVisibility: {
                        ...state.statVisibility,
                        [statKey]: !state.statVisibility?.[statKey],
                    },
                })),

                // Fire a debug event for testing
                fireDebugEvent: (playerId, eventTypeId) => {
                    const key = normalizePlayerKey(playerId);
                    const eventType = Object.values(INTERACTION_TYPES).find(t => t.id === eventTypeId);
                    if (!eventType) return;
                    const fakeEvent = {
                        id: `debug-${eventTypeId}-${Date.now()}`,
                        type: eventType,
                        timestamp: Date.now(),
                        ...createFakeEventData(eventTypeId),
                    };
                    set((s) => ({
                        eventQueue: {
                            ...s.eventQueue,
                            [key]: [...s.eventQueue[key], fakeEvent],
                        },
                    }));
                },

                // Process a state update and detect interactions
                processStateUpdate: (playerId, currentState, getLocalItemByIngameId, getLocalTomeByIngameId) => {
                    const state = get();
                    const key = normalizePlayerKey(playerId);
                    const prevSnapshot = state.prevSnapshots[key];
                    const debugLogging = state.displaySettings?.debugLogging;

                    // Build current snapshot
                    const currentSnapshot = {
                        combat: currentState?.combat,
                        equipment: currentState?.equipment,
                        character: currentState?.character,
                        meta: {
                            startedAt: currentState?.startedAt ?? null,
                            timeElapsed: currentState?.timeElapsed ?? null,
                            pauseTime: currentState?.pauseTime ?? null,
                            lastUpdated: currentState?.lastUpdated ?? null,
                            isPaused: currentState?.isPaused ?? null,
                        },
                    };

                    const isFreshStart = !prevSnapshot
                        || (prevSnapshot?.meta?.startedAt && currentSnapshot?.meta?.startedAt
                            && prevSnapshot.meta.startedAt !== currentSnapshot.meta.startedAt)
                        || (prevSnapshot?.meta?.timeElapsed != null && currentSnapshot?.meta?.timeElapsed != null
                            && currentSnapshot.meta.timeElapsed < prevSnapshot.meta.timeElapsed)
                        || (prevSnapshot?.meta?.timeElapsed && currentSnapshot?.meta?.timeElapsed === 0)
                        || (prevSnapshot?.meta?.lastUpdated && currentSnapshot?.meta?.lastUpdated
                            && currentSnapshot.meta.lastUpdated - prevSnapshot.meta.lastUpdated > 15000);

                    if (isFreshStart) {
                        const cooldownUntil = Date.now() + 5000;
                        const nextKeys = Object.keys(currentSnapshot?.character?.stats || {});
                        const nextVisibility = { ...state.statVisibility };
                        nextKeys.forEach((statKey) => {
                            if (nextVisibility[statKey] === undefined) {
                                nextVisibility[statKey] = STAT_KEYS.has(statKey);
                            }
                        });
                        set((s) => ({
                            prevSnapshots: {
                                ...s.prevSnapshots,
                                [key]: cloneSnapshot(currentSnapshot),
                            },
                            availableStatKeys: Array.from(new Set([...s.availableStatKeys, ...nextKeys])),
                            statVisibility: nextVisibility,
                            baselineCooldownUntil: {
                                ...s.baselineCooldownUntil,
                                [key]: cooldownUntil,
                            },
                        }));
                        return [];
                    }

                    if (state.baselineCooldownUntil?.[key] && Date.now() < state.baselineCooldownUntil[key]) {
                        set((s) => ({
                            prevSnapshots: {
                                ...s.prevSnapshots,
                                [key]: cloneSnapshot(currentSnapshot),
                            },
                        }));
                        return [];
                    }

                    // Skip if no previous snapshot (first update)
                    if (!prevSnapshot) {
                        set((s) => ({
                            prevSnapshots: {
                                ...s.prevSnapshots,
                                [key]: cloneSnapshot(currentSnapshot),
                            },
                        }));
                        return [];
                    }

                    // Compute diff
                    const heroId = currentSnapshot?.character?.id;
                    const ignoreStatKey = HERO_PASSIVE_STAT_KEY_BY_HERO_ID[heroId] || null;
                    const availableKeys = Object.keys(currentSnapshot?.character?.stats || {});
                    const nextVisibility = { ...state.statVisibility };
                    availableKeys.forEach((statKey) => {
                        if (nextVisibility[statKey] === undefined) {
                            nextVisibility[statKey] = STAT_KEYS.has(statKey);
                        }
                    });
                    const allowedStatKeys = new Set(
                        Object.keys(nextVisibility).filter((keyName) => (
                            nextVisibility[keyName] && (state.showUnreliableStats || STAT_KEYS.has(keyName))
                        ))
                    );
                    const diff = computeStateDiff(prevSnapshot, currentSnapshot, { ignoreStatKey, allowedStatKeys });

                    // Detect interactions
                    const detectionResult = detectInteractions(
                        prevSnapshot,
                        currentSnapshot,
                        diff,
                        getLocalItemByIngameId,
                        getLocalTomeByIngameId,
                        debugLogging,
                        state.pendingShady?.[key] || [],
                        state.pendingMicrowave?.[key] || [],
                        state.pendingChest?.[key] || [],
                        state.pendingMoai?.[key] || [],
                        state.pendingShrine?.[key] || [],
                        state.pendingPhantomItems?.[key] || []
                    );

                    const newEvents = detectionResult.events;
                    const pendingShadyQueue = detectionResult.pendingShadyQueue;
                    const pendingMicrowaveQueue = detectionResult.pendingMicrowaveQueue;
                    const pendingChestQueue = detectionResult.pendingChestQueue;
                    const pendingMoaiQueue = detectionResult.pendingMoaiQueue;
                    const pendingShrineQueue = detectionResult.pendingShrineQueue;
                    const pendingPhantomQueue = detectionResult.pendingPhantomQueue;

                    // Filter by enabled interactions
                    const enabledEvents = newEvents.filter(
                        event => state.enabledInteractions[event.type.id]
                    );

                    // Update state
                    set((s) => {
                        const updatedQueue = [...s.eventQueue[key], ...enabledEvents];
                        const updatedHistory = [...enabledEvents, ...s.eventHistory[key]]
                            .slice(0, MAX_EVENT_HISTORY);

                        return {
                            prevSnapshots: {
                                ...s.prevSnapshots,
                                [key]: currentSnapshot,
                            },
                            eventQueue: {
                                ...s.eventQueue,
                                [key]: updatedQueue,
                            },
                            eventHistory: {
                                ...s.eventHistory,
                                [key]: updatedHistory,
                            },
                            pendingShady: {
                                ...s.pendingShady,
                                [key]: pendingShadyQueue,
                            },
                            pendingMicrowave: {
                                ...s.pendingMicrowave,
                                [key]: pendingMicrowaveQueue,
                            },
                            pendingChest: {
                                ...s.pendingChest,
                                [key]: pendingChestQueue,
                            },
                            pendingMoai: {
                                ...s.pendingMoai,
                                [key]: pendingMoaiQueue,
                            },
                            pendingShrine: {
                                ...s.pendingShrine,
                                [key]: pendingShrineQueue,
                            },
                            pendingPhantomItems: {
                                ...s.pendingPhantomItems,
                                [key]: pendingPhantomQueue,
                            },
                            availableStatKeys: Array.from(new Set([...s.availableStatKeys, ...availableKeys])),
                            statVisibility: nextVisibility,
                        };
                    });

                    return enabledEvents;
                },

                // Pop next event from queue for display
                popEvent: (playerId) => {
                    const state = get();
                    const key = normalizePlayerKey(playerId);
                    const queue = state.eventQueue[key];

                    if (queue.length === 0) return null;

                    const [event, ...rest] = queue;

                    set((s) => ({
                        eventQueue: {
                            ...s.eventQueue,
                            [key]: rest,
                        },
                        activeEvents: {
                            ...s.activeEvents,
                            [key]: [...s.activeEvents[key], event],
                        },
                    }));

                    return event;
                },

                // Remove event from active display
                dismissEvent: (playerId, eventId) => {
                    const key = normalizePlayerKey(playerId);
                    set((s) => ({
                        activeEvents: {
                            ...s.activeEvents,
                            [key]: s.activeEvents[key].filter(e => e.id !== eventId),
                        },
                    }));
                },

                // Clear all events for a player (e.g., on run start)
                clearEvents: (playerId) => {
                    const key = normalizePlayerKey(playerId);
                    set((s) => ({
                        eventQueue: {
                            ...s.eventQueue,
                            [key]: [],
                        },
                        activeEvents: {
                            ...s.activeEvents,
                            [key]: [],
                        },
                        eventHistory: {
                            ...s.eventHistory,
                            [key]: [],
                        },
                        prevSnapshots: {
                            ...s.prevSnapshots,
                            [key]: null,
                        },
                        baselineCooldownUntil: {
                            ...s.baselineCooldownUntil,
                            [key]: 0,
                        },
                        pendingShady: {
                            ...s.pendingShady,
                            [key]: [],
                        },
                        pendingMicrowave: {
                            ...s.pendingMicrowave,
                            [key]: [],
                        },
                        pendingChest: {
                            ...s.pendingChest,
                            [key]: [],
                        },
                        pendingMoai: {
                            ...s.pendingMoai,
                            [key]: [],
                        },
                        pendingShrine: {
                            ...s.pendingShrine,
                            [key]: [],
                        },
                        pendingPhantomItems: {
                            ...s.pendingPhantomItems,
                            [key]: [],
                        },
                    }));
                },

                // Clear all events for both players
                clearAllEvents: () => {
                    set({
                        eventQueue: { player1: [], player2: [] },
                        activeEvents: { player1: [], player2: [] },
                        eventHistory: { player1: [], player2: [] },
                        prevSnapshots: { player1: null, player2: null },
                        pendingShady: { player1: [], player2: [] },
                        pendingMicrowave: { player1: [], player2: [] },
                        pendingChest: { player1: [], player2: [] },
                        pendingMoai: { player1: [], player2: [] },
                        pendingShrine: { player1: [], player2: [] },
                        pendingPhantomItems: { player1: [], player2: [] },
                        baselineCooldownUntil: { player1: 0, player2: 0 },
                    });
                },
            }),
            {
                name: 'smart-interactions-storage',
                partialize: (state) => ({
                    enabledInteractions: state.enabledInteractions,
                    displaySettings: state.displaySettings,
                    showUnreliableStats: state.showUnreliableStats,
                    statVisibility: state.statVisibility,
                }),
            }
        )
    )
);

/**
 * Compute a diff between two state snapshots
 */
function computeStateDiff(prev, curr, options = {}) {
    const diff = {
        stats: {},
        items: { added: [], removed: [], changed: [] },
        tomes: { added: [], removed: [], leveledUp: [] },
        weapons: { added: [], removed: [], leveledUp: [] },
        hasChanges: false,
        delta: null,
    };
    const { ignoreStatKey, allowedStatKeys } = options;

    diff.delta = diffpatcher.diff(prev, curr);
    diff.hasChanges = !!diff.delta;

    // Stat diff
    const prevStats = prev?.character?.stats || {};
    const currStats = curr?.character?.stats || {};

    const allStatKeys = new Set([...Object.keys(prevStats), ...Object.keys(currStats)]);
    allStatKeys.forEach(key => {
        if (key === 'MaxHealth') return;
        if (ignoreStatKey && key === ignoreStatKey) return;
        if (ALWAYS_DISABLED_STATS.has(key)) return;
        if (allowedStatKeys && !allowedStatKeys.has(key)) return;
        const prevVal = prevStats[key] ?? 0;
        const currVal = currStats[key] ?? 0;
        if (prevVal !== currVal) {
            const meta = STAT_CONFIG[key];
            const delta = currVal - prevVal;
            let displayDelta = delta;
            if (meta?.unit === 'percent') {
                if (prevVal === 0) {
                    displayDelta = currVal === 0 ? 0 : currVal * 100;
                } else {
                    displayDelta = (delta / prevVal) * 100;
                }
            }
            diff.stats[key] = {
                stat: key,
                prev: prevVal,
                curr: currVal,
                delta,
                displayDelta,
                unit: meta?.unit || 'number',
                label: meta?.label || key,
            };
            diff.hasChanges = true;
        }
    });

    // Item diff
    const prevItems = prev?.equipment?.items || [];
    const currItems = curr?.equipment?.items || [];

    const prevItemMap = new Map();
    prevItems.forEach(item => {
        if (item?.id != null) {
            const rarity = normalizeRarity(item.rarity);
            const key = `${item.id}-${rarity}`;
            prevItemMap.set(key, { ...item, rarity, count: item.count || 1 });
        }
    });

    const currItemMap = new Map();
    currItems.forEach(item => {
        if (item?.id != null) {
            const rarity = normalizeRarity(item.rarity);
            const key = `${item.id}-${rarity}`;
            currItemMap.set(key, { ...item, rarity, count: item.count || 1 });
        }
    });

    // Find added/changed items
    currItemMap.forEach((currItem, key) => {
        const prevItem = prevItemMap.get(key);
        if (!prevItem) {
            diff.items.added.push(currItem);
            diff.hasChanges = true;
        } else if (prevItem.count !== currItem.count) {
            diff.items.changed.push({ ...currItem, countDelta: currItem.count - prevItem.count });
            diff.hasChanges = true;
        }
    });

    // Find removed items
    prevItemMap.forEach((prevItem, key) => {
        if (!currItemMap.has(key)) {
            diff.items.removed.push(prevItem);
            diff.hasChanges = true;
        }
    });

    // Tome diff
    const prevTomes = prev?.equipment?.tomes || [];
    const currTomes = curr?.equipment?.tomes || [];

    const prevTomeMap = new Map(prevTomes.filter(t => t?.id != null).map(t => [t.id, t]));
    const currTomeMap = new Map(currTomes.filter(t => t?.id != null).map(t => [t.id, t]));

    currTomeMap.forEach((currTome, id) => {
        const prevTome = prevTomeMap.get(id);
        if (!prevTome) {
            diff.tomes.added.push(currTome);
            diff.hasChanges = true;
        } else if ((prevTome.level || 0) < (currTome.level || 0)) {
            diff.tomes.leveledUp.push({ ...currTome, prevLevel: prevTome.level });
            diff.hasChanges = true;
        }
    });

    prevTomeMap.forEach((prevTome, id) => {
        if (!currTomeMap.has(id)) {
            diff.tomes.removed.push(prevTome);
            diff.hasChanges = true;
        }
    });

    // Weapon diff
    const prevWeapons = prev?.equipment?.weapons || [];
    const currWeapons = curr?.equipment?.weapons || [];

    const prevWeaponMap = new Map(prevWeapons.filter(w => w?.id != null).map(w => [w.id, w]));
    const currWeaponMap = new Map(currWeapons.filter(w => w?.id != null).map(w => [w.id, w]));

    currWeaponMap.forEach((currWeapon, id) => {
        const prevWeapon = prevWeaponMap.get(id);
        if (!prevWeapon) {
            diff.weapons.added.push(currWeapon);
            diff.hasChanges = true;
        } else if ((prevWeapon.level || 0) < (currWeapon.level || 0)) {
            diff.weapons.leveledUp.push({ ...currWeapon, prevLevel: prevWeapon.level });
            diff.hasChanges = true;
        }
    });

    prevWeaponMap.forEach((prevWeapon, id) => {
        if (!currWeaponMap.has(id)) {
            diff.weapons.removed.push(prevWeapon);
            diff.hasChanges = true;
        }
    });

    return diff;
}

export default useSmartInteractionsStore;
