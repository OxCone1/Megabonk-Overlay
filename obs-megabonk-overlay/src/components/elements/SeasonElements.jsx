import { useMemo } from 'react';
import { useOverlayStore } from '@/stores/overlayStore';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';

function formatDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString();
}

function formatLimit(value) {
  if (value == null) return '--';
  const minutes = Math.floor(Number(value) / 60);
  if (!Number.isFinite(minutes) || minutes <= 0) return `${value}`;
  return `${minutes}m`;
}

function StatLine({ label, value, valueColor }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-white/60 obs-hide-in-overlay">{label}</span>
      <span className={cn('font-medium text-white/80')} style={valueColor ? { color: valueColor } : undefined}>
        {value ?? '--'}
      </span>
    </div>
  );
}

function TitleRow({ hidden, children }) {
  return (
    <div
      className={cn(
        'text-xs font-semibold text-white/80 uppercase tracking-wider obs-hide-in-overlay obs-preserve-space',
        hidden && 'opacity-0'
      )}
    >
      {children}
    </div>
  );
}

export function SeasonInfoElement({ layout }) {
  const { seasonInfo, hideElementTitles } = useOverlayStore();
  const { t } = useI18n();
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const textColor = layout?.textColor || '#67e8f9';

  const season = useMemo(() => ({
    name: seasonInfo?.name || '--',
    timeLimit: formatLimit(seasonInfo?.timeLimit),
    pauseLimit: formatLimit(seasonInfo?.pauseLimit),
    startDate: formatDate(seasonInfo?.startDate),
    endDate: formatDate(seasonInfo?.endDate),
  }), [seasonInfo]);

  return (
    <div className="p-2 flex flex-col gap-2 h-full">
      <TitleRow hidden={hideTitle}>{layout?.title || t('seasonInfo', 'Season Info')}</TitleRow>
      <div className="text-sm font-semibold" style={{ color: textColor }}>
        {season.name}
      </div>
      <div className="flex flex-col gap-1">
        <StatLine label={t('timeLimit', 'Time Limit')} value={season.timeLimit} valueColor={textColor} />
        <StatLine label={t('pauseLimit', 'Pause Limit')} value={season.pauseLimit} valueColor={textColor} />
        <StatLine label={t('startDate', 'Start Date')} value={season.startDate} valueColor={textColor} />
        <StatLine label={t('endDate', 'End Date')} value={season.endDate} valueColor={textColor} />
      </div>
    </div>
  );
}

function SingleValue({ label, value, hideLabel, textColor }) {
  return (
    <div className="p-2 h-full flex flex-col justify-center gap-1">
      <span
        className={cn(
          'text-[10px] text-white/60 uppercase tracking-wider obs-hide-in-overlay obs-preserve-space',
          hideLabel && 'opacity-0'
        )}
      >
        {label}
      </span>
      <span className="text-sm font-semibold" style={textColor ? { color: textColor } : undefined}>
        {value ?? '--'}
      </span>
    </div>
  );
}

export function SeasonNameElement({ layout }) {
  const { seasonInfo, hideElementTitles } = useOverlayStore();
  const { t } = useI18n();
  const hideLabel = hideElementTitles || !!layout?.hideTitle;
  return (
    <SingleValue
      label={layout?.title || t('season', 'Season')}
      value={seasonInfo?.name || '--'}
      hideLabel={hideLabel}
      textColor={layout?.textColor || '#67e8f9'}
    />
  );
}

export function SeasonTimeLimitElement({ layout }) {
  const { seasonInfo, hideElementTitles } = useOverlayStore();
  const { t } = useI18n();
  const hideLabel = hideElementTitles || !!layout?.hideTitle;
  return (
    <SingleValue
      label={layout?.title || t('timeLimit', 'Time Limit')}
      value={formatLimit(seasonInfo?.timeLimit)}
      hideLabel={hideLabel}
      textColor={layout?.textColor || '#67e8f9'}
    />
  );
}

export function SeasonPauseLimitElement({ layout }) {
  const { seasonInfo, hideElementTitles } = useOverlayStore();
  const { t } = useI18n();
  const hideLabel = hideElementTitles || !!layout?.hideTitle;
  return (
    <SingleValue
      label={layout?.title || t('pauseLimit', 'Pause Limit')}
      value={formatLimit(seasonInfo?.pauseLimit)}
      hideLabel={hideLabel}
      textColor={layout?.textColor || '#67e8f9'}
    />
  );
}

export function SeasonStartDateElement({ layout }) {
  const { seasonInfo, hideElementTitles } = useOverlayStore();
  const { t } = useI18n();
  const hideLabel = hideElementTitles || !!layout?.hideTitle;
  return (
    <SingleValue
      label={layout?.title || t('startDate', 'Start Date')}
      value={formatDate(seasonInfo?.startDate)}
      hideLabel={hideLabel}
      textColor={layout?.textColor || '#67e8f9'}
    />
  );
}

export function SeasonEndDateElement({ layout }) {
  const { seasonInfo, hideElementTitles } = useOverlayStore();
  const { t } = useI18n();
  const hideLabel = hideElementTitles || !!layout?.hideTitle;
  return (
    <SingleValue
      label={layout?.title || t('endDate', 'End Date')}
      value={formatDate(seasonInfo?.endDate)}
      hideLabel={hideLabel}
      textColor={layout?.textColor || '#67e8f9'}
    />
  );
}
