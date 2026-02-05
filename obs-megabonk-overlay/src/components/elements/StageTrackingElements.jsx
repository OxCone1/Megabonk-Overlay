import { memo } from 'react';
import { useOverlayStore } from '@/stores/overlayStore';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { formatStageTime, getStageDisplay } from '@/lib/stageTracking';
import { Flag } from 'lucide-react';

const TitleRow = memo(function TitleRow({ hidden, className, children }) {
  return (
    <div
      className={cn(
        'text-xs font-semibold uppercase tracking-wider flex items-center gap-1 mb-1 obs-hide-in-overlay obs-preserve-space',
        hidden && 'opacity-0',
        className
      )}
    >
      {children}
    </div>
  );
});

export function StageStateElement({ playerId, layout }) {
  const { hideElementTitles } = useOverlayStore();
  const { t } = useI18n();
  const tracking = useOverlayStore((state) => state.stageTracking?.[playerId]);
  const display = getStageDisplay(tracking);
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const rawEventLabel = display?.eventLabel ? display.eventLabel.toUpperCase() : '';
  const eventLabel = rawEventLabel === 'FINAL SWARM' ? 'FINAL\nSWARM' : rawEventLabel;
  const eventPlaceholder = t('stageEventPlaceholder', 'EVENT');
  const eventLabelState = eventLabel || eventPlaceholder;
  const eventVisible = !!eventLabel || !!display?.eventFadeOut;
  const eventPlacement = layout?.eventPlacement ?? 'top';

  if (!tracking?.enabled || !display) {
    return (
      <div className="p-2 flex flex-col gap-2 h-full obs-hide-shadow">
        <TitleRow hidden={hideTitle} className="text-cyan-300">
          <Flag size={12} /> {layout?.title || t('stageState', 'Stage')}
        </TitleRow>
        {eventPlacement === 'top' && (
          <div className="flex items-center justify-center text-white">
            <div className="text-xl text-white/40 text-center leading-tight whitespace-pre-line drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]">
              {eventPlaceholder}
            </div>
          </div>
        )}
        <div className="flex items-center justify-between text-white">
          <div className="text-md tracking-wide text-white/40">{t('stageLabel', 'Stage')} --</div>
          <span className="text-xl font-alagard alagard-numeric leading-none text-white/40 drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]">
            --:--
          </span>
        </div>
        {eventPlacement === 'bottom' && (
          <div className="flex items-center justify-center text-white">
            <div className="text-xl text-white/40 text-center leading-tight whitespace-pre-line drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]">
              {eventPlaceholder}
            </div>
          </div>
        )}
      </div>
    );
  }

  const timerColor = display.isFinalSwarm || display.direction === 'up' ? 'text-[#E62E00]' : 'text-white';

  return (
    <div className="p-2 flex flex-col gap-2">
      <TitleRow hidden={hideTitle} className="text-cyan-300">
        <Flag size={12} /> {layout?.title || t('stageState', 'Stage')}
      </TitleRow>
      {eventPlacement === 'top' && (
        <div className="flex items-center justify-center text-white">
          <div
            className={cn(
              'text-lg text-[#E62E00] text-center leading-tight transition-opacity drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]',
              eventVisible ? 'opacity-100' : 'opacity-0'
            )}
          >
            {eventLabelState}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between text-white/80">
        <div className="text-md tracking-wide drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]">{t('stageLabel', 'Stage')} {display.stageNumber}</div>
        <span className={cn('text-lg font-alagard alagard-numeric leading-none drop-shadow-[1px_1px_0px_rgba(0,0,0,1)] transform-[scaleY(1.05)]', timerColor)}>
          {formatStageTime(display.timeSeconds)}
        </span>
      </div>
      {eventPlacement === 'bottom' && (
        <div className="flex items-center justify-center text-white">
          <div
            className={cn(
              'text-xl w-full text-[#E62E00] text-center leading-tight transform-[translateY(-35%)] transition-opacity drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]',
              eventVisible ? 'opacity-100' : 'opacity-0'
            )}
          >
            {eventLabelState}
          </div>
        </div>
      )}
    </div>
  );
}

export function StageHistoryElement({ playerId, layout }) {
  const { hideElementTitles } = useOverlayStore();
  const { t } = useI18n();
  const tracking = useOverlayStore((state) => state.stageTracking?.[playerId]);
  const spoofEnabled = useOverlayStore((state) => state.spoofEnabled);
  const spoofStageHistory = useOverlayStore((state) => state.spoofStageHistory);
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const history = Array.isArray(tracking?.history) ? tracking.history : [];
  const spoofEntries = spoofEnabled
    ? [1, 2, 3].map((stageNumber) => {
      const entry = spoofStageHistory?.[playerId]?.[stageNumber] || {};
      const timeSeconds = entry.timeSeconds ?? null;
      const kills = entry.kills ?? null;
      const difficultyPercent = entry.difficultyPercent ?? null;
      const hasValues = timeSeconds !== null || kills !== null;
      return hasValues ? {
        stageNumber,
        timeSeconds,
        kills,
        difficultyPercent,
        exitReason: t('stageExit', 'Exit'),
        timestamp: stageNumber,
      } : null;
    }).filter(Boolean)
    : null;
  const items = (spoofEntries || history).slice(-4).reverse();

  if ((!tracking?.enabled && !spoofEntries) || items.length === 0) {
    return (
      <div className="p-2 flex flex-col items-center justify-center h-full obs-hide-shadow">
        <div className="text-xs text-white/40 italic">{t('noData', 'No data')}</div>
      </div>
    );
  }

  return (
    <div className="p-2 flex flex-col gap-2">
      <TitleRow hidden={hideTitle} className="text-purple-300">
        <Flag size={12} /> {layout?.title || t('stageHistory', 'Stage History')}
      </TitleRow>
      <div className="flex flex-col gap-2">
        {items.map((entry, index) => (
          <div key={`${entry.stageNumber}-${entry.timestamp}-${index}`} className="grid grid-cols-4 items-center text-sm">
            <div className="flex flex-col">
              <span className="text-white transform-[scaleY(1.07)] drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]">{t('stageLabel', 'Stage')} {entry.stageNumber}</span>
              {/* {entry.exitReason && (
                <span className={cn('text-[10px]', entry.exitReason === 'Final Swarm' ? 'text-red-500' : 'text-white/50')}>
                  {entry.exitReason}
                </span>
              )} */}
            </div>
            <span className={cn(entry.exitReason === 'Final Swarm' ? 'text-[#E62E00]' : 'text-white/50', " tabular-nums alagard-numeric transform-[scaleY(1.07)] text-center drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]")}>
              {formatStageTime(entry.timeSeconds)}
            </span>
            <span className="text-white tabular-nums alagard-numeric transform-[scaleY(1.07)] text-center drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]">
              {entry.kills !== null && entry.kills !== undefined ? entry.kills : '--'}
            </span>
            <span className="text-white tabular-nums alagard-numeric transform-[scaleY(1.07)] text-right drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]">
              {entry.difficultyPercent !== null && entry.difficultyPercent !== undefined ? `${entry.difficultyPercent}%` : '--'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
