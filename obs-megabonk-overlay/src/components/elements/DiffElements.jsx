import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useOverlayStore } from '@/stores/overlayStore';

function formatTime(seconds) {
  if (seconds < 0) seconds = 0;
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function resolveDisplayTime(playerState, seasonInfo, timeFlowDirection) {
  if (!playerState) return null;
  const timeElapsed = Number(playerState.timeElapsed);
  const pauseTime = Number(playerState.pauseTime);
  if (!Number.isFinite(timeElapsed) || !Number.isFinite(pauseTime)) return null;
  const actualRunTime = Math.max(0, timeElapsed - pauseTime);
  const timeLimit = seasonInfo?.timeLimit || 0;
  const remainingTime = timeLimit > 0 ? Math.max(0, timeLimit - actualRunTime) : 0;
  return (timeFlowDirection === 'remaining' && timeLimit > 0) ? remainingTime : actualRunTime;
}

function formatSignedValue(diff, formatter) {
  if (diff === null || diff === undefined) return '--';
  const numeric = Number(diff);
  if (!Number.isFinite(numeric)) return '--';
  const sign = numeric >= 0 ? '+' : '-';
  const value = formatter ? formatter(Math.abs(numeric)) : Math.abs(numeric).toString();
  return `${sign}${value}`;
}

function formatPlainNumber(value, plainFormat) {
  if (!Number.isFinite(value)) return '--';
  return plainFormat === 'decimal'
    ? value.toFixed(2)
    : Math.floor(value).toString();
}

function DiffValue({ value, diff, isPlaceholder }) {
  const isPositive = !isPlaceholder && diff > 0;
  const isNegative = !isPlaceholder && diff < 0;
  const color = isPositive ? 'text-[#009216]' : isNegative ? 'text-[#E62E00]' : 'text-white/80';

  return (
    <div className={cn('p-2 flex items-center justify-center h-full', isPlaceholder && 'opacity-50 grayscale obs-hide-shadow')}>
      <span
        className={cn(
          'text-2xl font-alagard tabular-nums alagard-numeric drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]',
          isPlaceholder ? 'text-white/40' : color
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function TimeDiffElement() {
  const isSpectator = useOverlayStore(s => s.isSpectator);
  const player1State = useOverlayStore(s => s.player1State);
  const player2State = useOverlayStore(s => s.player2State);
  const currentUser_id = useOverlayStore(s => s.currentUser_id);
  const seasonInfo = useOverlayStore(s => s.seasonInfo);
  const timeFlowDirection = useOverlayStore(s => s.timeFlowDirection);
  const spoofEnabled = useOverlayStore(s => s.spoofEnabled);
  const spoofDiffs = useOverlayStore(s => s.spoofDiffs);

  const { me, opponent } = useMemo(() => {
    if (currentUser_id) {
      if (player1State?.playerId === currentUser_id) {
        return { me: player1State, opponent: player2State };
      }
      if (player2State?.playerId === currentUser_id) {
        return { me: player2State, opponent: player1State };
      }
    }
    return { me: player1State, opponent: player2State };
  }, [currentUser_id, player1State, player2State]);

  const diff = useMemo(() => {
    if (spoofEnabled && Number.isFinite(Number(spoofDiffs?.timeSeconds))) {
      return Number(spoofDiffs.timeSeconds);
    }
    const myTime = resolveDisplayTime(me, seasonInfo, timeFlowDirection);
    const oppTime = resolveDisplayTime(opponent, seasonInfo, timeFlowDirection);
    if (myTime === null || oppTime === null) return null;
    return myTime - oppTime;
  }, [me, opponent, seasonInfo, timeFlowDirection, spoofEnabled, spoofDiffs]);

  const isPlaceholder = isSpectator || diff === null;
  const value = isPlaceholder ? '--:--' : formatSignedValue(diff, formatTime);

  return <DiffValue value={value} diff={diff} isPlaceholder={isPlaceholder} />;
}

export function KillDiffElement() {
  const isSpectator = useOverlayStore(s => s.isSpectator);
  const player1State = useOverlayStore(s => s.player1State);
  const player2State = useOverlayStore(s => s.player2State);
  const currentUser_id = useOverlayStore(s => s.currentUser_id);
  const spoofEnabled = useOverlayStore(s => s.spoofEnabled);
  const spoofDiffs = useOverlayStore(s => s.spoofDiffs);

  const { me, opponent } = useMemo(() => {
    if (currentUser_id) {
      if (player1State?.playerId === currentUser_id) {
        return { me: player1State, opponent: player2State };
      }
      if (player2State?.playerId === currentUser_id) {
        return { me: player2State, opponent: player1State };
      }
    }
    return { me: player1State, opponent: player2State };
  }, [currentUser_id, player1State, player2State]);

  const diff = useMemo(() => {
    if (spoofEnabled && Number.isFinite(Number(spoofDiffs?.kills))) {
      return Number(spoofDiffs.kills);
    }
    const myKills = Number(me?.combat?.killCount);
    const oppKills = Number(opponent?.combat?.killCount);
    if (!Number.isFinite(myKills) || !Number.isFinite(oppKills)) return null;
    return myKills - oppKills;
  }, [me, opponent, spoofEnabled, spoofDiffs]);

  const isPlaceholder = isSpectator || diff === null;
  const value = isPlaceholder ? '--' : formatSignedValue(diff, (val) => Math.round(val).toString());

  return <DiffValue value={value} diff={diff} isPlaceholder={isPlaceholder} />;
}

export function DifficultyDiffElement() {
  const isSpectator = useOverlayStore(s => s.isSpectator);
  const player1State = useOverlayStore(s => s.player1State);
  const player2State = useOverlayStore(s => s.player2State);
  const currentUser_id = useOverlayStore(s => s.currentUser_id);
  const statPlainFormat = useOverlayStore(s => s.statPlainFormat);
  const spoofEnabled = useOverlayStore(s => s.spoofEnabled);
  const spoofDiffs = useOverlayStore(s => s.spoofDiffs);

  const { me, opponent } = useMemo(() => {
    if (currentUser_id) {
      if (player1State?.playerId === currentUser_id) {
        return { me: player1State, opponent: player2State };
      }
      if (player2State?.playerId === currentUser_id) {
        return { me: player2State, opponent: player1State };
      }
    }
    return { me: player1State, opponent: player2State };
  }, [currentUser_id, player1State, player2State]);

  const diff = useMemo(() => {
    if (spoofEnabled && Number.isFinite(Number(spoofDiffs?.difficulty))) {
      return Number(spoofDiffs.difficulty);
    }
    const myDifficulty = Number(me?.character?.stats?.Difficulty);
    const oppDifficulty = Number(opponent?.character?.stats?.Difficulty);
    if (!Number.isFinite(myDifficulty) || !Number.isFinite(oppDifficulty)) return null;
    return myDifficulty - oppDifficulty;
  }, [me, opponent, spoofEnabled, spoofDiffs]);

  const isPlaceholder = isSpectator || diff === null;
  const value = isPlaceholder
    ? '--'
    : formatSignedValue(diff, (val) => formatPlainNumber(val, statPlainFormat));

  return <DiffValue value={`${value}%`} diff={diff} isPlaceholder={isPlaceholder} />;
}
