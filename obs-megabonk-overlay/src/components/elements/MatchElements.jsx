import { useEffect, useMemo, useState } from 'react';
import { useOverlayStore } from '@/stores/overlayStore';
import { cn } from '@/lib/utils';
import { Flag, Swords, Timer, Trophy, Activity, Ban, Loader2 } from 'lucide-react';
import { LineWobble, Ping } from 'ldrs/react';
import { useI18n } from '@/lib/i18n';
import { BanPhaseAnimation } from '@/components/elements/BanPhaseAnimation';
import 'ldrs/react/LineWobble.css'
import 'ldrs/react/Ping.css'

function TitleRow({ hidden, className, children }) {
  return (
    <div
      className={cn(
        'text-xs font-semibold text-white/80 uppercase tracking-wider flex items-center gap-1 obs-hide-in-overlay obs-preserve-space',
        hidden && 'opacity-0',
        className
      )}
    >
      {children}
    </div>
  );
}

function StatLine({ label, value, color = 'text-white/80' }) {
  return (
    <div className="flex items-center justify-between text-xs">
      {/* <span className="text-white/60 obs-hide-in-overlay">{label}</span> */}
      <span className="text-white/60">{label}</span>
      <span className={cn('font-medium', color)}>{value ?? '--'}</span>
    </div>
  );
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

function formatSearchDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function formatQueueType(queueType, t) {
  if (!queueType) return t('queue', 'Queue');
  const normalized = String(queueType).replace(/[_-]+/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function resolveMatchEndStatus({ roomMeta, matchEndState, playerId }) {
  const status = roomMeta?.status || roomMeta?.phase || matchEndState?.status || null;
  if (status === 'cancelled' || status === 'match_cancelled' || status === 'draw') return status;

  if (roomMeta?.winnerId && playerId) {
    const targetId = playerId === 1 ? roomMeta?.player1_id : roomMeta?.player2_id;
    if (targetId && roomMeta.winnerId === targetId) return 'victory';
    if (targetId) return 'defeat';
  }

  const playerStatus = playerId === 1
    ? roomMeta?.player1GameStatus
    : playerId === 2
      ? roomMeta?.player2GameStatus
      : null;

  if (playerStatus && ['victory', 'defeat', 'draw'].includes(playerStatus)) return playerStatus;

  return status;
}

function resolveMatchEndLabel(status, t) {
  switch (status) {
    case 'victory':
      return t('matchEndVictory', 'Victory');
    case 'defeat':
      return t('matchEndDefeat', 'Defeat');
    case 'draw':
      return t('matchEndDraw', 'Draw');
    case 'cancelled':
    case 'match_cancelled':
      return t('matchCancelled', 'Match Cancelled');
    case 'ended':
      return t('matchEnded', 'Match Ended');
    default:
      return t('matchEnded', 'Match Ended');
  }
}

function resolveMatchEndClass(status) {
  switch (status) {
    case 'victory':
      return 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40';
    case 'defeat':
      return 'bg-rose-500/20 text-rose-200 border-rose-400/40';
    case 'draw':
      return 'bg-slate-500/20 text-slate-200 border-slate-400/40';
    case 'cancelled':
    case 'match_cancelled':
      return 'bg-amber-500/20 text-amber-200 border-amber-400/40';
    default:
      return 'bg-slate-500/20 text-slate-200 border-slate-400/40';
  }
}

function SearchingPanel({ elapsed, queueType, title, compact }) {
  return (
    <div className={cn('match-search-panel', compact && 'match-search-panel--compact')}>
      <div className="match-search-time">
        {formatSearchDuration(elapsed)}
      </div>
      <div className="match-search-loader">
        <LineWobble size={150} stroke={5} bgOpacity={0.1} speed={4} color="#ffffff" />
      </div>
      <div className="match-search-subtitle">{queueType}</div>
      <div className="match-search-title">{title}</div>
    </div>
  );
}

function useQueueElapsed(queueState) {
  const isSearching = queueState?.inQueue || queueState?.status === 'searching';
  const [elapsed, setElapsed] = useState(() => Math.floor(queueState?.elapsedTime || 0));

  useEffect(() => {
    if (!isSearching) return undefined;
    const base = Math.floor(queueState?.elapsedTime || 0);
    let current = base;
    const interval = setInterval(() => {
      current += 1;
      setElapsed(current);
    }, 1000);
    return () => clearInterval(interval);
  }, [isSearching, queueState?.elapsedTime]);

  if (!isSearching) return Math.floor(queueState?.elapsedTime || 0);
  return elapsed;
}

export function MatchFlowElement({ layout }) {
  const { queueState, roomMeta, hideElementTitles, currentUser_id, isSpectator } = useOverlayStore();
  const { t } = useI18n();
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const queueElapsed = useQueueElapsed(queueState);
  const playerAccepted = !!queueState?.playerAccepted;
  const opponentAccepted = !!queueState?.opponentAccepted;
  const declinedBy = queueState?.declinedBy ?? null;

  const stage = useMemo(() => {
    const hasRunData = roomMeta?.player1RunHasData || roomMeta?.player2RunHasData;
    if (roomMeta?.status === 'cancelled') return t('matchCancelled', 'Match Cancelled');
    if (queueState?.status === 'match_cancelled') return t('matchDeclined', 'Match Declined');
    if (roomMeta?.phase === 'ended') return t('matchEnded', 'Match Ended');
    if (roomMeta?.phase === 'game' && !hasRunData) return t('waitingPlayersStart', 'Waiting for players to start');
    if (roomMeta?.phase === 'game') return t('inGame', 'In Game');
    if (roomMeta?.phase === 'ban_selection') return t('banSelection', 'Ban Selection');
    if (queueState?.status === 'match_found') return t('matchFound', 'Match Found');
    if ((playerAccepted || opponentAccepted) && !(playerAccepted && opponentAccepted)) {
      return t('waitingMatchConfirm', 'Waiting for confirmation');
    }
    if (queueState?.status === 'accept_pending') return t('waitingOpponent', 'Waiting for Opponent');
    if (queueState?.status === 'match_confirmed') return t('matchConfirmed', 'Match Confirmed');
    if (queueState?.inQueue || queueState?.status === 'searching') return t('searchingMatch', 'Searching for Match');
    return t('idle', 'Idle');
  }, [queueState, roomMeta, t, playerAccepted, opponentAccepted]);

  const declinedLabel = useMemo(() => {
    if (declinedBy === null || declinedBy === undefined) return null;
    if (currentUser_id && declinedBy === currentUser_id) return t('declinedByYou', 'Declined by you');
    if (currentUser_id) return t('declinedByOpponent', 'Declined by opponent');
    return `${t('declinedBy', 'Declined by')} ${declinedBy}`;
  }, [declinedBy, currentUser_id, t]);

  const acceptanceRows = useMemo(() => {
    if (!playerAccepted && !opponentAccepted) return null;
    if (queueState?.status === 'match_cancelled') return null;
    const youLabel = isSpectator ? t('player', 'Player') : t('you', 'You');
    const opponentLabel = isSpectator ? t('opponent', 'Opponent') : t('opponent', 'Opponent');
    return [
      { label: youLabel, value: playerAccepted ? t('accepted', 'Accepted') : t('waiting', 'Waiting') },
      { label: opponentLabel, value: opponentAccepted ? t('accepted', 'Accepted') : t('waiting', 'Waiting') },
    ];
  }, [playerAccepted, opponentAccepted, isSpectator, t, queueState?.status]);

  const winnerLabel = useMemo(() => {
    if (!roomMeta?.winnerId) return null;
    if (roomMeta.winnerId === roomMeta.player1_id) {
      return roomMeta.player1Profile?.nickname || 'Player 1';
    }
    if (roomMeta.winnerId === roomMeta.player2_id) {
      return roomMeta.player2Profile?.nickname || 'Player 2';
    }
    return `Player ${roomMeta.winnerId}`;
  }, [roomMeta]);

  const queueInfo = useMemo(() => {
    if (!queueState) return null;
    if (queueState.inQueue || queueState.status === 'searching') {
      return `${queueState.queueType || 'queue'} • ${formatDuration(queueElapsed)}`;
    }
    if (queueState.status === 'match_found') {
      return `${t('timeout', 'Timeout')} ${queueState.matchTimeout || 0}s`;
    }
    if (queueState.status === 'match_cancelled') {
      return declinedLabel || queueState.message || t('matchCancelled', 'Match Cancelled');
    }
    return null;
  }, [queueElapsed, queueState, t, declinedLabel]);

  return (
    <div className="p-2 flex flex-col gap-2 h-full">
      <TitleRow hidden={hideTitle}>
        <Activity size={12} /> {layout?.title || t('matchStatus', 'Match Status')}
      </TitleRow>

      <div className="flex items-center gap-2 text-sm font-semibold text-cyan-300">
        <Flag size={14} />
        <span>{stage}</span>
      </div>

      {(queueState?.inQueue || queueState?.status === 'searching') ? (
        <SearchingPanel
          compact
          elapsed={queueElapsed}
          queueType={formatQueueType(queueState?.queueType, t)}
          title={t('searchingMatch', 'Searching for Match')}
        />
      ) : queueInfo && (
        <div className="text-xs text-white/70 flex items-center gap-1 obs-hide-in-overlay">
          <Timer size={12} />
          <span>{queueInfo}</span>
        </div>
      )}

      {acceptanceRows && (
        <div className="flex flex-col gap-1 text-xs">
          {acceptanceRows.map((row) => (
            <StatLine key={row.label} label={row.label} value={row.value} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <StatLine label={t('queue', 'Queue')} value={queueState?.queueType || '--'} />
        <StatLine label={t('room', 'Room')} value={roomMeta?.lobbyNumber ?? '--'} />
        <StatLine label={t('phase', 'Phase')} value={roomMeta?.phase || queueState?.status || '--'} />
        <StatLine label={t('status', 'Status')} value={roomMeta?.status || '--'} />
      </div>

      {winnerLabel && (
        <div className="mt-1 text-xs text-yellow-300 flex items-center gap-1">
          <Trophy size={12} />
          <span className="obs-hide-in-overlay">{t('winner', 'Winner')}:</span>
          <span>{winnerLabel}</span>
        </div>
      )}

      {roomMeta?.phase === 'game' && (roomMeta?.player1RunHasData || roomMeta?.player2RunHasData) && (
        <div className="text-[10px] text-white/50 flex items-center gap-1 obs-hide-in-overlay">
          <Swords size={10} />
          <span>{t('liveMatch', 'Live match in progress')}</span>
        </div>
      )}
    </div>
  );
}

export function MatchSearchElement({ layout }) {
  const { queueState, hideElementTitles } = useOverlayStore();
  const { t } = useI18n();
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const queueElapsed = useQueueElapsed(queueState);
  const isSearching = queueState?.inQueue || queueState?.status === 'searching';
  const isShadow = !isSearching;

  return (
    <div className={cn("p-2 flex flex-col gap-2 h-full", isShadow && "opacity-50 grayscale obs-hide-shadow")}>
      <TitleRow hidden={hideTitle}>
        <Timer size={12} /> {layout?.title || t('searchingMatch', 'Searching for Match')}
      </TitleRow>
      <SearchingPanel
        elapsed={isShadow ? 0 : queueElapsed}
        queueType={formatQueueType(queueState?.queueType, t)}
        title={t('searchingMatch', 'Searching for Match')}
      />
    </div>
  );
}

export function MatchBanSelectionElement({ layout }) {
  const { roomMeta, hideElementTitles, getPlayerLabel } = useOverlayStore();
  const { t } = useI18n();
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const isActive = roomMeta?.phase === 'ban_selection';
  const isShadow = !isActive;

  return (
    <div className={cn("p-2 flex flex-col gap-2 h-full", isShadow && "opacity-50 grayscale obs-hide-shadow")}>
      <TitleRow hidden={hideTitle}>
        <Ban size={12} className="animate-pulse" /> {layout?.title || t('banSelection', 'Ban Selection')}
      </TitleRow>
      <div className="flex flex-col gap-1 text-xs">
        <StatLine
          label={`${getPlayerLabel(1)} ${t('ready', 'Ready')}`}
          value={roomMeta?.player1ReadyBanSelection ? t('ready', 'Ready') : t('waiting', 'Waiting')}
        />
        <StatLine
          label={`${getPlayerLabel(2)} ${t('ready', 'Ready')}`}
          value={roomMeta?.player2ReadyBanSelection ? t('ready', 'Ready') : t('waiting', 'Waiting')}
        />
      </div>
      {isActive && (
        <div className="flex justify-center w-full">
          <BanPhaseAnimation layout={layout} compact overrides={layout?.banAnimationCompact} active={isActive} />
        </div>
      )}
    </div>
  );
}

export function MatchBanAnimationElement({ layout }) {
  const { roomMeta, hideElementTitles } = useOverlayStore();
  const { t } = useI18n();
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const isActive = roomMeta?.phase === 'ban_selection';

  if (!isActive) return null;

  return (
    <div className="p-2 flex flex-col gap-2 h-full">
      <TitleRow hidden={hideTitle}>
        <Ban size={12} className="animate-pulse" /> {layout?.title || t('banSelection', 'Ban Selection')}
      </TitleRow>
      <div className="flex justify-center w-full">
        <BanPhaseAnimation layout={layout} overrides={layout?.banAnimation} active={isActive} />
      </div>
    </div>
  );
}

export function MatchOpponentWaitElement({ layout }) {
  const { player1State, player2State, currentUser_id, isSpectator, hideElementTitles, roomMeta, queueState } = useOverlayStore();
  const { t } = useI18n();
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const isUserP1 = currentUser_id && (player1State?.playerId === currentUser_id || roomMeta?.player1_id === currentUser_id);
  const isUserP2 = currentUser_id && (player2State?.playerId === currentUser_id || roomMeta?.player2_id === currentUser_id);
  const opponentState = isUserP1 ? player2State : (isUserP2 ? player1State : null);

  const hasMatchContext = queueState?.status === 'match_confirmed' || roomMeta?.phase === 'ban_selection' || roomMeta?.phase === 'game';
  const waitingForOpponent = !isSpectator && !!currentUser_id && (isUserP1 || isUserP2) && !opponentState && hasMatchContext;
  const isShadow = !waitingForOpponent;

  return (
    <div className={cn("p-2 flex flex-col gap-2 h-full", isShadow && "opacity-50 grayscale obs-hide-shadow")}>
      <TitleRow hidden={hideTitle}>
        <Loader2 size={12} className="animate-spin" /> {layout?.title || t('waitingOpponentData', 'Waiting for opponent data')}
      </TitleRow>
      <div className="text-xs text-white/60 obs-hide-in-overlay">
        {t('waitingOpponentDataHint', 'Opponent data has not arrived yet')}
      </div>
    </div>
  );
}

export function MatchmakingSmartElement({ layout }) {
  const { queueState, roomMeta, player1State, player2State, currentUser_id, isSpectator, hideElementTitles } = useOverlayStore();
  const { t } = useI18n();
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const queueElapsed = useQueueElapsed(queueState);

  const isSearching = queueState?.inQueue || queueState?.status === 'searching';
  const isBanSelection = roomMeta?.phase === 'ban_selection';
  const isGamePhase = roomMeta?.phase === 'game' || roomMeta?.phase === 'ended';

  const isUserP1 = currentUser_id && (player1State?.playerId === currentUser_id || roomMeta?.player1_id === currentUser_id);
  const isUserP2 = currentUser_id && (player2State?.playerId === currentUser_id || roomMeta?.player2_id === currentUser_id);
  const opponentState = isUserP1 ? player2State : (isUserP2 ? player1State : null);

  const hasMatchContext = queueState?.status === 'match_confirmed' || roomMeta?.phase === 'ban_selection' || roomMeta?.phase === 'game';
  const waitingForOpponent = !isSpectator && !!currentUser_id && (isUserP1 || isUserP2) && !opponentState && hasMatchContext;
  const playerAccepted = !!queueState?.playerAccepted;
  const opponentAccepted = !!queueState?.opponentAccepted;
  const declinedBy = queueState?.declinedBy ?? null;

  const mode = useMemo(() => {
    if (isGamePhase) return 'idle';
    if (isBanSelection) return 'ban';
    if (waitingForOpponent) return 'opponent';
    if (queueState?.status === 'match_cancelled') return 'cancelled';
    if (playerAccepted || opponentAccepted) return 'acceptance';
    if (isSearching) return 'search';
    return 'idle';
  }, [isGamePhase, isBanSelection, waitingForOpponent, queueState?.status, playerAccepted, opponentAccepted, isSearching]);

  const isShadow = mode === 'idle';

  const declinedLabel = useMemo(() => {
    if (declinedBy === null || declinedBy === undefined) return null;
    if (currentUser_id && declinedBy === currentUser_id) return t('declinedByYou', 'Declined by you');
    if (currentUser_id) return t('declinedByOpponent', 'Declined by opponent');
    return `${t('declinedBy', 'Declined by')} ${declinedBy}`;
  }, [declinedBy, currentUser_id, t]);

  return (
    <div className={cn("p-2 flex flex-col gap-3 h-full", isShadow && "opacity-50 grayscale obs-hide-shadow")}>
      <TitleRow hidden={hideTitle}>
        <Activity size={12} /> {layout?.title || t('matchmaking', 'Matchmaking')}
      </TitleRow>

      {(mode === 'search' || isShadow) && (
        <SearchingPanel
          compact
          elapsed={isShadow ? 0 : queueElapsed}
          queueType={formatQueueType(queueState?.queueType, t)}
          title={t('searchingMatch', 'Searching for Match')}
        />
      )}

      {mode === 'ban' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs text-white/80">
            <Ban size={12} className="animate-pulse" />
            <span>{t('banSelection', 'Ban Selection')}</span>
          </div>
          <div className="flex justify-center w-full">
            <BanPhaseAnimation layout={layout} compact overrides={layout?.banAnimationCompact} />
          </div>
        </div>
      )}

      {mode === 'acceptance' && (
        <div className="flex flex-col gap-1 text-xs text-white/70">
          <div>{t('you', 'You')}: {playerAccepted ? t('accepted', 'Accepted') : t('waiting', 'Waiting')}</div>
          <div>{t('opponent', 'Opponent')}: {opponentAccepted ? t('accepted', 'Accepted') : t('waiting', 'Waiting')}</div>
        </div>
      )}

      {mode === 'cancelled' && (
        <div className="text-xs text-red-300">
          {declinedLabel || t('matchDeclined', 'Match Declined')}
        </div>
      )}

      {mode === 'opponent' && (
        <div className="flex flex-col items-center justify-center gap-2 text-xs text-white/70">
          <Ping size="35" speed="2" color="white" />
          <span>{t('waitingOpponentData', 'Waiting for opponent data')}</span>
        </div>
      )}
    </div>
  );
}

export function MatchEndElement({ playerId, layout }) {
  const { roomMeta, matchEndState, hideElementTitles } = useOverlayStore();
  const { t } = useI18n();
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const isActive = !!matchEndState?.active
    || roomMeta?.phase === 'ended'
    || roomMeta?.status === 'ended'
    || roomMeta?.status === 'cancelled';

  if (!isActive) return null;

  const status = resolveMatchEndStatus({ roomMeta, matchEndState, playerId });
  const label = resolveMatchEndLabel(status, t);
  const badgeClass = resolveMatchEndClass(status);

  return (
    <div
      className={cn('p-2 flex flex-col gap-2 h-full match-end-fade')}
      style={{ opacity: matchEndState?.fadeActive ? 0 : 1 }}
    >
      <TitleRow hidden={hideTitle}>
        <Trophy size={12} /> {layout?.title || t('matchEnd', 'Match End')}
      </TitleRow>
      <div className="flex items-center gap-2">
        <div className={cn('px-2 py-1 rounded-md border text-xs font-semibold uppercase tracking-wide', badgeClass)}>
          {label}
        </div>
      </div>
    </div>
  );
}
