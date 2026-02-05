import { memo, useState } from 'react';
import { useOverlayStore } from '@/stores/overlayStore';
import { cn } from '@/lib/utils';
import { Skull, Coins, Zap, Flame, Timer, Crown, ChevronDown, ChevronUp } from 'lucide-react';
import CountUp from 'react-countup';
import { useI18n } from '@/lib/i18n';
import { resolvePublicAssetPath } from '@/lib/publicAsset';

const CountUpComponent = (CountUp && CountUp.default) ? CountUp.default : CountUp;
const resolveJustify = (justify) => {
  switch (justify) {
    case 'center':
      return 'center';
    case 'end':
      return 'flex-end';
    case 'space-around':
      return 'space-around';
    case 'space-between':
      return 'space-between';
    case 'start':
    default:
      return 'flex-start';
  }
};

// Memoized StatRow component to prevent unnecessary re-renders
const StatRow = memo(function StatRow({ label, value, icon, color = 'text-white/80', justify = 'start' }) {
  const renderSafe = (val) => {
    try {
      // If val is a React element, ensure its type is valid
      if (val && typeof val === 'object' && val.$$typeof) {
        const t = val.type;
        if (typeof t !== 'string' && typeof t !== 'function') {
          console.error('StatRow: invalid element type detected for value', t, val);
          return String(val);
        }
      }
      return val;
    } catch (e) {
      console.error('StatRow: error rendering value', e, val);
      return String(val);
    }
  };

  return (
    <div className="flex items-center gap-2 text-xs" style={{ justifyContent: resolveJustify(justify) }}>
      <div className="flex items-center gap-1 text-white/60">
        {icon}
        <span className="obs-hide-in-overlay">{label}</span>
      </div>
      <span className={cn("font-medium tabular-nums alagard-numeric", color)}>{renderSafe(value)}</span>
    </div>
  );
});

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

function formatNumber(num) {
  const numeric = Number(num);
  if (!Number.isFinite(numeric)) return '--';
  if (numeric >= 1000000) return (numeric / 1000000).toFixed(2) + 'M';
  if (numeric >= 1000) return (numeric / 1000).toFixed(2) + 'K';
  return Math.round(numeric).toString();
}

// CountUp wrapper that remembers previous value per instance and animates from previous -> current
function CountUpStat({ value, start = null, paused = false, playerId = null, statKey = '', duration = 0.9 }) {
  const numeric = Number(value);
  const isValid = value !== undefined && value !== null && Number.isFinite(numeric);
  const end = isValid ? Math.round(numeric) : null;

  if (!isValid) return '--';

  if (paused) {
    return <span>{end.toLocaleString()}</span>;
  }

  // Use resolved CountUp component if available
  if (CountUpComponent) {
    const resolvedStart = (start !== null && start !== undefined && Number.isFinite(Number(start)))
      ? Number(start)
      : undefined;
    return (
      <CountUpComponent
        key={`${playerId || 'p'}-${statKey}-${end}`}
        start={resolvedStart}
        end={end}
        duration={duration}
        separator="," 
      />
    );
  }

  return <span>{end.toLocaleString()}</span>;
}

function CountUpDecimalStat({ value, start = null, paused = false, playerId = null, statKey = '', duration = 0.9, decimals = 2 }) {
  const numeric = Number(value);
  const isValid = value !== undefined && value !== null && Number.isFinite(numeric);
  const end = isValid ? Number(numeric.toFixed(decimals)) : null;

  if (!isValid) return '--';

  if (paused) {
    return <span>{end.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
  }

  if (CountUpComponent) {
    const resolvedStart = (start !== null && start !== undefined && Number.isFinite(Number(start)))
      ? Number(start)
      : undefined;
    return (
      <CountUpComponent
        key={`${playerId || 'p'}-${statKey}-${end}`}
        start={resolvedStart}
        end={end}
        duration={duration}
        separator=","
        decimals={decimals}
        decimal="."
      />
    );
  }

  return <span>{end.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}</span>;
}

function renderCountUp(value, playerId = null, statKey = '', options = {}) {
  return <CountUpStat value={value} playerId={playerId} statKey={statKey} start={options.start} paused={options.paused} />;
}

function renderCountUpDecimal(value, playerId = null, statKey = '', decimals = 2, options = {}) {
  return <CountUpDecimalStat value={value} playerId={playerId} statKey={statKey} decimals={decimals} start={options.start} paused={options.paused} />;
}

export function CombatStatsElement({ playerId, layout }) {
  const { getPlayerState, hideElementTitles } = useOverlayStore();
  const { t } = useI18n();
  const killTracking = useOverlayStore((state) => state.killTracking);
  const isDragging = useOverlayStore((state) => state.isDragging);
  const isPanning = useOverlayStore((state) => state.isPanning);
  const playerState = getPlayerState(playerId);
  const combat = playerState?.combat;
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const showField = (key) => layout?.visibleFields?.[key] !== false;
  const justify = layout?.justify ?? 'start';
  const tracking = killTracking?.[playerId];
  const paused = isDragging || isPanning;

  if (!combat) {
    return <div className="p-2 text-xs text-white/40 italic obs-hide-shadow">{t('noData', 'No data')}</div>;
  }

  return (
    <div className="p-2 flex flex-col gap-1">
      <TitleRow hidden={hideTitle} className="text-red-400">
        <Skull size={12} /> {layout?.title || t('combat', 'Combat')}
      </TitleRow>
      {showField('kills') && (
        <StatRow
          label={t('kills', 'Kills')}
          value={renderCountUp(combat.killCount, playerId, 'killCount', { start: tracking?.prevKillCount, paused })}
            icon={<img src={resolvePublicAssetPath('/Game Icons/Interface/kills.png')} alt="" className="w-3 h-3 object-contain" style={{ imageRendering: 'pixelated' }} />}
          color="text-red-400"
          justify={justify}
        />
      )}
      {showField('gold') && (
        <StatRow
          label={t('gold', 'Gold')}
          value={formatNumber(combat.currentGold)}
            icon={<img src={resolvePublicAssetPath('/Game Icons/Interface/gold.png')} alt="" className="w-3 h-3 object-contain" style={{ imageRendering: 'pixelated' }} />}
          color="text-yellow-400"
          justify={justify}
        />
      )}
      {showField('damageDealt') && (
        <StatRow
          label={t('damageDealt', 'Damage Dealt')}
          value={formatNumber(combat.totalDamageDealt)}
          color="text-orange-400"
          justify={justify}
        />
      )}
      {showField('damageTaken') && (
        <StatRow
          label={t('damageTaken', 'Damage Taken')}
          value={formatNumber(combat.totalDamageTaken)}
          color="text-red-500"
          justify={justify}
        />
      )}
    </div>
  );
}

export function ShrineStatsElement({ playerId, layout }) {
  const { getPlayerState, hideElementTitles } = useOverlayStore();
  const { t } = useI18n();
  const playerState = getPlayerState(playerId);
  const shrines = playerState?.combat.shrines;
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const showField = (key) => layout?.visibleFields?.[key] !== false;
  const justify = layout?.justify ?? 'start';

  if (!shrines) {
    return <div className="p-2 text-xs text-white/40 italic obs-hide-shadow">{t('noData', 'No data')}</div>;
  }

  return (
    <div className="p-2 flex flex-col gap-1">
      <TitleRow hidden={hideTitle} className="text-purple-400">
        <Crown size={12} /> {layout?.title || t('shrines', 'Shrines')}
      </TitleRow>
      {showField('balance') && <StatRow label={t('balance', 'Balance')} value={shrines.balance} color="text-blue-400" justify={justify} />}
      {showField('greed') && <StatRow label={t('greed', 'Greed')} value={shrines.greed} color="text-yellow-400" justify={justify} />}
      {showField('challenge') && <StatRow label={t('challenge', 'Challenge')} value={shrines.challenge} color="text-red-400" justify={justify} />}
      {showField('cursed') && <StatRow label={t('cursed', 'Cursed')} value={shrines.cursed} color="text-purple-400" justify={justify} />}
      {showField('magnet') && <StatRow label={t('magnet', 'Magnet')} value={shrines.magnet} color="text-cyan-400" justify={justify} />}
      {showField('moai') && <StatRow label={t('moai', 'Moai')} value={shrines.moai} color="text-stone-400" justify={justify} />}
      {showField('charge') && <StatRow label={t('charge', 'Charge')} value={shrines.charge_normal} color="text-orange-400" justify={justify} />}
      {showField('goldenCharge') && <StatRow label={t('goldenCharge', 'Golden Charge')} value={shrines.charge_golden} color="text-yellow-300" justify={justify} />}
    </div>
  );
}

export function GameStatsElement({ playerId, layout }) {
  const [expanded, setExpanded] = useState(false);
  const { getPlayerState, hideElementTitles } = useOverlayStore();
  const { t } = useI18n();
  const playerState = getPlayerState(playerId);
  const stats = playerState?.combat.gameStats;
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const showField = (key) => layout?.visibleFields?.[key] !== false;
  const justify = layout?.justify ?? 'start';

  if (!stats) {
    return <div className="p-2 text-xs text-white/40 italic obs-hide-shadow">{t('noData', 'No data')}</div>;
  }

  const showExtra = [
    'miniboss', 'skeleton', 'goblin', 'fire', 'lightning', 'crits', 'evades', 'projectiles',
    'items', 'chestsOpened', 'chestsBought', 'pots', 'powerups'
  ].some(showField);

  return (
    <div className="p-2 flex flex-col gap-1 overflow-auto">
      <TitleRow hidden={hideTitle} className="text-green-400">
        <Zap size={12} /> {layout?.title || t('gameStats', 'Game Stats')}
      </TitleRow>

      {/* Always visible stats */}
      {showField('goldEarned') && <StatRow label={t('goldEarned', 'Gold Earned')} value={formatNumber(stats.gold_earned)} color="text-yellow-400" justify={justify} />}
      {showField('goldSpent') && <StatRow label={t('goldSpent', 'Gold Spent')} value={formatNumber(stats.gold_spent)} color="text-yellow-500" justify={justify} />}
      {showField('xpGained') && <StatRow label={t('xpGained', 'XP Gained')} value={formatNumber(stats.xp_gained)} color="text-purple-400" justify={justify} />}
      {showField('eliteKills') && <StatRow label={t('eliteKills', 'Elite Kills')} value={stats.elite_kills} color="text-red-400" justify={justify} />}
      {showField('bossKills') && <StatRow label={t('bossKills', 'Boss Kills')} value={stats.boss_kills} color="text-orange-400" justify={justify} />}

      {/* Expandable section */}
      {showExtra && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-[10px] text-white/60 hover:text-white/80 mt-1 obs-hide-in-overlay"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {expanded ? t('showLess', 'Show less') : t('showMore', 'Show more')}
        </button>
      )}

      {expanded && showExtra && (
        <div className="flex flex-col gap-1 mt-1 pt-1 border-t border-white/10">
          {showField('miniboss') && <StatRow label={t('minibossKills', 'Miniboss Kills')} value={stats.miniboss_kills} justify={justify} />}
          {showField('skeleton') && <StatRow label={t('skeletonKills', 'Skeleton Kills')} value={stats.skeleton_kills} justify={justify} />}
          {showField('goblin') && <StatRow label={t('goblinKills', 'Goblin Kills')} value={stats.goblin_kills} justify={justify} />}
          {showField('fire') && <StatRow label={t('fireKills', 'Fire Kills')} value={stats.fire_kills} color="text-orange-400" justify={justify} />}
          {showField('lightning') && <StatRow label={t('lightningKills', 'Lightning Kills')} value={stats.lightning_kills} color="text-cyan-400" justify={justify} />}
          {showField('crits') && <StatRow label={t('crits', 'Crits')} value={formatNumber(stats.crits)} color="text-red-400" justify={justify} />}
          {showField('evades') && <StatRow label={t('evades', 'Evades')} value={stats.evades} color="text-cyan-400" justify={justify} />}
          {showField('projectiles') && <StatRow label={t('projectilesFired', 'Projectiles Fired')} value={formatNumber(stats.projectiles_fired)} justify={justify} />}
          {showField('items') && <StatRow label={t('itemsPickedUp', 'Items Picked Up')} value={stats.items_picked_up} justify={justify} />}
          {showField('chestsOpened') && <StatRow label={t('chestsOpened', 'Chests Opened')} value={stats.chests_opened} justify={justify} />}
          {showField('chestsBought') && <StatRow label={t('chestsBought', 'Chests Bought')} value={stats.chests_bought} justify={justify} />}
          {showField('pots') && <StatRow label={t('potsBroken', 'Pots Broken')} value={stats.pots_broken} justify={justify} />}
          {showField('powerups') && <StatRow label={t('powerupsUsed', 'Powerups Used')} value={stats.powerups_used} justify={justify} />}
        </div>
      )}
    </div>
  );
}

export function DamageSourcesElement({ playerId, layout }) {
  const { getPlayerState, hideElementTitles } = useOverlayStore();
  const { t } = useI18n();
  const playerState = getPlayerState(playerId);
  const sources = playerState?.combat.damageSources || {};
  const hideTitle = hideElementTitles || !!layout?.hideTitle;

  const sortedSources = Object.entries(sources)
    .sort(([, a], [, b]) => b - a);

  const total = Object.values(sources).reduce((sum, val) => sum + val, 0);

  if (sortedSources.length === 0) {
    return <div className="p-2 text-xs text-white/40 italic obs-hide-shadow">{t('noDamageData', 'No damage data')}</div>;
  }

  return (
    <div className="p-2 flex flex-col gap-1 overflow-auto">
      <TitleRow hidden={hideTitle} className="text-orange-400">
        <Flame size={12} /> {layout?.title || t('damageSources', 'Damage Sources')}
      </TitleRow>

      {sortedSources.slice(0, 8).map(([source, damage]) => {
        const percent = total > 0 ? (damage / total) * 100 : 0;
        return (
          <div key={source} className="flex flex-col gap-0.5">
            <div className="flex justify-between text-xs">
              <span className="text-white/80 truncate">{source}</span>
              <span className="text-white/60 tabular-nums alagard-numeric drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]">{formatNumber(damage)}</span>
            </div>
            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-orange-500 to-red-500 rounded-full"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        );
      })}

      {sortedSources.length > 8 && (
        <div className="text-[10px] text-white/40 text-center mt-1">
          +{sortedSources.length - 8} {t('moreSources', 'more sources')}
        </div>
      )}
    </div>
  );
}

// ============================================================
// INDIVIDUAL COMBAT STAT ELEMENTS
// ============================================================

// Memoized SingleCombatStatElement to prevent unnecessary re-renders
export const SingleCombatStatElement = memo(function SingleCombatStatElement({ playerId, path, label, color = 'text-white', fontSize = 'text-2xl', formatter = formatNumber, icon = null, layout }) {
  const { getPlayerState } = useOverlayStore();
  const { t } = useI18n();
  const playerState = getPlayerState(playerId);
  const justify = layout?.justify ?? 'start';
  const hideLabel = !!layout?.hideLabel;

  // Navigate nested path like "shrines.balance" or "gameStats.gold_earned"
  let value = playerState?.combat;
  if (value && path) {
    for (const key of path.split('.')) {
      value = value?.[key];
    }
  }

  const isMissing = value === undefined
    || value === null
    || !Number.isFinite(Number(value));
  const formatted = !isMissing
    ? (typeof formatter === 'function' ? formatter(value, { playerId, path }) : formatter(value))
    : '--';

  return (
    <div className={cn("p-2 flex items-center gap-2", isMissing && 'obs-hide-shadow')} style={{ justifyContent: resolveJustify(justify) }}>
      <div className="flex items-center gap-1">
        {icon && (
          <img
            src={icon}
            alt=""
            className="w-6 h-6 object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        )}
        <span className={cn('text-xs text-white/60 obs-preserve-space', hideLabel && 'opacity-0 pointer-events-none')}>{t(label, label)}</span>
      </div>
      <span style={{ filter: 'drop-shadow(1px 1px 0px black)' }} className={cn(fontSize, "flex items-center translate-y-[5%] tabular-nums alagard-numeric drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]", color)}>{formatted}</span>
    </div>
  );
});

// Basic Combat Stats - Individual
export function CombatKillCount({ playerId, layout }) {
  const killTracking = useOverlayStore((state) => state.killTracking);
  const isDragging = useOverlayStore((state) => state.isDragging);
  const isPanning = useOverlayStore((state) => state.isPanning);
  const tracking = killTracking?.[playerId];
  const paused = isDragging || isPanning;
  const formatter = (value) => renderCountUp(value, playerId, 'killCount', { start: tracking?.prevKillCount, paused });
  return (
    <SingleCombatStatElement
      playerId={playerId}
      layout={layout}
      path="killCount"
      label=""
      color="text-white"
      formatter={formatter}
      icon={resolvePublicAssetPath('/Game Icons/Interface/kills.png')}
    />
  );
}

export function CombatKillTick({ playerId, layout }) {
  const { t } = useI18n();
  const playerState = useOverlayStore((state) => state.getPlayerState(playerId));
  const killTracking = useOverlayStore((state) => state.killTracking);
  const isDragging = useOverlayStore((state) => state.isDragging);
  const isPanning = useOverlayStore((state) => state.isPanning);
  const justify = layout?.justify ?? 'start';
  const color = layout?.color ?? 'text-[#E62E00]';
  const hideLabel = !!layout?.hideLabel;
  const tracking = killTracking?.[playerId];
  const killCount = playerState?.combat?.killCount ?? tracking?.lastKillCount ?? 0;
  const runActive = playerState?.status === 'in_progress';
  const hasRunData = runActive && Number.isFinite(killCount) && killCount > 0;
  const tickValue = tracking?.lastTick ?? 0;
  const paused = isDragging || isPanning;
  const hasKillData = tracking?.lastKillCount !== null && tracking?.lastKillCount !== undefined;

  if (!hasRunData) {
    return null;
  }

  return (
    <div className={cn("p-2 flex items-center gap-2", !hasKillData && 'obs-hide-shadow')} style={{ justifyContent: resolveJustify(justify) }}>
      <div className="flex items-center gap-1">
        <span className={cn(hideLabel && 'opacity-0 pointer-events-none')}>
          <img
            src={resolvePublicAssetPath('/Game Icons/Interface/kills.png')}
            alt=""
            className="w-5 h-5 object-contain"
            style={{ imageRendering: 'pixelated' }}
          />
        </span>
        <span className={cn('text-lg text-white/90 drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]', hideLabel && 'opacity-0 pointer-events-none')}>{t('killTick', 'Kill Tick')}</span>
      </div>
      <span className={cn("text-xl tabular-nums alagard-numeric drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]", color)}>
        {renderCountUpDecimal(tickValue, playerId, 'killTick', 2, { start: tracking?.prevTick, paused })}
      </span>
    </div>
  );
}

export function CombatCurrentGold({ playerId, layout }) {
  return (
    <SingleCombatStatElement
      playerId={playerId}
      layout={layout}
      path="currentGold"
      label="Gold"
      color="text-yellow-400"
      icon={resolvePublicAssetPath('/Game Icons/Interface/gold.png')}
    />
  );
}

export function CombatTotalDamageDealt({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="totalDamageDealt" label="Damage Dealt" color="text-orange-400" />;
}

export function CombatTotalDamageTaken({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="totalDamageTaken" label="Damage Taken" color="text-red-500" />;
}

// Chest Stats - Individual
export function CombatChestsNormal({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="chests.normal" label="Normal Chests" color="text-gray-300" />;
}

export function CombatChestsCorrupt({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="chests.corrupt" label="Corrupt Chests" color="text-purple-400" />;
}

export function CombatChestsFree({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="chests.free" label="Free Chests" color="text-green-400" />;
}

// Shrine Stats - Individual
export function CombatShrineBalance({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="shrines.balance" label="Balance Shrines" color="text-blue-400" />;
}

export function CombatShrineGreed({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="shrines.greed" label="Greed Shrines" color="text-yellow-400" />;
}

export function CombatShrineChallenge({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="shrines.challenge" label="Challenge Shrines" color="text-red-400" />;
}

export function CombatShrineCursed({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="shrines.cursed" label="Cursed Shrines" color="text-purple-400" />;
}

export function CombatShrineMagnet({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="shrines.magnet" label="Magnet Shrines" color="text-cyan-400" />;
}

export function CombatShrineMoai({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="shrines.moai" label="Moai Shrines" color="text-stone-400" />;
}

export function CombatShrineChargeNormal({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="shrines.charge_normal" label="Charge Shrines" color="text-orange-400" />;
}

export function CombatShrineChargeGolden({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="shrines.charge_golden" label="Golden Charges" color="text-yellow-300" />;
}

// Game Stats - Individual
export function CombatGoldEarned({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="gameStats.gold_earned" label="Gold Earned" color="text-yellow-400" />;
}

export function CombatGoldSpent({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="gameStats.gold_spent" label="Gold Spent" color="text-yellow-500" />;
}

export function CombatSilverEarned({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="gameStats.silver_earned" label="Silver Earned" color="text-gray-300" />;
}

export function CombatXpGained({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="gameStats.xp_gained" label="XP Gained" color="text-purple-400" />;
}

export function CombatEliteKills({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="gameStats.elite_kills" label="Elite Kills" color="text-purple-400" />;
}

export function CombatBossKills({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="gameStats.boss_kills" label="Boss Kills" color="text-orange-400" />;
}

export function CombatMinibossKills({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="gameStats.miniboss_kills" label="Miniboss Kills" color="text-orange-300" />;
}

export function CombatFinalBossKills({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="gameStats.final_boss_kills" label="Final Boss Kills" color="text-red-500" />;
}

export function CombatCrits({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="gameStats.crits" label="Critical Hits" color="text-red-400" />;
}

export function CombatEvades({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="gameStats.evades" label="Evades" color="text-cyan-400" />;
}

export function CombatProjectilesFired({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="gameStats.projectiles_fired" label="Projectiles Fired" color="text-blue-400" />;
}

export function CombatLifestealHealing({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="gameStats.lifesteal_healing" label="Lifesteal Heals" color="text-red-300" />;
}

export function CombatItemsPickedUp({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="gameStats.items_picked_up" label="Items Picked" color="text-green-400" />;
}

export function CombatChestsOpened({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="gameStats.chests_opened" label="Chests Opened" color="text-amber-400" />;
}

export function CombatChestsBought({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="gameStats.chests_bought" label="Chests Bought" color="text-amber-500" />;
}

export function CombatPotsBroken({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="gameStats.pots_broken" label="Pots Broken" color="text-stone-400" />;
}

export function CombatPowerupsUsed({ playerId, layout }) {
  return <SingleCombatStatElement playerId={playerId} layout={layout} path="gameStats.powerups_used" label="Powerups Used" color="text-cyan-400" />;
}
