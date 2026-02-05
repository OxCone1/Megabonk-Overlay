import { memo } from 'react';
import { OverlayElementWrapper } from './OverlayElementWrapper';
import { ItemGroupElement, RarityGroupElement } from '@/components/elements/ItemElements';
import { WeaponElement, TomeElement, HeroElement, BonkClassicElement } from '@/components/elements/EquipmentElements';
import { 
  HealthStatsElement, 
  DamageStatsElement, 
  DefenseStatsElement,
  UtilityStatsElement,
  EconomyStatsElement,
  EnemyStatsElement,
  // Individual Stats
  StatMaxHealth,
  StatHealthRegen,
  StatShield,
  StatOverheal,
  StatHealingMultiplier,
  StatLifesteal,
  StatDamageMultiplier,
  StatAttackSpeed,
  StatCritChance,
  StatCritDamage,
  StatProjectiles,
  StatProjectileBounces,
  StatProjectileSpeedMultiplier,
  StatArmor,
  StatEvasion,
  StatThorns,
  StatDamageReductionMultiplier,
  StatFireDamage,
  StatIceDamage,
  StatLightningDamage,
  StatBurnChance,
  StatFreezeChance,
  StatMoveSpeedMultiplier,
  StatJumpHeight,
  StatExtraJumps,
  StatPickupRange,
  StatSizeMultiplier,
  StatDurationMultiplier,
  StatKnockbackMultiplier,
  StatLuck,
  StatGoldIncreaseMultiplier,
  StatXpIncreaseMultiplier,
  StatSilverIncreaseMultiplier,
  StatChestIncreaseMultiplier,
  StatChestPriceMultiplier,
  StatShopPriceReduction,
  StatPowerupBoostMultiplier,
  StatPowerupChance,
  StatDifficulty,
  StatDifficultyIcon,
  StatEliteSpawnIncrease,
  StatEnemyAmountMultiplier,
  StatEnemySizeMultiplier,
  StatEnemySpeedMultiplier,
  StatEnemyHpMultiplier,
  StatEnemyDamageMultiplier,
  StatEnemyScalingMultiplier,
  StatEliteDamageMultiplier,
  StatHoliness,
  StatWickedness,
  StatEvolve,
  StatWeaponBurstCooldown,
  StatDamageCooldownMultiplier,
  StatEffectDurationMultiplier,
  StatFallDamageReduction,
  StatSlam
} from '@/components/elements/StatsElements';
import {
  CombatStatsElement,
  ShrineStatsElement,
  GameStatsElement,
  DamageSourcesElement,
  SingleCombatStatElement,
  // Individual Combat Stats
  CombatKillCount,
  CombatKillTick,
  CombatCurrentGold,
  CombatTotalDamageDealt,
  CombatTotalDamageTaken,
  CombatChestsNormal,
  CombatChestsCorrupt,
  CombatChestsFree,
  CombatShrineBalance,
  CombatShrineGreed,
  CombatShrineChallenge,
  CombatShrineCursed,
  CombatShrineMagnet,
  CombatShrineMoai,
  CombatShrineChargeNormal,
  CombatShrineChargeGolden,
  CombatGoldEarned,
  CombatGoldSpent,
  CombatSilverEarned,
  CombatXpGained,
  CombatEliteKills,
  CombatBossKills,
  CombatMinibossKills,
  CombatFinalBossKills,
  CombatCrits,
  CombatEvades,
  CombatProjectilesFired,
  CombatLifestealHealing,
  CombatItemsPickedUp,
  CombatChestsOpened,
  CombatChestsBought,
  CombatPotsBroken,
  CombatPowerupsUsed
} from '@/components/elements/CombatElements';
import { GameTimeElement, GameLevelElement, PauseLimitElement, PauseRemainingElement } from '@/components/elements/GameTimeElement';
import { StageStateElement, StageHistoryElement } from '@/components/elements/StageTrackingElements';
import { SystemBansElement, Player1BansElement, Player2BansElement } from '@/components/elements/BansElements';
import { MatchFlowElement, MatchSearchElement, MatchBanSelectionElement, MatchBanAnimationElement, MatchOpponentWaitElement, MatchmakingSmartElement, MatchEndElement } from '@/components/elements/MatchElements';
import { ShapeRectElement } from '@/components/elements/ShapeElements';
import { 
  SeasonInfoElement,
  SeasonNameElement,
  SeasonTimeLimitElement,
  SeasonPauseLimitElement,
  SeasonStartDateElement,
  SeasonEndDateElement,
} from '@/components/elements/SeasonElements';
import { SmartInteractionsElement } from '@/components/elements/SmartInteractionsElement';
import { SessionSummaryElement, SessionCurrentElement, SessionRatingElement, SessionRankElement, SessionGamesElement } from '@/components/elements/SessionStatsElements';
import { TimeDiffElement, DifficultyDiffElement, KillDiffElement } from '@/components/elements/DiffElements';

function getElementContent(element) {
  const playerId = element.playerId;
  
  switch (element.type) {
    // Equipment
      case 'hero':
        return <HeroElement playerId={playerId} layout={element.layout} />;
      case 'weapons':
        return <WeaponElement playerId={playerId} layout={element.layout} />;
      case 'tomes':
        return <TomeElement playerId={playerId} layout={element.layout} />;
      case 'bonk-classic':
        return <BonkClassicElement playerId={playerId} layout={element.layout} />;
    
    // Items
      case 'item-group':
        return <ItemGroupElement playerId={playerId} layout={element.layout} />;
      case 'rarity-group-common':
        return <RarityGroupElement playerId={playerId} rarity={0} layout={element.layout} />;
      case 'rarity-group-rare':
        return <RarityGroupElement playerId={playerId} rarity={1} layout={element.layout} />;
      case 'rarity-group-epic':
        return <RarityGroupElement playerId={playerId} rarity={2} layout={element.layout} />;
      case 'rarity-group-legendary':
        return <RarityGroupElement playerId={playerId} rarity={3} layout={element.layout} />;
    
    // Stats
    case 'stats-health':
      return <HealthStatsElement playerId={playerId} layout={element.layout} />;
    case 'stats-damage':
      return <DamageStatsElement playerId={playerId} layout={element.layout} />;
    case 'stats-defense':
      return <DefenseStatsElement playerId={playerId} layout={element.layout} />;
    case 'stats-utility':
      return <UtilityStatsElement playerId={playerId} layout={element.layout} />;
    case 'stats-economy':
      return <EconomyStatsElement playerId={playerId} layout={element.layout} />;
    case 'stats-enemy':
      return <EnemyStatsElement playerId={playerId} layout={element.layout} />;
    
    // Individual Character Stats
    case 'stat-maxhealth':
      return <StatMaxHealth playerId={playerId} layout={element.layout} />;
    case 'stat-healthregen':
      return <StatHealthRegen playerId={playerId} layout={element.layout} />;
    case 'stat-shield':
      return <StatShield playerId={playerId} layout={element.layout} />;
    case 'stat-overheal':
      return <StatOverheal playerId={playerId} layout={element.layout} />;
    case 'stat-healingmultiplier':
      return <StatHealingMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-lifesteal':
      return <StatLifesteal playerId={playerId} layout={element.layout} />;
    case 'stat-damagemultiplier':
      return <StatDamageMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-attackspeed':
      return <StatAttackSpeed playerId={playerId} layout={element.layout} />;
    case 'stat-critchance':
      return <StatCritChance playerId={playerId} layout={element.layout} />;
    case 'stat-critdamage':
      return <StatCritDamage playerId={playerId} layout={element.layout} />;
    case 'stat-projectiles':
      return <StatProjectiles playerId={playerId} layout={element.layout} />;
    case 'stat-projectilebounces':
      return <StatProjectileBounces playerId={playerId} layout={element.layout} />;
    case 'stat-projectilespeedmultiplier':
      return <StatProjectileSpeedMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-armor':
      return <StatArmor playerId={playerId} layout={element.layout} />;
    case 'stat-evasion':
      return <StatEvasion playerId={playerId} layout={element.layout} />;
    case 'stat-thorns':
      return <StatThorns playerId={playerId} layout={element.layout} />;
    case 'stat-damagereductionmultiplier':
      return <StatDamageReductionMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-firedamage':
      return <StatFireDamage playerId={playerId} layout={element.layout} />;
    case 'stat-icedamage':
      return <StatIceDamage playerId={playerId} layout={element.layout} />;
    case 'stat-lightningdamage':
      return <StatLightningDamage playerId={playerId} layout={element.layout} />;
    case 'stat-burnchance':
      return <StatBurnChance playerId={playerId} layout={element.layout} />;
    case 'stat-freezechance':
      return <StatFreezeChance playerId={playerId} layout={element.layout} />;
    case 'stat-movespeedmultiplier':
      return <StatMoveSpeedMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-jumpheight':
      return <StatJumpHeight playerId={playerId} layout={element.layout} />;
    case 'stat-extrajumps':
      return <StatExtraJumps playerId={playerId} layout={element.layout} />;
    case 'stat-pickuprange':
      return <StatPickupRange playerId={playerId} layout={element.layout} />;
    case 'stat-sizemultiplier':
      return <StatSizeMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-durationmultiplier':
      return <StatDurationMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-knockbackmultiplier':
      return <StatKnockbackMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-luck':
      return <StatLuck playerId={playerId} layout={element.layout} />;
    case 'stat-goldincreasemultiplier':
      return <StatGoldIncreaseMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-xpincreasemultiplier':
      return <StatXpIncreaseMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-silverincreasemultiplier':
      return <StatSilverIncreaseMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-chestincreasemultiplier':
      return <StatChestIncreaseMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-chestpricemultiplier':
      return <StatChestPriceMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-shoppricereduction':
      return <StatShopPriceReduction playerId={playerId} layout={element.layout} />;
    case 'stat-powerupboostmultiplier':
      return <StatPowerupBoostMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-powerupchance':
      return <StatPowerupChance playerId={playerId} layout={element.layout} />;
    case 'stat-difficulty':
      return <StatDifficulty playerId={playerId} layout={element.layout} />;
    case 'stat-difficulty-icon':
      return <StatDifficultyIcon playerId={playerId} layout={element.layout} />;
    case 'stat-elitespawnincrease':
      return <StatEliteSpawnIncrease playerId={playerId} layout={element.layout} />;
    case 'stat-enemyamountmultiplier':
      return <StatEnemyAmountMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-enemysizemultiplier':
      return <StatEnemySizeMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-enemyspeedmultiplier':
      return <StatEnemySpeedMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-enemyhpmultiplier':
      return <StatEnemyHpMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-enemydamagemultiplier':
      return <StatEnemyDamageMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-enemyscalingmultiplier':
      return <StatEnemyScalingMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-elitedamagemultiplier':
      return <StatEliteDamageMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-holiness':
      return <StatHoliness playerId={playerId} layout={element.layout} />;
    case 'stat-wickedness':
      return <StatWickedness playerId={playerId} layout={element.layout} />;
    case 'stat-evolve':
      return <StatEvolve playerId={playerId} layout={element.layout} />;
    case 'stat-weaponburstcooldown':
      return <StatWeaponBurstCooldown playerId={playerId} layout={element.layout} />;
    case 'stat-damagecooldownmultiplier':
      return <StatDamageCooldownMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-effectdurationmultiplier':
      return <StatEffectDurationMultiplier playerId={playerId} layout={element.layout} />;
    case 'stat-falldamagereduction':
      return <StatFallDamageReduction playerId={playerId} layout={element.layout} />;
    case 'stat-slam':
      return <StatSlam playerId={playerId} layout={element.layout} />;
    
    // Combat - Combined Groups
    case 'combat-stats':
      return <CombatStatsElement playerId={playerId} layout={element.layout} />;
    case 'shrine-stats':
      return <ShrineStatsElement playerId={playerId} layout={element.layout} />;
    case 'game-stats':
      return <GameStatsElement playerId={playerId} layout={element.layout} />;
    case 'damage-sources':
      return <DamageSourcesElement playerId={playerId} layout={element.layout} />;
    case 'singlecombatstatelement':
      return <SingleCombatStatElement playerId={playerId} layout={element.layout} path={element.layout?.path} label={element.layout?.label} color={element.layout?.color} fontSize={element.layout?.fontSize} formatter={element.layout?.formatter} icon={element.layout?.icon} />;
    case 'SingleCombatStatElement':
      return <SingleCombatStatElement playerId={playerId} layout={element.layout} path={element.layout?.path} label={element.layout?.label} color={element.layout?.color} fontSize={element.layout?.fontSize} formatter={element.layout?.formatter} icon={element.layout?.icon} />;
    
    // Individual Combat Stats
    case 'combat-killcount':
      return <CombatKillCount playerId={playerId} layout={element.layout} />;
    case 'combat-killtick':
      return <CombatKillTick playerId={playerId} layout={element.layout} />;
    case 'combat-currentgold':
      return <CombatCurrentGold playerId={playerId} layout={element.layout} />;
    case 'combat-totaldamagedealt':
      return <CombatTotalDamageDealt playerId={playerId} layout={element.layout} />;
    case 'combat-totaldamagetaken':
      return <CombatTotalDamageTaken playerId={playerId} layout={element.layout} />;
    
    // Individual Chest Stats
    case 'combat-chestsnormal':
      return <CombatChestsNormal playerId={playerId} layout={element.layout} />;
    case 'combat-chestscorrupt':
      return <CombatChestsCorrupt playerId={playerId} layout={element.layout} />;
    case 'combat-chestsfree':
      return <CombatChestsFree playerId={playerId} layout={element.layout} />;
    
    // Individual Shrine Stats
    case 'combat-shrinebalance':
      return <CombatShrineBalance playerId={playerId} layout={element.layout} />;
    case 'combat-shrinegreed':
      return <CombatShrineGreed playerId={playerId} layout={element.layout} />;
    case 'combat-shrinechallenge':
      return <CombatShrineChallenge playerId={playerId} layout={element.layout} />;
    case 'combat-shrinecursed':
      return <CombatShrineCursed playerId={playerId} layout={element.layout} />;
    case 'combat-shrinemagnet':
      return <CombatShrineMagnet playerId={playerId} layout={element.layout} />;
    case 'combat-shrinemoai':
      return <CombatShrineMoai playerId={playerId} layout={element.layout} />;
    case 'combat-shrinechargenormal':
      return <CombatShrineChargeNormal playerId={playerId} layout={element.layout} />;
    case 'combat-shrinechargegolden':
      return <CombatShrineChargeGolden playerId={playerId} layout={element.layout} />;
    
    // Individual Game Stats
    case 'combat-goldearned':
      return <CombatGoldEarned playerId={playerId} layout={element.layout} />;
    case 'combat-goldspent':
      return <CombatGoldSpent playerId={playerId} layout={element.layout} />;
    case 'combat-silverearned':
      return <CombatSilverEarned playerId={playerId} layout={element.layout} />;
    case 'combat-xpgained':
      return <CombatXpGained playerId={playerId} layout={element.layout} />;
    case 'combat-elitekills':
      return <CombatEliteKills playerId={playerId} layout={element.layout} />;
    case 'combat-bosskills':
      return <CombatBossKills playerId={playerId} layout={element.layout} />;
    case 'combat-minibosskills':
      return <CombatMinibossKills playerId={playerId} layout={element.layout} />;
    case 'combat-finalbosskills':
      return <CombatFinalBossKills playerId={playerId} layout={element.layout} />;
    case 'combat-crits':
      return <CombatCrits playerId={playerId} layout={element.layout} />;
    case 'combat-evades':
      return <CombatEvades playerId={playerId} layout={element.layout} />;
    case 'combat-projectilesfired':
      return <CombatProjectilesFired playerId={playerId} layout={element.layout} />;
    case 'combat-lifestealhealing':
      return <CombatLifestealHealing playerId={playerId} layout={element.layout} />;
    case 'combat-itemspickedup':
      return <CombatItemsPickedUp playerId={playerId} layout={element.layout} />;
    case 'combat-chestsopened':
      return <CombatChestsOpened playerId={playerId} layout={element.layout} />;
    case 'combat-chestsbought':
      return <CombatChestsBought playerId={playerId} layout={element.layout} />;
    case 'combat-potsbroken':
      return <CombatPotsBroken playerId={playerId} layout={element.layout} />;
    case 'combat-powerupsused':
      return <CombatPowerupsUsed playerId={playerId} layout={element.layout} />;
    
    // Game Info
    case 'game-time':
      return <GameTimeElement playerId={playerId} />;
    case 'game-level':
      return <GameLevelElement playerId={playerId} />;
    case 'pause-limit':
      return <PauseLimitElement />;
    case 'pause-remaining':
      return <PauseRemainingElement playerId={playerId} />;
    case 'stage-state':
      return <StageStateElement playerId={playerId} layout={element.layout} />;
    case 'stage-history':
      return <StageHistoryElement playerId={playerId} layout={element.layout} />;
    case 'bans-system':
      return <SystemBansElement layout={element.layout} />;
    case 'bans-player1':
      return <Player1BansElement layout={element.layout} />;
    case 'bans-player2':
      return <Player2BansElement layout={element.layout} />;
    case 'match-flow':
      return <MatchFlowElement layout={element.layout} />;
    case 'match-search':
      return <MatchSearchElement layout={element.layout} />;
    case 'match-ban-selection':
      return <MatchBanSelectionElement layout={element.layout} />;
    case 'match-ban-animation':
      return <MatchBanAnimationElement layout={element.layout} />;
    case 'match-opponent-wait':
      return <MatchOpponentWaitElement layout={element.layout} />;
    case 'match-smart':
      return <MatchmakingSmartElement layout={element.layout} />;
    case 'match-end':
      return <MatchEndElement playerId={playerId} layout={element.layout} />;
    case 'time-diff':
      return <TimeDiffElement />;
    case 'difficulty-diff':
      return <DifficultyDiffElement />;
    case 'kill-diff':
      return <KillDiffElement />;
    case 'session-summary':
      return <SessionSummaryElement layout={element.layout} />;
    case 'session-current':
      return <SessionCurrentElement layout={element.layout} />;
    case 'session-rating':
      return <SessionRatingElement layout={element.layout} />;
    case 'session-rank':
      return <SessionRankElement layout={element.layout} />;
    case 'session-games':
      return <SessionGamesElement layout={element.layout} />;
    case 'season-info':
      return <SeasonInfoElement layout={element.layout} />;
    case 'season-name':
      return <SeasonNameElement layout={element.layout} />;
    case 'season-time-limit':
      return <SeasonTimeLimitElement layout={element.layout} />;
    case 'season-pause-limit':
      return <SeasonPauseLimitElement layout={element.layout} />;
    case 'season-start-date':
      return <SeasonStartDateElement layout={element.layout} />;
    case 'season-end-date':
      return <SeasonEndDateElement layout={element.layout} />;
    case 'shape-rect':
      return <ShapeRectElement layout={element.layout} />;
    case 'smart-interactions':
      return <SmartInteractionsElement playerId={playerId} layout={element.layout} />;
    
    default:
      return <div className="p-2 text-xs text-white/40">Unknown element</div>;
  }
}

// Memoize ElementRenderer to prevent unnecessary re-renders
// Only re-render when the element itself changes (position, size, type, etc.)
export const ElementRenderer = memo(function ElementRenderer({ element }) {
  return (
    <OverlayElementWrapper element={element}>
      {getElementContent(element)}
    </OverlayElementWrapper>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if element properties actually changed
  const prev = prevProps.element;
  const next = nextProps.element;
  
  return (
    prev.id === next.id &&
    prev.type === next.type &&
    prev.playerId === next.playerId &&
    prev.position.x === next.position.x &&
    prev.position.y === next.position.y &&
    prev.size.width === next.size.width &&
    prev.size.height === next.size.height &&
    prev.scale === next.scale &&
    (prev.opacity ?? 1) === (next.opacity ?? 1) &&
    (prev.zIndex ?? 0) === (next.zIndex ?? 0) &&
    (prev.layout?.align || 'left') === (next.layout?.align || 'left') &&
    (prev.layout?.flow || 'row') === (next.layout?.flow || 'row') &&
    (prev.layout?.justify || 'start') === (next.layout?.justify || 'start') &&
    (prev.layout?.itemsOrder || 'rarity') === (next.layout?.itemsOrder || 'rarity') &&
    (prev.layout?.gapX ?? 4) === (next.layout?.gapX ?? 4) &&
    (prev.layout?.gapY ?? 4) === (next.layout?.gapY ?? 4) &&
    JSON.stringify(prev.layout?.rarityLimits || null) === JSON.stringify(next.layout?.rarityLimits || null) &&
    JSON.stringify(prev.layout?.visibleFields || null) === JSON.stringify(next.layout?.visibleFields || null) &&
    !!prev.layout?.hideTitle === !!next.layout?.hideTitle &&
    !!prev.layout?.hideLabel === !!next.layout?.hideLabel &&
    (prev.layout?.title || '') === (next.layout?.title || '') &&
    !!prev.layout?.lockScale === !!next.layout?.lockScale &&
    (prev.layout?.baseSize?.width || null) === (next.layout?.baseSize?.width || null) &&
    (prev.layout?.baseSize?.height || null) === (next.layout?.baseSize?.height || null) &&
    (prev.layout?.fillColor || '') === (next.layout?.fillColor || '') &&
    (prev.layout?.textColor || '') === (next.layout?.textColor || '') &&
    (prev.layout?.obsVisibility || 'always') === (next.layout?.obsVisibility || 'always') &&
    !!prev.layout?.matchEnd?.blurOnEnd === !!next.layout?.matchEnd?.blurOnEnd &&
    !!prev.layout?.matchEnd?.showEndTitle === !!next.layout?.matchEnd?.showEndTitle &&
    (prev.layout?.matchEnd?.blurAmount ?? 6) === (next.layout?.matchEnd?.blurAmount ?? 6) &&
    (prev.layout?.matchEnd?.desaturate ?? 0.6) === (next.layout?.matchEnd?.desaturate ?? 0.6) &&
    (prev.layout?.matchEnd?.dim ?? 0.2) === (next.layout?.matchEnd?.dim ?? 0.2)
  );
});
