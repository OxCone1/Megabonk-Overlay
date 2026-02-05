import { memo } from 'react';
import { useOverlayStore } from '@/stores/overlayStore';
import { cn } from '@/lib/utils';
import { Heart, Shield, Swords, Footprints, Coins, Skull } from 'lucide-react';
import { useI18n } from '@/lib/i18n';
import { STAT_CONFIG } from '@/stores/smartInteractionsStore';

// Local UI overrides to force display unit for specific stats (matches reference art)
const STAT_OVERRIDES = {
  // Use 'multiplier' to display as 1.0x
  DamageMultiplier: { unit: 'multiplier' },
  CritDamage: { unit: 'multiplier' },
  SizeMultiplier: { unit: 'multiplier' },
  DurationMultiplier: { unit: 'multiplier' },
  ProjectileSpeedMultiplier: { unit: 'multiplier' },
  MoveSpeedMultiplier: { unit: 'multiplier' },
  XpIncreaseMultiplier: { unit: 'multiplier' },
  GoldIncreaseMultiplier: { unit: 'multiplier' },
  SilverIncreaseMultiplier: { unit: 'multiplier' },
  PowerupBoostMultiplier: { unit: 'multiplier' },

  // Use 'number' to display integer values
  JumpHeight: { unit: 'number' },
  PickupRange: { unit: 'number' },
};

const TitleRow = memo(function TitleRow({ hidden, children, className }) {
  return (
    <div className={cn('obs-preserve-space', className, hidden && 'opacity-0 pointer-events-none')}>
      {children}
    </div>
  );
});

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
  return (
    <div className="flex items-center gap-2 text-xs" style={{ justifyContent: resolveJustify(justify) }}>
      <div className="flex items-center gap-1 text-white/60">
        {icon}
        <span className="obs-hide-in-overlay">{label}</span>
      </div>
      <span className={cn("font-medium alagard-numeric drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]", color)}>{value}</span>
    </div>
  );
});

function formatStat(value, { statKey, type = 'plain', plainFormat = 'round', suffix = '' } = {}) {
  if (value === undefined || value === null) return '--';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '--';

  const statMeta = statKey ? STAT_CONFIG?.[statKey] : null;
  const baseUnit = statMeta?.unit;
  const override = statKey ? STAT_OVERRIDES?.[statKey] : null;
  const resolvedUnit = override?.unit ?? baseUnit;

  // Percent formatting
  if (resolvedUnit === 'percent' || type === 'percent') {
    return `${Math.round(numeric * 100)}%`;
  }

  // Multiplier formatting
  if (resolvedUnit === 'multiplier' || type === 'multiplier') {
    return `${numeric.toFixed(2)}x`;
  }

  // Plain number formatting
  const formatted = plainFormat === 'decimal'
    ? numeric.toFixed(2)
    : Math.floor(numeric).toString();
  return `${formatted}${suffix}`;
}

function isMissingStatValue(value) {
  if (value === undefined || value === null) return true;
  const numeric = Number(value);
  return !Number.isFinite(numeric);
}

export function HealthStatsElement({ playerId, layout }) {
  const { getPlayerState, hideElementTitles, statPlainFormat: _statPlainFormat } = useOverlayStore();
  const { t, tStat } = useI18n();
  const playerState = getPlayerState(playerId);
  const stats = playerState?.character?.stats;
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const showField = (key) => layout?.visibleFields?.[key] !== false;
  const justify = layout?.justify ?? 'start';
  
  if (!stats) {
    return <div className="p-2 text-xs text-white/40 italic obs-hide-shadow">{t('noData', 'No data')}</div>;
  }
  
  return (
    <div className="p-2 flex flex-col gap-1">
      <TitleRow
        hidden={hideTitle}
        className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1 mb-1 obs-hide-in-overlay"
      >
        <Heart size={12} /> {layout?.title || t('health', 'Health')}
      </TitleRow>
      {showField('maxHealth') && (
        <div className={cn(isMissingStatValue(stats.MaxHealth) && 'obs-hide-shadow')}>
          <StatRow label={tStat('MaxHealth', 'Max HP')} value={formatStat(stats.MaxHealth, { statKey: 'MaxHealth', plainFormat: _statPlainFormat })} color="text-red-400" justify={justify} />
        </div>
      )}
      {showField('regen') && (
        <div className={cn(isMissingStatValue(stats.HealthRegen) && 'obs-hide-shadow')}>
          <StatRow label={tStat('HealthRegen', 'Regen')} value={formatStat(stats.HealthRegen, { statKey: 'HealthRegen', plainFormat: _statPlainFormat })} color="text-green-400" justify={justify} />
        </div>
      )}
      {showField('shield') && (
        <div className={cn(isMissingStatValue(stats.Shield) && 'obs-hide-shadow')}>
          <StatRow label={tStat('Shield', 'Shield')} value={formatStat(stats.Shield, { statKey: 'Shield', plainFormat: _statPlainFormat })} color="text-blue-400" justify={justify} />
        </div>
      )}
      {showField('overheal') && (
        <div className={cn(isMissingStatValue(stats.Overheal) && 'obs-hide-shadow')}>
          <StatRow label={tStat('Overheal', 'Overheal')} value={formatStat(stats.Overheal, { statKey: 'Overheal', plainFormat: _statPlainFormat })} color="text-pink-400" justify={justify} />
        </div>
      )}
      {showField('healMulti') && (
        <div className={cn(isMissingStatValue(stats.HealingMultiplier) && 'obs-hide-shadow')}>
          <StatRow label={tStat('HealingMultiplier', 'Heal Multi')} value={formatStat(stats.HealingMultiplier, { statKey: 'HealingMultiplier', type: 'multiplier' })} justify={justify} />
        </div>
      )}
      {showField('lifesteal') && (
        <div className={cn(isMissingStatValue(stats.Lifesteal) && 'obs-hide-shadow')}>
          <StatRow label={tStat('Lifesteal', 'Lifesteal')} value={formatStat(stats.Lifesteal, { statKey: 'Lifesteal', type: 'percent' })} color="text-red-300" justify={justify} />
        </div>
      )}
    </div>
  );
}

export function DamageStatsElement({ playerId, layout }) {
  const { getPlayerState, hideElementTitles, statPlainFormat: _statPlainFormat } = useOverlayStore();
  const { t, tStat } = useI18n();
  const playerState = getPlayerState(playerId);
  const stats = playerState?.character?.stats;
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const showField = (key) => layout?.visibleFields?.[key] !== false;
  const justify = layout?.justify ?? 'start';
  
  if (!stats) {
    return <div className="p-2 text-xs text-white/40 italic obs-hide-shadow">{t('noData', 'No data')}</div>;
  }
  
  return (
    <div className="p-2 flex flex-col gap-1">
      <TitleRow
        hidden={hideTitle}
        className="text-xs font-semibold text-orange-400 uppercase tracking-wider flex items-center gap-1 mb-1 obs-hide-in-overlay"
      >
        <Swords size={12} /> {layout?.title || t('damage', 'Damage')}
      </TitleRow>
      {showField('damage') && (
        <div className={cn(isMissingStatValue(stats.DamageMultiplier) && 'obs-hide-shadow')}>
          <StatRow label={tStat('DamageMultiplier', 'Damage')} value={formatStat(stats.DamageMultiplier, { statKey: 'DamageMultiplier', type: 'multiplier' })} color="text-orange-400" justify={justify} />
        </div>
      )}
      {showField('attackSpeed') && (
        <div className={cn(isMissingStatValue(stats.AttackSpeed) && 'obs-hide-shadow')}>
          <StatRow label={tStat('AttackSpeed', 'Attack Speed')} value={formatStat(stats.AttackSpeed, { statKey: 'AttackSpeed', plainFormat: _statPlainFormat })} color="text-yellow-400" justify={justify} />
        </div>
      )}
      {showField('critChance') && (
        <div className={cn(isMissingStatValue(stats.CritChance) && 'obs-hide-shadow')}>
          <StatRow label={tStat('CritChance', 'Crit Chance')} value={formatStat(stats.CritChance, { statKey: 'CritChance', type: 'percent' })} color="text-red-400" justify={justify} />
        </div>
      )}
      {showField('critDamage') && (
        <div className={cn(isMissingStatValue(stats.CritDamage) && 'obs-hide-shadow')}>
          <StatRow label={tStat('CritDamage', 'Crit Damage')} value={formatStat(stats.CritDamage, { statKey: 'CritDamage', type: 'multiplier' })} color="text-red-300" justify={justify} />
        </div>
      )}
      {showField('projectiles') && (
        <div className={cn(isMissingStatValue(stats.Projectiles) && 'obs-hide-shadow')}>
          <StatRow label={tStat('Projectiles', 'Projectiles')} value={formatStat(stats.Projectiles, { statKey: 'Projectiles', plainFormat: _statPlainFormat })} color="text-blue-400" justify={justify} />
        </div>
      )}
      {showField('bounces') && (
        <div className={cn(isMissingStatValue(stats.ProjectileBounces) && 'obs-hide-shadow')}>
          <StatRow label={tStat('ProjectileBounces', 'Bounces')} value={formatStat(stats.ProjectileBounces, { statKey: 'ProjectileBounces', plainFormat: _statPlainFormat })} justify={justify} />
        </div>
      )}
      {showField('size') && (
        <div className={cn(isMissingStatValue(stats.SizeMultiplier) && 'obs-hide-shadow')}>
          <StatRow label={tStat('SizeMultiplier', 'Size')} value={formatStat(stats.SizeMultiplier, { statKey: 'SizeMultiplier', type: 'multiplier' })} color="text-purple-400" justify={justify} />
        </div>
      )}
    </div>
  );
}

export function DefenseStatsElement({ playerId, layout }) {
  const { getPlayerState, hideElementTitles, statPlainFormat: _statPlainFormat } = useOverlayStore();
  const { t, tStat } = useI18n();
  const playerState = getPlayerState(playerId);
  const stats = playerState?.character?.stats;
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const showField = (key) => layout?.visibleFields?.[key] !== false;
  const justify = layout?.justify ?? 'start';
  
  if (!stats) {
    return <div className="p-2 text-xs text-white/40 italic obs-hide-shadow">{t('noData', 'No data')}</div>;
  }
  
  return (
    <div className="p-2 flex flex-col gap-1">
      <TitleRow
        hidden={hideTitle}
        className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1 mb-1 obs-hide-in-overlay"
      >
        <Shield size={12} /> {layout?.title || t('defense', 'Defense')}
      </TitleRow>
      {showField('armor') && (
        <div className={cn(isMissingStatValue(stats.Armor) && 'obs-hide-shadow')}>
          <StatRow label={tStat('Armor', 'Armor')} value={formatStat(stats.Armor, { statKey: 'Armor', type: 'percent' })} color="text-gray-400" justify={justify} />
        </div>
      )}
      {showField('evasion') && (
        <div className={cn(isMissingStatValue(stats.Evasion) && 'obs-hide-shadow')}>
          <StatRow label={tStat('Evasion', 'Evasion')} value={formatStat(stats.Evasion, { statKey: 'Evasion', type: 'percent' })} color="text-cyan-400" justify={justify} />
        </div>
      )}
      {showField('thorns') && (
        <div className={cn(isMissingStatValue(stats.Thorns) && 'obs-hide-shadow')}>
          <StatRow label={tStat('Thorns', 'Thorns')} value={formatStat(stats.Thorns, { statKey: 'Thorns', plainFormat: _statPlainFormat })} color="text-green-400" justify={justify} />
        </div>
      )}
      {showField('damageReduction') && (
        <div className={cn(isMissingStatValue(stats.DamageReductionMultiplier) && 'obs-hide-shadow')}>
          <StatRow label={tStat('DamageReductionMultiplier', 'Dmg Reduction')} value={formatStat(stats.DamageReductionMultiplier, { statKey: 'DamageReductionMultiplier', type: 'percent' })} justify={justify} />
        </div>
      )}
      {showField('fallDamageReduction') && (
        <div className={cn(isMissingStatValue(stats.FallDamageReduction) && 'obs-hide-shadow')}>
          <StatRow label={tStat('FallDamageReduction', 'Fall Dmg Red')} value={formatStat(stats.FallDamageReduction, { statKey: 'FallDamageReduction', type: 'percent' })} justify={justify} />
        </div>
      )}
    </div>
  );
}

export function UtilityStatsElement({ playerId, layout }) {
  const { getPlayerState, hideElementTitles, statPlainFormat: _statPlainFormat } = useOverlayStore();
  const { t, tStat } = useI18n();
  const playerState = getPlayerState(playerId);
  const stats = playerState?.character?.stats;
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const showField = (key) => layout?.visibleFields?.[key] !== false;
  const justify = layout?.justify ?? 'start';
  
  if (!stats) {
    return <div className="p-2 text-xs text-white/40 italic obs-hide-shadow">{t('noData', 'No data')}</div>;
  }
  
  return (
    <div className="p-2 flex flex-col gap-1">
      <TitleRow
        hidden={hideTitle}
        className="text-xs font-semibold text-cyan-400 uppercase tracking-wider flex items-center gap-1 mb-1 obs-hide-in-overlay"
      >
        <Footprints size={12} /> {layout?.title || t('utility', 'Utility')}
      </TitleRow>
      {showField('moveSpeed') && (
        <div className={cn(isMissingStatValue(stats.MoveSpeedMultiplier) && 'obs-hide-shadow')}>
          <StatRow label={tStat('MoveSpeedMultiplier', 'Move Speed')} value={formatStat(stats.MoveSpeedMultiplier, { statKey: 'MoveSpeedMultiplier', type: 'multiplier' })} color="text-cyan-400" justify={justify} />
        </div>
      )}
      {showField('jumpHeight') && (
        <div className={cn(isMissingStatValue(stats.JumpHeight) && 'obs-hide-shadow')}>
          <StatRow label={tStat('JumpHeight', 'Jump Height')} value={formatStat(stats.JumpHeight, { statKey: 'JumpHeight', plainFormat: _statPlainFormat })} justify={justify} />
        </div>
      )}
      {showField('extraJumps') && (
        <div className={cn(isMissingStatValue(stats.ExtraJumps) && 'obs-hide-shadow')}>
          <StatRow label={tStat('ExtraJumps', 'Extra Jumps')} value={formatStat(stats.ExtraJumps, { statKey: 'ExtraJumps', plainFormat: _statPlainFormat })} justify={justify} />
        </div>
      )}
      {showField('pickupRange') && (
        <div className={cn(isMissingStatValue(stats.PickupRange) && 'obs-hide-shadow')}>
          <StatRow label={tStat('PickupRange', 'Pickup Range')} value={formatStat(stats.PickupRange, { statKey: 'PickupRange', plainFormat: _statPlainFormat })} color="text-green-400" justify={justify} />
        </div>
      )}
      {showField('duration') && (
        <div className={cn(isMissingStatValue(stats.DurationMultiplier) && 'obs-hide-shadow')}>
          <StatRow label={tStat('DurationMultiplier', 'Duration')} value={formatStat(stats.DurationMultiplier, { statKey: 'DurationMultiplier', type: 'multiplier' })} justify={justify} />
        </div>
      )}
      {showField('projSpeed') && (
        <div className={cn(isMissingStatValue(stats.ProjectileSpeedMultiplier) && 'obs-hide-shadow')}>
          <StatRow label={tStat('ProjectileSpeedMultiplier', 'Proj Speed')} value={formatStat(stats.ProjectileSpeedMultiplier, { statKey: 'ProjectileSpeedMultiplier', type: 'multiplier' })} justify={justify} />
        </div>
      )}
    </div>
  );
}

export function EconomyStatsElement({ playerId, layout }) {
  const { getPlayerState, hideElementTitles, statPlainFormat: _statPlainFormat } = useOverlayStore();
  const { t, tStat } = useI18n();
  const playerState = getPlayerState(playerId);
  const stats = playerState?.character?.stats;
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const showField = (key) => layout?.visibleFields?.[key] !== false;
  const justify = layout?.justify ?? 'start';
  
  if (!stats) {
    return <div className="p-2 text-xs text-white/40 italic obs-hide-shadow">{t('noData', 'No data')}</div>;
  }
  
  return (
    <div className="p-2 flex flex-col gap-1">
      <TitleRow
        hidden={hideTitle}
        className="text-xs font-semibold text-yellow-400 uppercase tracking-wider flex items-center gap-1 mb-1 obs-hide-in-overlay"
      >
        <Coins size={12} /> {layout?.title || t('economy', 'Economy')}
      </TitleRow>
      {showField('goldMulti') && (
        <div className={cn(isMissingStatValue(stats.GoldIncreaseMultiplier) && 'obs-hide-shadow')}>
          <StatRow label={tStat('GoldIncreaseMultiplier', 'Gold Multi')} value={formatStat(stats.GoldIncreaseMultiplier, { statKey: 'GoldIncreaseMultiplier', type: 'multiplier' })} color="text-yellow-400" justify={justify} />
        </div>
      )}
      {showField('xpMulti') && (
        <div className={cn(isMissingStatValue(stats.XpIncreaseMultiplier) && 'obs-hide-shadow')}>
          <StatRow label={tStat('XpIncreaseMultiplier', 'XP Multi')} value={formatStat(stats.XpIncreaseMultiplier, { statKey: 'XpIncreaseMultiplier', type: 'multiplier' })} color="text-purple-400" justify={justify} />
        </div>
      )}
      {showField('silverMulti') && (
        <div className={cn(isMissingStatValue(stats.SilverIncreaseMultiplier) && 'obs-hide-shadow')}>
          <StatRow label={tStat('SilverIncreaseMultiplier', 'Silver Multi')} value={formatStat(stats.SilverIncreaseMultiplier, { statKey: 'SilverIncreaseMultiplier', type: 'multiplier' })} color="text-gray-300" justify={justify} />
        </div>
      )}
      {showField('luck') && (
        <div className={cn(isMissingStatValue(stats.Luck) && 'obs-hide-shadow')}>
          <StatRow label={tStat('Luck', 'Luck')} value={formatStat(stats.Luck, { statKey: 'Luck', type: 'percent' })} color="text-green-400" justify={justify} />
        </div>
      )}
      {showField('chestMulti') && (
        <div className={cn(isMissingStatValue(stats.ChestIncreaseMultiplier) && 'obs-hide-shadow')}>
          <StatRow label={tStat('ChestIncreaseMultiplier', 'Chest Multi')} value={formatStat(stats.ChestIncreaseMultiplier, { statKey: 'ChestIncreaseMultiplier', type: 'multiplier' })} justify={justify} />
        </div>
      )}
      {showField('shopDiscount') && (
        <div className={cn(isMissingStatValue(stats.ShopPriceReduction) && 'obs-hide-shadow')}>
          <StatRow label={tStat('ShopPriceReduction', 'Shop Discount')} value={formatStat(stats.ShopPriceReduction, { statKey: 'ShopPriceReduction', type: 'percent' })} color="text-cyan-400" justify={justify} />
        </div>
      )}
    </div>
  );
}

export function EnemyStatsElement({ playerId, layout }) {
  const { getPlayerState, hideElementTitles, statPlainFormat: _statPlainFormat } = useOverlayStore();
  const { t, tStat } = useI18n();
  const playerState = getPlayerState(playerId);
  const stats = playerState?.character?.stats;
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const showField = (key) => layout?.visibleFields?.[key] !== false;
  const justify = layout?.justify ?? 'start';
  
  if (!stats) {
    return <div className="p-2 text-xs text-white/40 italic obs-hide-shadow">{t('noData', 'No data')}</div>;
  }
  
  return (
    <div className="p-2 flex flex-col gap-1">
      <TitleRow
        hidden={hideTitle}
        className="text-xs font-semibold text-red-500 uppercase tracking-wider flex items-center gap-1 mb-1 obs-hide-in-overlay"
      >
        <Skull size={12} /> {layout?.title || t('enemyMods', 'Enemy Mods')}
      </TitleRow>
      {showField('difficulty') && (
        <div className={cn(isMissingStatValue(stats.Difficulty) && 'obs-hide-shadow')}>
          <StatRow label={tStat('Difficulty', 'Difficulty')} value={formatStat(stats.Difficulty, { statKey: 'Difficulty', plainFormat: _statPlainFormat })} color="text-red-400" justify={justify} />
        </div>
      )}
      {showField('eliteSpawn') && (
        <div className={cn(isMissingStatValue(stats.EliteSpawnIncrease) && 'obs-hide-shadow')}>
          <StatRow label={tStat('EliteSpawnIncrease', 'Elite Spawn')} value={formatStat(stats.EliteSpawnIncrease, { statKey: 'EliteSpawnIncrease', type: 'multiplier' })} color="text-purple-400" justify={justify} />
        </div>
      )}
      {showField('amount') && (
        <div className={cn(isMissingStatValue(stats.EnemyAmountMultiplier) && 'obs-hide-shadow')}>
          <StatRow label={tStat('EnemyAmountMultiplier', 'Amount')} value={formatStat(stats.EnemyAmountMultiplier, { statKey: 'EnemyAmountMultiplier', type: 'multiplier' })} justify={justify} />
        </div>
      )}
      {showField('size') && (
        <div className={cn(isMissingStatValue(stats.EnemySizeMultiplier) && 'obs-hide-shadow')}>
          <StatRow label={tStat('EnemySizeMultiplier', 'Size')} value={formatStat(stats.EnemySizeMultiplier, { statKey: 'EnemySizeMultiplier', type: 'multiplier' })} justify={justify} />
        </div>
      )}
      {showField('speed') && (
        <div className={cn(isMissingStatValue(stats.EnemySpeedMultiplier) && 'obs-hide-shadow')}>
          <StatRow label={tStat('EnemySpeedMultiplier', 'Speed')} value={formatStat(stats.EnemySpeedMultiplier, { statKey: 'EnemySpeedMultiplier', type: 'multiplier' })} justify={justify} />
        </div>
      )}
      {showField('hp') && (
        <div className={cn(isMissingStatValue(stats.EnemyHpMultiplier) && 'obs-hide-shadow')}>
          <StatRow label={tStat('EnemyHpMultiplier', 'HP')} value={formatStat(stats.EnemyHpMultiplier, { statKey: 'EnemyHpMultiplier', type: 'multiplier' })} justify={justify} />
        </div>
      )}
      {showField('damage') && (
        <div className={cn(isMissingStatValue(stats.EnemyDamageMultiplier) && 'obs-hide-shadow')}>
          <StatRow label={tStat('EnemyDamageMultiplier', 'Damage')} value={formatStat(stats.EnemyDamageMultiplier, { statKey: 'EnemyDamageMultiplier', type: 'multiplier' })} justify={justify} />
        </div>
      )}
    </div>
  );
}

// ============================================================
// INDIVIDUAL STAT ELEMENTS
// ============================================================

// Memoized SingleStatElement to prevent unnecessary re-renders
const SingleStatElement = memo(function SingleStatElement({ playerId, statKey, label, color = 'text-white', format = 'plain', suffix = '', layout }) {
  const { getPlayerState, statPlainFormat: _statPlainFormat } = useOverlayStore();
  const { tStat } = useI18n();
  const playerState = getPlayerState(playerId);
  const stats = playerState?.character?.stats;
  const justify = layout?.justify ?? 'start';
  const hideLabel = !!layout?.hideLabel;
  const labelOverride = layout?.labelOverride;
  
  const value = stats?.[statKey];
  const isMissing = isMissingStatValue(value);
  const formatted = formatStat(value, { statKey, type: format, plainFormat: _statPlainFormat, suffix });
  
  return (
    <div className={cn("p-2 flex items-center gap-2", isMissing && 'obs-hide-shadow')} style={{ justifyContent: resolveJustify(justify) }}>
      <span className={cn('text-s text-white/75 drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]', hideLabel && 'opacity-0 pointer-events-none')}>
        {labelOverride ? labelOverride : tStat(statKey, label)}
      </span>
      <span className={cn("text-sm alagard-numeric drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]", color)}>{formatted}</span>
    </div>
  );
});

// Health Stats - Individual

export function StatMaxHealth({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="MaxHealth" label="Max HP" color="text-white-400" />;
}

export function StatHealthRegen({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="HealthRegen" label="HP Regen" color="text-white-400" />;
}

export function StatShield({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="Shield" label="Shield" color="text-white-400" />;
}

export function StatOverheal({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="Overheal" label="Overheal" color="text-white-400" />;
}

export function StatHealingMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="HealingMultiplier" label="Heal Multi" format="multiplier" />;
}

export function StatLifesteal({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="Lifesteal" label="Lifesteal" color="text-white-400" format="percent" />;
}

// Damage Stats - Individual
export function StatDamageMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="DamageMultiplier" label="Damage" color="text-white-400" format="multiplier" />;
}

export function StatAttackSpeed({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="AttackSpeed" label="Attack Speed" color="text-white-400" />;
}

export function StatCritChance({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="CritChance" label="Crit Chance" color="text-white-400" format="percent" />;
}

export function StatCritDamage({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="CritDamage" label="Crit Damage" color="text-white-400" format="multiplier" />;
}

export function StatProjectiles({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="Projectiles" label="Projectiles" color="text-white-400" />;
}

export function StatProjectileBounces({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="ProjectileBounces" label="Bounces" color="text-white-400" />;
}

export function StatProjectileSpeedMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="ProjectileSpeedMultiplier" label="Proj Speed" color="text-white-400" format="multiplier" />;
}

// Defense Stats - Individual
export function StatArmor({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="Armor" label="Armor" color="text-white-400" format="percent" />;
}

export function StatEvasion({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="Evasion" label="Evasion" color="text-white-400" format="percent" />;
}

export function StatThorns({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="Thorns" label="Thorns" color="text-white-400" />;
}

export function StatDamageReductionMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="DamageReductionMultiplier" label="Dmg Reduction" color="text-white-400" format="percent" />;
}

// Elemental Stats - Individual
export function StatFireDamage({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="FireDamage" label="Fire Damage" color="text-white-400" format="multiplier" />;
}

export function StatIceDamage({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="IceDamage" label="Ice Damage" color="text-white-400" format="multiplier" />;
}

export function StatLightningDamage({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="LightningDamage" label="Lightning Dmg" color="text-white-400" format="multiplier" />;
}

export function StatBurnChance({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="BurnChance" label="Burn Chance" color="text-white-400" format="percent" />;
}

export function StatFreezeChance({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="FreezeChance" label="Freeze Chance" color="text-white-400" format="percent" />;
}

// Utility Stats - Individual
export function StatMoveSpeedMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="MoveSpeedMultiplier" label="Move Speed" color="text-white-400" format="multiplier" />;
}

export function StatJumpHeight({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="JumpHeight" label="Jump Height" />;
}

export function StatExtraJumps({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="ExtraJumps" label="Extra Jumps" />;
}

export function StatPickupRange({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="PickupRange" label="Pickup Range" color="text-white-400" />;
}

export function StatSizeMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="SizeMultiplier" label="Size" color="text-white-400" format="multiplier" />;
}

export function StatDurationMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="DurationMultiplier" label="Duration" format="multiplier" />;
}

export function StatKnockbackMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="KnockbackMultiplier" label="Knockback" format="multiplier" />;
}

// Economy Stats - Individual
export function StatLuck({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="Luck" label="Luck" color="text-white-400" format="percent" />;
}

export function StatGoldIncreaseMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="GoldIncreaseMultiplier" label="Gold Multi" color="text-white-400" format="multiplier" />;
}

export function StatXpIncreaseMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="XpIncreaseMultiplier" label="XP Multi" color="text-white-400" format="multiplier" />;
}

export function StatSilverIncreaseMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="SilverIncreaseMultiplier" label="Silver Multi" color="text-white-400" format="multiplier" />;
}

export function StatChestIncreaseMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="ChestIncreaseMultiplier" label="Chest Multi" color="text-white-400" format="multiplier" />;
}

export function StatChestPriceMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="ChestPriceMultiplier" label="Chest Price" color="text-white-400" format="multiplier" />;
}

export function StatShopPriceReduction({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="ShopPriceReduction" label="Shop Discount" color="text-white-400" format="percent" />;
}

export function StatPowerupBoostMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="PowerupBoostMultiplier" label="Powerup Boost" color="text-white-400" format="multiplier" />;
}

export function StatPowerupChance({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="PowerupChance" label="Powerup Chance" color="text-white-400" format="percent" />;
}

// Enemy Stats - Individual
export function StatDifficulty({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="Difficulty" label="Difficulty" color="text-[#E62E00]" />;
}

export function StatDifficultyIcon({ playerId, layout }) {
  const { getPlayerState, statPlainFormat: _statPlainFormat } = useOverlayStore();
  const playerState = getPlayerState(playerId);
  const stats = playerState?.character?.stats;
  const justify = layout?.justify ?? 'start';
  const hideLabel = !!layout?.hideLabel;

  const value = stats?.Difficulty;
  const isMissing = isMissingStatValue(value);
  const formatted = formatStat(value, { statKey: 'Difficulty', plainFormat: _statPlainFormat });

  return (
    <div className={cn("p-2 flex items-center gap-1", isMissing && 'obs-hide-shadow')} style={{ justifyContent: resolveJustify(justify) }}>
      <span className={cn('text-white/60', hideLabel && 'opacity-0 pointer-events-none')}>
        <Skull size={16} color='#CC2900'/>
      </span>
      <span className={cn("text-sm alagard-numeric drop-shadow-[1px_1px_0px_rgba(0,0,0,1)]", "text-[#E62E00]")}>{formatted}</span>
    </div>
  );
}

export function StatEliteSpawnIncrease({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="EliteSpawnIncrease" label="Elite Spawn" color="text-white-400" format="multiplier" />;
}

export function StatEnemyAmountMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="EnemyAmountMultiplier" label="Enemy Amount" color="text-white-400" format="multiplier" />;
}

export function StatEnemySizeMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="EnemySizeMultiplier" label="Enemy Size" color="text-white-400" format="multiplier" />;
}

export function StatEnemySpeedMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="EnemySpeedMultiplier" label="Enemy Speed" color="text-white-400" format="multiplier" />;
}

export function StatEnemyHpMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="EnemyHpMultiplier" label="Enemy HP" color="text-white-400" format="multiplier" />;
}

export function StatEnemyDamageMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="EnemyDamageMultiplier" label="Enemy Damage" color="text-white-400" format="multiplier" />;
}

export function StatEnemyScalingMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="EnemyScalingMultiplier" label="Enemy Scaling" color="text-white-400" format="multiplier" />;
}

export function StatEliteDamageMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="EliteDamageMultiplier" label="Elite Damage" color="text-white-400" format="multiplier" />;
}

// Special Stats - Individual
export function StatHoliness({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="Holiness" label="Holiness" color="text-white-400" />;
}

export function StatWickedness({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="Wickedness" label="Wickedness" color="text-white-400" />;
}

export function StatEvolve({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="Evolve" label="Evolve" color="text-white-400" />;
}

export function StatWeaponBurstCooldown({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="WeaponBurstCooldown" label="Burst CD" suffix="s" />;
}

export function StatDamageCooldownMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="DamageCooldownMultiplier" label="Dmg CD Multi" format="multiplier" />;
}

export function StatEffectDurationMultiplier({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="EffectDurationMultiplier" label="Effect Dur" format="multiplier" />;
}

export function StatFallDamageReduction({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="FallDamageReduction" label="Fall Dmg Red" format="percent" />;
}

export function StatSlam({ playerId, layout }) {
  return <SingleStatElement playerId={playerId} layout={layout} statKey="Slam" label="Slam" color="text-white-400" />;
}
