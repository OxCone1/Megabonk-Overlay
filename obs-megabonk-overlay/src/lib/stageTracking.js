import levelTimings from '../../level_timings.json';

const ALLOWED_MAP_IDS = new Set([1, 2]);
const FINAL_BOSS_COUNTDOWN_SECONDS = 10;
const STAGE4_MAX_TIME_SECONDS = 600;
const EVENT_FADE_OUT_SECONDS = 0.5;
const EVENT_PLACEHOLDER_DELAY_SECONDS = 0.7;
const BOSS_LABEL_WINDOW_SECONDS = 10;
const STAGE4_NO_KILL_TICKS = 8;
const MAX_HISTORY_ENTRIES = 4;


const LEVEL_TIMING_MAP = (levelTimings?.levels || []).reduce((acc, entry) => {
  const index = Number(entry?.level) - 1;
  if (Number.isFinite(index) && index >= 0) {
    acc[index] = entry;
  }
  return acc;
}, {});

const clampNumber = (value, fallback = null) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const createStageTrackingEntry = () => ({
  enabled: false,
  mapId: null,
  stageIndex: null,
  stageStartAt: null,
  anchored: false,
  phase: 'unknown',
  finalBossTriggeredAt: null,
  finalSwarmStartAt: null,
  finalFinalBossTriggeredAt: null,
  finalFinalSwarmStartAt: null,
  lastBossKills: null,
  lastFinalBossKills: null,
  lastKillCount: null,
  lastPauseTime: null,
  noKillTicks: 0,
  lastEventLabel: null,
  lastEventLabelUntil: null,
  lastEventPlaceholderUntil: null,
  history: [],
  display: null,
  lastStageRaw: null,
});

export const createStageTrackingState = () => ({
  1: createStageTrackingEntry(),
  2: createStageTrackingEntry(),
});

const resolveActiveEvent = (timeRemaining, levelTiming) => {
  if (!levelTiming || !Number.isFinite(timeRemaining)) return null;
  const events = Array.isArray(levelTiming.events) ? levelTiming.events : [];

  for (const event of events) {
    if (event?.type === 'boss_spawn') {
      const start = clampNumber(event.timeRemaining, null);
      if (start === null) continue;
      if (timeRemaining <= start && timeRemaining > start - BOSS_LABEL_WINDOW_SECONDS) {
        const suffix = event?.boss ? ` ${event.boss}` : '';
        return { type: 'boss_spawn', label: `Boss${suffix}` };
      }
    }

    if (event?.type === 'swarm_start' && event?.durationSeconds) {
      const start = clampNumber(event.timeRemaining, null);
      const duration = clampNumber(event.durationSeconds, null);
      if (start === null || duration === null) continue;
      if (timeRemaining <= start && timeRemaining > start - duration) {
        const suffix = event?.swarm ? ` ${event.swarm}` : '';
        return { type: 'swarm_start', label: `Swarm${suffix}` };
      }
    }
  }

  return null;
};

const computeDisplay = (entry, actualRunTime) => {
  if (!entry?.enabled || entry.stageIndex === null || !Number.isFinite(actualRunTime)) {
    return { valid: false };
  }

  const stageIndex = entry.stageIndex;
  const stageNumber = stageIndex + 1;

  if (stageIndex >= 3) {
    if (!Number.isFinite(entry.stageStartAt)) return { valid: false, stageIndex, stageNumber };
    if (entry.finalFinalBossTriggeredAt !== null) {
      const sinceBoss = Math.max(0, actualRunTime - entry.finalFinalBossTriggeredAt);
      if (sinceBoss < FINAL_BOSS_COUNTDOWN_SECONDS) {
        return {
          valid: true,
          stageIndex,
          stageNumber,
          direction: 'down',
          timeSeconds: Math.max(0, Math.floor(FINAL_BOSS_COUNTDOWN_SECONDS - sinceBoss)),
          isFinalSwarm: false,
          eventLabel: null,
          phase: 'final_boss_gap',
        };
      }

      const swarmStart = Number.isFinite(entry.finalFinalSwarmStartAt)
        ? entry.finalFinalSwarmStartAt
        : entry.finalFinalBossTriggeredAt + FINAL_BOSS_COUNTDOWN_SECONDS;
      const elapsed = Math.max(0, actualRunTime - swarmStart);
      return {
        valid: true,
        stageIndex,
        stageNumber,
        direction: 'up',
        timeSeconds: Math.max(0, Math.floor(elapsed)),
        isFinalSwarm: true,
        eventLabel: 'Final Swarm',
        phase: 'final_swarm',
      };
    }

    const elapsed = Math.max(0, actualRunTime - entry.stageStartAt);
    const remaining = Math.max(0, STAGE4_MAX_TIME_SECONDS - elapsed);
    return {
      valid: true,
      stageIndex,
      stageNumber,
      direction: 'down',
      timeSeconds: Math.max(0, Math.floor(remaining)),
      isFinalSwarm: false,
      eventLabel: null,
      phase: 'stage4_countdown',
    };
  }

  if (entry.finalBossTriggeredAt !== null && stageIndex <= 1) {
    const sinceBoss = Math.max(0, actualRunTime - entry.finalBossTriggeredAt);
    if (sinceBoss < FINAL_BOSS_COUNTDOWN_SECONDS) {
      return {
        valid: true,
        stageIndex,
        stageNumber,
        direction: 'down',
        timeSeconds: Math.max(0, Math.floor(FINAL_BOSS_COUNTDOWN_SECONDS - sinceBoss)),
        isFinalSwarm: false,
        eventLabel: null,
        phase: 'final_boss_gap',
      };
    }

    const swarmStart = Number.isFinite(entry.finalSwarmStartAt)
      ? entry.finalSwarmStartAt
      : entry.finalBossTriggeredAt + FINAL_BOSS_COUNTDOWN_SECONDS;
    const elapsed = Math.max(0, actualRunTime - swarmStart);
    return {
      valid: true,
      stageIndex,
      stageNumber,
      direction: 'up',
      timeSeconds: Math.max(0, Math.floor(elapsed)),
      isFinalSwarm: true,
      eventLabel: 'Final Swarm',
      phase: 'final_swarm',
    };
  }

  if (!entry.anchored || entry.stageStartAt === null || entry.stageStartAt === undefined) {
    return { valid: false, stageIndex, stageNumber };
  }

  const timing = LEVEL_TIMING_MAP[stageIndex];
  if (!timing) return { valid: false, stageIndex, stageNumber };

  const stageElapsed = Math.max(0, actualRunTime - entry.stageStartAt);
  const maxTime = clampNumber(timing.maxTimeSeconds, null);
  if (maxTime === null) return { valid: false, stageIndex, stageNumber };

  if (stageElapsed < maxTime) {
    const timeRemaining = maxTime - stageElapsed;
    const event = resolveActiveEvent(timeRemaining, timing);
    return {
      valid: true,
      stageIndex,
      stageNumber,
      direction: 'down',
      timeSeconds: Math.max(0, Math.floor(timeRemaining)),
      isFinalSwarm: false,
      eventLabel: event?.label || null,
      eventType: event?.type || null,
      phase: 'countdown',
    };
  }

  const elapsed = stageElapsed - maxTime;
  return {
    valid: true,
    stageIndex,
    stageNumber,
    direction: 'up',
    timeSeconds: Math.max(0, Math.floor(elapsed)),
    isFinalSwarm: true,
    eventLabel: 'Final Swarm',
    phase: 'final_swarm',
  };
};

const resolveExitReason = (display) => {
  if (!display) return 'Unknown';
  if (display.eventLabel) return display.eventLabel;
  if (display.phase === 'final_boss_countdown') return 'Final Boss';
  if (display.isFinalSwarm) return 'Final Swarm';
  if (display.direction === 'down' && display.timeSeconds === 0) return 'Timer End';
  if (display.direction === 'down') return 'Timer';
  return 'Normal';
};

const appendHistory = (entry, historyItem) => {
  if (!historyItem) return entry.history || [];
  const next = [...(entry.history || []), historyItem];
  if (next.length > MAX_HISTORY_ENTRIES) {
    return next.slice(next.length - MAX_HISTORY_ENTRIES);
  }
  return next;
};

const resolveDifficultyPercent = (playerState) => {
  const raw = clampNumber(playerState?.character?.stats?.Difficulty, null);
  if (raw === null) return null;
  return Math.round(raw * 100);
};

export const updateStageTrackingState = (tracking, playerId, playerState) => {
  if (!playerId) return tracking;
  const current = tracking?.[playerId] || createStageTrackingEntry();

  if (!playerState) {
    return {
      ...(tracking || {}),
      [playerId]: createStageTrackingEntry(),
    };
  }

  const mapId = clampNumber(playerState?.map?.id, null);
  const stageRaw = clampNumber(playerState?.map?.stage, null);
  const timeElapsed = clampNumber(playerState?.timeElapsed, null);
  const pauseTime = clampNumber(playerState?.pauseTime, 0) ?? 0;
  const actualRunTime = Number.isFinite(timeElapsed)
    ? Math.max(0, timeElapsed - pauseTime)
    : null;

  if (!mapId || !ALLOWED_MAP_IDS.has(mapId)) {
    return {
      ...(tracking || {}),
      [playerId]: {
        ...createStageTrackingEntry(),
        mapId,
      },
    };
  }

  let next = {
    ...current,
    enabled: true,
    mapId,
  };

  const killCount = clampNumber(playerState?.combat?.killCount, null);
  const bossKills = clampNumber(playerState?.combat?.gameStats?.boss_kills, null);
  const finalBossKills = clampNumber(playerState?.combat?.gameStats?.final_boss_kills, null);
  const difficultyPercent = resolveDifficultyPercent(playerState);

  const previousPauseTime = next.lastPauseTime;

  if (next.lastKillCount !== null && killCount !== null) {
    if (killCount > next.lastKillCount) {
      next.noKillTicks = 0;
    } else if (killCount === next.lastKillCount) {
      if (pauseTime === previousPauseTime) {
        next.noKillTicks = (next.noKillTicks || 0) + 1;
      } else {
        next.noKillTicks = 0;
      }
    } else {
      next.noKillTicks = 0;
    }
  }

  next.lastKillCount = killCount ?? next.lastKillCount;

  const hasStageChange = stageRaw !== null && stageRaw !== next.lastStageRaw;
  const isNewRun = hasStageChange && next.lastStageRaw !== null && stageRaw !== null && stageRaw < next.lastStageRaw;

  if (isNewRun) {
    next = {
      ...createStageTrackingEntry(),
      enabled: true,
      mapId,
    };
  }

  if (hasStageChange && stageRaw !== null) {
    const isInitialStageAssignment = next.lastStageRaw === null || next.lastStageRaw === undefined;
    if (next.stageIndex !== null) {
      const exitDisplay = computeDisplay(next, actualRunTime);
      const historyItem = {
        stageIndex: next.stageIndex,
        stageNumber: next.stageIndex + 1,
        exitReason: resolveExitReason(exitDisplay),
        timeSeconds: exitDisplay?.valid ? exitDisplay.timeSeconds : null,
        direction: exitDisplay?.valid ? exitDisplay.direction : null,
        kills: killCount ?? null,
        difficultyPercent,
        timestamp: Date.now(),
      };
      next.history = appendHistory(next, historyItem);
    }

    next.stageIndex = stageRaw;
    next.lastStageRaw = stageRaw;
    if (stageRaw === 0 && Number.isFinite(actualRunTime)) {
      next.stageStartAt = 0;
      next.anchored = true;
    } else if (!isInitialStageAssignment && Number.isFinite(actualRunTime)) {
      next.stageStartAt = actualRunTime;
      next.anchored = true;
    } else {
      next.stageStartAt = null;
      next.anchored = false;
    }
    next.phase = 'countdown';
    next.finalBossTriggeredAt = null;
    next.finalSwarmStartAt = null;
    next.finalFinalBossTriggeredAt = null;
    next.finalFinalSwarmStartAt = null;
    next.noKillTicks = 0;
  }

  if (!hasStageChange && stageRaw !== null && next.stageIndex === null) {
    next.stageIndex = stageRaw;
    next.lastStageRaw = stageRaw;
    if (stageRaw === 0 && Number.isFinite(actualRunTime)) {
      next.stageStartAt = actualRunTime - actualRunTime;
      next.anchored = true;
    } else {
      next.stageStartAt = null;
      next.anchored = false;
    }
  }

  if (bossKills !== null && next.lastBossKills !== null && bossKills > next.lastBossKills) {
    if (next.stageIndex !== null && next.stageIndex <= 1 && Number.isFinite(actualRunTime)) {
      next.finalBossTriggeredAt = actualRunTime;
      next.finalSwarmStartAt = null;
      next.phase = 'final_boss_gap';
    }
  }

  next.lastBossKills = bossKills ?? next.lastBossKills;

  if (finalBossKills !== null && next.lastFinalBossKills !== null && finalBossKills > next.lastFinalBossKills) {
    if (next.stageIndex !== null && next.stageIndex >= 3 && Number.isFinite(actualRunTime)) {
      next.finalFinalBossTriggeredAt = actualRunTime;
      next.finalFinalSwarmStartAt = null;
      next.phase = 'final_boss_gap';
    }
  }

  next.lastFinalBossKills = finalBossKills ?? next.lastFinalBossKills;

  const stage4Triggered = stageRaw === 2
    && next.stageIndex !== 3
    && (next.noKillTicks || 0) >= STAGE4_NO_KILL_TICKS
    && pauseTime === previousPauseTime
    && Number.isFinite(actualRunTime);

  if (stage4Triggered) {
    const exitDisplay = computeDisplay(next, actualRunTime);
    const historyItem = {
      stageIndex: 2,
      stageNumber: 3,
      exitReason: 'No Kills',
      timeSeconds: exitDisplay?.valid ? exitDisplay.timeSeconds : null,
      direction: exitDisplay?.valid ? exitDisplay.direction : null,
      kills: killCount ?? null,
      difficultyPercent,
      timestamp: Date.now(),
    };
    next.history = appendHistory(next, historyItem);
    next.stageIndex = 3;
    next.stageStartAt = actualRunTime;
    next.anchored = true;
    next.phase = 'final_swarm';
    next.finalBossTriggeredAt = null;
    next.finalSwarmStartAt = actualRunTime;
    next.finalFinalBossTriggeredAt = null;
    next.finalFinalSwarmStartAt = null;
  }

  let display = computeDisplay(next, actualRunTime);
  if (display?.valid && Number.isFinite(actualRunTime)) {
    if (display.eventLabel) {
      next.lastEventLabel = display.eventLabel;
      next.lastEventLabelUntil = actualRunTime + EVENT_FADE_OUT_SECONDS;
      next.lastEventPlaceholderUntil = actualRunTime + EVENT_FADE_OUT_SECONDS + EVENT_PLACEHOLDER_DELAY_SECONDS;
    } else if (next.lastEventLabel && Number.isFinite(next.lastEventLabelUntil)) {
      if (actualRunTime <= next.lastEventLabelUntil) {
        display = {
          ...display,
          eventLabel: next.lastEventLabel,
          eventFadeOut: true,
        };
      } else {
        next.lastEventLabel = null;
        next.lastEventLabelUntil = null;
      }
    }

    if (!display.eventLabel && Number.isFinite(next.lastEventPlaceholderUntil)) {
      if (actualRunTime <= next.lastEventPlaceholderUntil) {
        display = {
          ...display,
          eventPlaceholderDelay: true,
        };
      } else {
        next.lastEventPlaceholderUntil = null;
      }
    }
  }
  next.display = display?.valid ? display : null;
  next.lastPauseTime = pauseTime ?? next.lastPauseTime;

  return {
    ...(tracking || {}),
    [playerId]: next,
  };
};

export const formatStageTime = (seconds) => {
  if (!Number.isFinite(seconds) || seconds === null) return '--:--';
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const getStageDisplay = (stageTrackingEntry) => stageTrackingEntry?.display || null;
