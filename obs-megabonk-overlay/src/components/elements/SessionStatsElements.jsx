import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { useOverlayStore } from '@/stores/overlayStore';
import { useI18n } from '@/lib/i18n';
import { BarChart3, TrendingUp, TrendingDown, Crown } from 'lucide-react';

function TitleRow({ hidden, className, children }) {
  return (
    <div
      className={cn(
        'text-xs text-white/80 uppercase tracking-wider flex items-center gap-1 obs-hide-in-overlay obs-preserve-space',
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
      <span className="text-white/60">{label}</span>
      <span className={cn('font-alagard tabular-nums alagard-numeric', color)}>{value ?? '--'}</span>
    </div>
  );
}

function formatDelta(delta) {
  if (delta === null || delta === undefined) return '--';
  const numeric = Number(delta);
  if (!Number.isFinite(numeric)) return '--';
  const sign = numeric > 0 ? '+' : '';
  return `${sign}${numeric}`;
}

function resolveRankLabel(rank) {
  if (rank === null || rank === undefined) return '--';
  return `#${rank}`;
}

export function SessionCurrentElement({ layout }) {
  const { t } = useI18n();
  const sessionStats = useOverlayStore(s => s.sessionStats);
  const hideTitle = useOverlayStore(s => s.hideElementTitles) || !!layout?.hideTitle;

  const isShadow = !sessionStats?.active;
  const startRating = Number(sessionStats?.startRating);
  const currentRating = Number(sessionStats?.currentRating);
  const hasRatings = Number.isFinite(startRating) && Number.isFinite(currentRating);
  const ratingDiff = hasRatings ? currentRating - startRating : null;
  const diffText = ratingDiff === null ? '--' : `${ratingDiff > 0 ? '+' : ''}${ratingDiff}`;
  const diffColor = ratingDiff > 0
    ? 'text-[#009216]'
    : ratingDiff < 0
      ? 'text-[#E62E00]'
      : 'text-white/70';
  const rankLabel = resolveRankLabel(sessionStats?.currentRank);
  const ratingLabel = Number.isFinite(currentRating) ? currentRating : '--';

  return (
    <div className={cn('p-2 flex flex-col h-full', isShadow && 'opacity-50 grayscale obs-hide-shadow')}>
      <div className="flex items-center justify-between">
        <span className={cn('text-xs text-white/80 uppercase tracking-wider drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]', hideTitle && 'opacity-0') }>
          {layout?.title || t('current', 'Current')}
        </span>
        <span className={cn('text-lg font-alagard tabular-nums alagard-numeric drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]', diffColor)}>
          {diffText}
        </span>
      </div>
      <div className="text-3xl font-alagard tabular-nums alagard-numeric text-white drop-shadow-[2px_2px_0px_rgba(0,0,0,1)]">
        {ratingLabel}
      </div>
      <div className="text-xs font-alagard tabular-nums alagard-numeric text-white/70 drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]">
        {t('rank', 'Rank')}: {rankLabel}
      </div>
    </div>
  );
}

export function SessionSummaryElement({ layout }) {
  const { t } = useI18n();
  const sessionStats = useOverlayStore(s => s.sessionStats);
  const hideTitle = useOverlayStore(s => s.hideElementTitles) || !!layout?.hideTitle;

  const isShadow = !sessionStats?.active;
  const startRating = sessionStats?.startRating ?? '--';
  const startRank = resolveRankLabel(sessionStats?.startRank);
  const currentRating = sessionStats?.currentRating ?? '--';
  const currentRank = resolveRankLabel(sessionStats?.currentRank);

  return (
    <div className={cn('p-2 flex flex-col gap-2 h-full', isShadow && 'opacity-50 grayscale obs-hide-shadow')}>
      <TitleRow hidden={hideTitle}>
        <BarChart3 size={12} /> {layout?.title || t('sessionSummary', 'Session Summary')}
      </TitleRow>
      <div className="flex items-center justify-between text-[10px] text-white/60 uppercase tracking-wide">
        <div className="flex items-center gap-1">
          <Crown size={10} /> {t('rank', 'Rank')}
        </div>
        <div className="flex items-center gap-1">
          <TrendingUp size={10} /> {t('rating', 'Rating')}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-white/10 p-2">
          <div className="text-[11px] text-white/50 uppercase tracking-wide">{t('sessionStart', 'Start')}</div>
          <div className="text-sm text-white/90 font-alagard tabular-nums alagard-numeric">{startRating}</div>
          <div className="text-[11px] text-[#00927A] font-alagard tabular-nums alagard-numeric">{startRank}</div>
        </div>
        <div className="rounded-md border border-white/10 p-2">
          <div className="text-[11px] text-white/50 uppercase tracking-wide">{t('sessionCurrent', 'Current')}</div>
          <div className="text-sm text-white/90 font-alagard tabular-nums alagard-numeric">{currentRating}</div>
          <div className="text-[11px] text-[#00927A] font-alagard tabular-nums alagard-numeric">{currentRank}</div>
        </div>
      </div>
    </div>
  );
}

export function SessionRatingElement({ layout }) {
  const { t } = useI18n();
  const sessionStats = useOverlayStore(s => s.sessionStats);
  const hideTitle = useOverlayStore(s => s.hideElementTitles) || !!layout?.hideTitle;
  const isShadow = !sessionStats?.active;

  return (
    <div className={cn('p-2 flex flex-col gap-2 h-full', isShadow && 'opacity-50 grayscale obs-hide-shadow')}>
      <TitleRow hidden={hideTitle}>
        <TrendingUp size={12} /> {layout?.title || t('sessionRating', 'Session Rating')}
      </TitleRow>
      <StatLine
        label={t('rating', 'Rating')}
        value={sessionStats?.currentRating ?? '--'}
        color="text-cyan-200"
      />
    </div>
  );
}

export function SessionRankElement({ layout }) {
  const { t } = useI18n();
  const sessionStats = useOverlayStore(s => s.sessionStats);
  const hideTitle = useOverlayStore(s => s.hideElementTitles) || !!layout?.hideTitle;
  const isShadow = !sessionStats?.active;

  return (
    <div className={cn('p-2 flex flex-col gap-2 h-full', isShadow && 'opacity-50 grayscale obs-hide-shadow')}>
      <TitleRow hidden={hideTitle}>
        <Crown size={12} /> {layout?.title || t('sessionRank', 'Session Rank')}
      </TitleRow>
      <StatLine
        label={t('rank', 'Rank')}
        value={resolveRankLabel(sessionStats?.currentRank)}
        color="text-yellow-300"
      />
    </div>
  );
}

export function SessionGamesElement({ layout }) {
  const { t } = useI18n();
  const sessionStats = useOverlayStore(s => s.sessionStats);
  const sessionGameDisplayLimit = useOverlayStore(s => s.sessionGameDisplayLimit);
  const hideTitle = useOverlayStore(s => s.hideElementTitles) || !!layout?.hideTitle;

  const displayLimit = useMemo(() => (
    Math.max(1, Math.min(20, sessionGameDisplayLimit || 10))
  ), [sessionGameDisplayLimit]);

  const games = useMemo(() => {
    const list = Array.isArray(sessionStats?.games) ? sessionStats.games : [];
    return list.slice(-displayLimit);
  }, [sessionStats, displayLimit]);

  const shouldShowData = games.length > 0;
  const placeholderGames = useMemo(() => (
    Array.from({ length: displayLimit }).map((_, index) => ({
      placeholder: true,
      key: `placeholder-${index}`,
    }))
  ), [displayLimit]);
  const rows = shouldShowData ? games : placeholderGames;
  const isShadow = !shouldShowData;

  return (
    <div className={cn('p-2 flex flex-col gap-2 h-full', isShadow && 'opacity-50 grayscale obs-hide-shadow')}>
      <TitleRow hidden={hideTitle}>
        <BarChart3 size={12} /> {layout?.title || t('sessionGames', 'Session Games')}
      </TitleRow>
      <div className={cn('flex flex-col gap-0.5 text-xs drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]', !shouldShowData && 'text-white/40')}>
        {rows.map((game, index) => {
          const isPlaceholder = !!game?.placeholder || !shouldShowData;
          const deltaValue = isPlaceholder ? 0 : game?.delta;
          const delta = isPlaceholder ? '+0' : formatDelta(deltaValue);
          const isPositive = !isPlaceholder && typeof game?.delta === 'number' && game.delta > 0;
          const isNegative = !isPlaceholder && typeof game?.delta === 'number' && game.delta < 0;
          const deltaColor = isPositive ? 'text-[#009216]' : isNegative ? 'text-[#E62E00]' : 'text-white/70';
          const rawResult = isPlaceholder ? '--' : (game?.result || '--');
          const result = isPlaceholder
            ? '--'
            : (String(rawResult || '').toLowerCase().includes('win')
              ? 'Win'
              : String(rawResult || '').toLowerCase().includes('loss')
                ? 'Loss'
                : rawResult);
          const ratingAfter = isPlaceholder ? '--' : (game?.ratingAfter ?? '--');
          const resultClass = isPlaceholder
            ? 'text-white/60'
            : (String(result || '').toLowerCase().includes('win')
              ? 'text-[#009216]'
              : String(result || '').toLowerCase().includes('loss')
                ? 'text-[#E62E00]'
                : 'text-white/60');

          return (
            <div key={game?.timestamp || game?.key || index} className={cn('flex items-center gap-2', isPlaceholder && 'obs-hide-shadow')}>
              <span className={cn('text-sm font-alagard truncate w-10 justify-self-start', resultClass)}>{result}</span>
              <span className="text-xs text-white/40"></span>
              <span className={cn('text-sm font-alagard tabular-nums alagard-numeric w-5 justify-self-center text-right', deltaColor)}>{delta}</span>
              <span className="text-xs text-white/40"></span>
              <span className="text-sm text-white/85 font-alagard tabular-nums alagard-numeric w-10 justify-self-end text-right">{ratingAfter}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
