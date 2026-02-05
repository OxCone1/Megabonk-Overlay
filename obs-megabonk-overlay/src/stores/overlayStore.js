import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createStageTrackingState, updateStageTrackingState } from '@/lib/stageTracking';

// Grid resolution presets
export const RESOLUTION_PRESETS = {
  '1920x1080': { width: 1920, height: 1080 },
  '2560x1440': { width: 2560, height: 1440 },
  '3840x2160': { width: 3840, height: 2160 },
  '1280x720': { width: 1280, height: 720 },
  'custom': { width: 1920, height: 1080 },
};

// Rarity tiers matching game (4 tiers only)
export const RARITY_TIERS = {
  0: { name: 'Common', color: '#22c55e' },      // Green
  1: { name: 'Rare', color: '#3b82f6' },        // Blue
  2: { name: 'Epic', color: '#8b5cf6' },        // Purple
  3: { name: 'Legendary', color: '#eab308' },   // Yellow/Gold
};

export const ELEMENT_TYPES = [
  // Equipment
  { type: 'hero', label: 'Hero', description: 'Display current hero', category: 'equipment', defaultSize: { width: 120, height: 140 } },
  { type: 'weapons', label: 'Weapons', description: 'Display equipped weapons', category: 'equipment', defaultSize: { width: 200, height: 80 } },
  { type: 'tomes', label: 'Tomes', description: 'Display equipped tomes', category: 'equipment', defaultSize: { width: 280, height: 80 } },
  { type: 'bonk-classic', label: 'Bonk Classic', description: 'Weapons above tomes (classic stack)', category: 'equipment', defaultSize: { width: 280, height: 170 } },
  
  // Items
  { type: 'item-group', label: 'All Items', description: 'All items grouped by rarity', category: 'items', defaultSize: { width: 450, height: 300 } },
  { type: 'rarity-group-common', label: 'Common Items', description: 'Common (green) items only', category: 'items', defaultSize: { width: 200, height: 60 } },
  { type: 'rarity-group-rare', label: 'Rare Items', description: 'Rare (blue) items only', category: 'items', defaultSize: { width: 200, height: 60 } },
  { type: 'rarity-group-epic', label: 'Epic Items', description: 'Epic (purple) items only', category: 'items', defaultSize: { width: 200, height: 60 } },
  { type: 'rarity-group-legendary', label: 'Legendary Items', description: 'Legendary (gold) items only', category: 'items', defaultSize: { width: 200, height: 60 } },
  
  // Stats - Combined Groups
  { type: 'stats-health', label: 'Health Stats', description: 'HP, Regen, Shield, Overheal', category: 'stats', defaultSize: { width: 180, height: 120 } },
  { type: 'stats-damage', label: 'Damage Stats', description: 'Damage, Crit, Attack Speed', category: 'stats', defaultSize: { width: 180, height: 140 } },
  { type: 'stats-defense', label: 'Defense Stats', description: 'Armor, Evasion, Thorns', category: 'stats', defaultSize: { width: 180, height: 100 } },
  { type: 'stats-utility', label: 'Utility Stats', description: 'Speed, Jump, Pickup Range', category: 'stats', defaultSize: { width: 180, height: 120 } },
  { type: 'stats-economy', label: 'Economy Stats', description: 'Gold, XP, Silver, Luck', category: 'stats', defaultSize: { width: 180, height: 120 } },
  { type: 'stats-enemy', label: 'Enemy Stats', description: 'Difficulty, Enemy modifiers', category: 'stats', defaultSize: { width: 180, height: 120 } },
  
  // Stats - Individual Health Stats
  { type: 'stat-maxhealth', label: 'Max Health', description: 'Maximum HP value', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-healthregen', label: 'Health Regen', description: 'HP regeneration rate', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-shield', label: 'Shield', description: 'Shield value', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-overheal', label: 'Overheal', description: 'Overheal amount', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-healingmultiplier', label: 'Healing Multi', description: 'Healing multiplier', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-lifesteal', label: 'Lifesteal', description: 'Lifesteal percentage', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  
  // Stats - Individual Damage Stats
  { type: 'stat-damagemultiplier', label: 'Damage Multi', description: 'Damage multiplier', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-attackspeed', label: 'Attack Speed', description: 'Attack speed value', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-critchance', label: 'Crit Chance', description: 'Critical hit chance', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-critdamage', label: 'Crit Damage', description: 'Critical damage multiplier', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-projectiles', label: 'Projectiles', description: 'Number of projectiles', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-projectilebounces', label: 'Bounces', description: 'Projectile bounces', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-projectilespeedmultiplier', label: 'Proj Speed', description: 'Projectile speed', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  
  // Stats - Individual Defense Stats
  { type: 'stat-armor', label: 'Armor', description: 'Armor value', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-evasion', label: 'Evasion', description: 'Evasion chance', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-thorns', label: 'Thorns', description: 'Thorns damage', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-damagereductionmultiplier', label: 'Dmg Reduction', description: 'Damage reduction', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  
  // Stats - Individual Elemental Stats
  { type: 'stat-firedamage', label: 'Fire Damage', description: 'Fire damage multiplier', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-icedamage', label: 'Ice Damage', description: 'Ice damage multiplier', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-lightningdamage', label: 'Lightning Dmg', description: 'Lightning damage multiplier', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-burnchance', label: 'Burn Chance', description: 'Burn effect chance', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-freezechance', label: 'Freeze Chance', description: 'Freeze effect chance', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  
  // Stats - Individual Utility Stats
  { type: 'stat-movespeedmultiplier', label: 'Move Speed', description: 'Movement speed', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-jumpheight', label: 'Jump Height', description: 'Jump height value', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-extrajumps', label: 'Extra Jumps', description: 'Additional jumps', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-pickuprange', label: 'Pickup Range', description: 'Item pickup range', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-sizemultiplier', label: 'Size', description: 'Character size', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-durationmultiplier', label: 'Duration', description: 'Effect duration', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-knockbackmultiplier', label: 'Knockback', description: 'Knockback strength', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  
  // Stats - Individual Economy Stats
  { type: 'stat-luck', label: 'Luck', description: 'Luck value', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-goldincreasemultiplier', label: 'Gold Multi', description: 'Gold increase', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-xpincreasemultiplier', label: 'XP Multi', description: 'XP increase', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-silverincreasemultiplier', label: 'Silver Multi', description: 'Silver increase', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-chestincreasemultiplier', label: 'Chest Multi', description: 'Chest increase', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-chestpricemultiplier', label: 'Chest Price', description: 'Chest price multiplier', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-shoppricereduction', label: 'Shop Discount', description: 'Shop price reduction', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-powerupboostmultiplier', label: 'Powerup Boost', description: 'Powerup boost', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-powerupchance', label: 'Powerup Chance', description: 'Powerup drop chance', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  
  // Stats - Individual Enemy Stats
  { type: 'stat-difficulty', label: 'Difficulty', description: 'Current difficulty', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-difficulty-icon', label: 'Difficulty (Icon)', description: 'Difficulty with skull label', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-elitespawnincrease', label: 'Elite Spawn', description: 'Elite spawn rate', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-enemyamountmultiplier', label: 'Enemy Amount', description: 'Enemy spawn amount', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-enemysizemultiplier', label: 'Enemy Size', description: 'Enemy size multiplier', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-enemyspeedmultiplier', label: 'Enemy Speed', description: 'Enemy speed multiplier', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-enemyhpmultiplier', label: 'Enemy HP', description: 'Enemy HP multiplier', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-enemydamagemultiplier', label: 'Enemy Damage', description: 'Enemy damage multiplier', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-enemyscalingmultiplier', label: 'Enemy Scaling', description: 'Enemy scaling rate', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-elitedamagemultiplier', label: 'Elite Damage', description: 'Elite damage multiplier', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  
  // Stats - Special Stats
  { type: 'stat-holiness', label: 'Holiness', description: 'Holiness value', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-wickedness', label: 'Wickedness', description: 'Wickedness value', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-evolve', label: 'Evolve', description: 'Evolution progress', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-weaponburstcooldown', label: 'Burst CD', description: 'Weapon burst cooldown', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-damagecooldownmultiplier', label: 'Dmg CD Multi', description: 'Damage cooldown', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-effectdurationmultiplier', label: 'Effect Duration', description: 'Effect duration', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-falldamagereduction', label: 'Fall Dmg Red', description: 'Fall damage reduction', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'stat-slam', label: 'Slam', description: 'Slam damage', category: 'stats-individual', defaultSize: { width: 120, height: 40 } },
  
  // Combat - Combined Groups
  { type: 'combat-stats', label: 'Combat Stats', description: 'Kills, Gold, Damage dealt/taken', category: 'combat', defaultSize: { width: 200, height: 140 } },
  { type: 'shrine-stats', label: 'Shrine Stats', description: 'Shrine usage breakdown', category: 'combat', defaultSize: { width: 200, height: 160 } },
  { type: 'game-stats', label: 'Game Stats', description: 'Detailed game statistics', category: 'combat', defaultSize: { width: 240, height: 200 } },
  { type: 'damage-sources', label: 'Damage Sources', description: 'Damage by weapon breakdown', category: 'combat', defaultSize: { width: 220, height: 180 } },
  
  // Combat - Individual Stats
  { type: 'combat-killcount', label: 'Kill Count', description: 'Total kills', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-killtick', label: 'Kill Tick', description: 'Kills per tick (last 10 samples)', category: 'combat-individual', defaultSize: { width: 140, height: 40 } },
  { type: 'combat-currentgold', label: 'Current Gold', description: 'Current gold amount', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-totaldamagedealt', label: 'Damage Dealt', description: 'Total damage dealt', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-totaldamagetaken', label: 'Damage Taken', description: 'Total damage taken', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  
  // Combat - Chest Stats
  { type: 'combat-chestsnormal', label: 'Normal Chests', description: 'Normal chests opened', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-chestscorrupt', label: 'Corrupt Chests', description: 'Corrupt chests opened', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-chestsfree', label: 'Free Chests', description: 'Free chests opened', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  
  // Combat - Shrine Stats Individual
  { type: 'combat-shrinebalance', label: 'Balance Shrines', description: 'Balance shrines used', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-shrinegreed', label: 'Greed Shrines', description: 'Greed shrines used', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-shrinechallenge', label: 'Challenge Shrines', description: 'Challenge shrines used', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-shrinecursed', label: 'Cursed Shrines', description: 'Cursed shrines used', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-shrinemagnet', label: 'Magnet Shrines', description: 'Magnet shrines used', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-shrinemoai', label: 'Moai Shrines', description: 'Moai shrines used', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-shrinechargenormal', label: 'Charge Shrines', description: 'Normal charge shrines', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-shrinechargegolden', label: 'Golden Charges', description: 'Golden charge shrines', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  
  // Combat - Game Stats Individual
  { type: 'combat-goldearned', label: 'Gold Earned', description: 'Total gold earned', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-goldspent', label: 'Gold Spent', description: 'Total gold spent', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-silverearned', label: 'Silver Earned', description: 'Total silver earned', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-xpgained', label: 'XP Gained', description: 'Total XP gained', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-elitekills', label: 'Elite Kills', description: 'Elite enemies killed', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-bosskills', label: 'Boss Kills', description: 'Bosses killed', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-minibosskills', label: 'Miniboss Kills', description: 'Minibosses killed', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-finalbosskills', label: 'Final Boss Kills', description: 'Final bosses killed', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-crits', label: 'Critical Hits', description: 'Total critical hits', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-evades', label: 'Evades', description: 'Total evades', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-projectilesfired', label: 'Projectiles Fired', description: 'Total projectiles', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-lifestealhealing', label: 'Lifesteal Heals', description: 'Lifesteal healing', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-itemspickedup', label: 'Items Picked', description: 'Items picked up', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-chestsopened', label: 'Chests Opened', description: 'Total chests opened', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-chestsbought', label: 'Chests Bought', description: 'Chests purchased', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-potsbroken', label: 'Pots Broken', description: 'Pots destroyed', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  { type: 'combat-powerupsused', label: 'Powerups Used', description: 'Powerups consumed', category: 'combat-individual', defaultSize: { width: 120, height: 40 } },
  
  // Game Info
  { type: 'game-time', label: 'Game Time', description: 'Elapsed time and pause info', category: 'game-info', defaultSize: { width: 160, height: 80 } },
  { type: 'game-level', label: 'Level', description: 'Current character level', category: 'game-info', defaultSize: { width: 100, height: 40 } },
  { type: 'pause-limit', label: 'Pause Limit', description: 'Total pause time allowed', category: 'game-info', defaultSize: { width: 140, height: 48 } },
  { type: 'pause-remaining', label: 'Pause Remaining', description: 'Remaining pause time', category: 'game-info', defaultSize: { width: 160, height: 48 } },
  { type: 'stage-state', label: 'Stage State', description: 'Stage timer and current event', category: 'game-info', defaultSize: { width: 200, height: 80 } },
  { type: 'stage-history', label: 'Stage History', description: 'Stage exit timings and kills', category: 'game-info', defaultSize: { width: 220, height: 120 } },

  // Smart Interactions - Animated event notifications
  { type: 'smart-interactions', label: 'Smart Interactions', description: 'Animated stat/item change notifications', category: 'game-info', defaultSize: { width: 240, height: 300 } },

  // Matchmaking / Room Info
  { type: 'time-diff', label: 'Time Diff', description: 'Time difference vs opponent', category: 'match', defaultSize: { width: 120, height: 48 } },
  { type: 'difficulty-diff', label: 'Difficulty Diff', description: 'Difficulty difference vs opponent', category: 'match', defaultSize: { width: 140, height: 48 } },
  { type: 'kill-diff', label: 'Kill Diff', description: 'Kill difference vs opponent', category: 'match', defaultSize: { width: 120, height: 48 } },
  { type: 'match-flow', label: 'Match Flow', description: 'Queue and match status', category: 'match', defaultSize: { width: 220, height: 120 } },
  { type: 'match-search', label: 'Match Search', description: 'Queue search timer & loader', category: 'match', defaultSize: { width: 220, height: 140 } },
  { type: 'match-ban-selection', label: 'Ban Selection', description: 'Ban phase status', category: 'match', defaultSize: { width: 220, height: 100 } },
  { type: 'match-ban-animation', label: 'Ban Animation', description: 'Ban phase animation only', category: 'match', defaultSize: { width: 220, height: 120 } },
  { type: 'match-opponent-wait', label: 'Opponent Wait', description: 'Waiting for opponent data', category: 'match', defaultSize: { width: 220, height: 80 } },
  { type: 'match-smart', label: 'Smart Matchmaking', description: 'Search, bans, and opponent wait', category: 'match', defaultSize: { width: 240, height: 200 } },
  { type: 'match-end', label: 'Match End', description: 'Per-player match end status', category: 'match-player', defaultSize: { width: 200, height: 60 } },

  // Session Stats
  { type: 'session-summary', label: 'Session Summary', description: 'Start vs current rating/rank summary', category: 'session', defaultSize: { width: 260, height: 110 } },
  { type: 'session-current', label: 'Session Current', description: 'Current rating + rank with change', category: 'session', defaultSize: { width: 200, height: 110 } },
  { type: 'session-rating', label: 'Session Rating', description: 'Current session rating', category: 'session', defaultSize: { width: 160, height: 60 } },
  { type: 'session-rank', label: 'Session Rank', description: 'Current session rank', category: 'session', defaultSize: { width: 160, height: 60 } },
  { type: 'session-games', label: 'Session Games', description: 'Recent session rating changes', category: 'session', defaultSize: { width: 260, height: 140 } },

  // Season Info
  { type: 'season-info', label: 'Season Info', description: 'Season name, limits, and dates', category: 'season', defaultSize: { width: 220, height: 140 } },
  { type: 'season-name', label: 'Season Name', description: 'Season name only', category: 'season', defaultSize: { width: 200, height: 40 } },
  { type: 'season-time-limit', label: 'Season Time Limit', description: 'Season time limit', category: 'season', defaultSize: { width: 200, height: 40 } },
  { type: 'season-pause-limit', label: 'Season Pause Limit', description: 'Season pause limit', category: 'season', defaultSize: { width: 200, height: 40 } },
  { type: 'season-start-date', label: 'Season Start Date', description: 'Season start date', category: 'season', defaultSize: { width: 200, height: 40 } },
  { type: 'season-end-date', label: 'Season End Date', description: 'Season end date', category: 'season', defaultSize: { width: 200, height: 40 } },

  // Room Bans
  { type: 'bans-system', label: 'Room Bans', description: 'System/room bans', category: 'bans', defaultSize: { width: 280, height: 140 } },
  { type: 'bans-player1', label: 'Player 1 Bans', description: 'Bans set by player 1', category: 'bans', defaultSize: { width: 280, height: 140 } },
  { type: 'bans-player2', label: 'Player 2 Bans', description: 'Bans set by player 2', category: 'bans', defaultSize: { width: 280, height: 140 } },

  // Shapes
  { type: 'shape-rect', label: 'Color Block', description: 'Solid fill block', category: 'shapes', defaultSize: { width: 200, height: 200 } },
];

const SHARED_ELEMENT_TYPES = new Set([
  'time-diff',
  'difficulty-diff',
  'kill-diff',
  'match-flow',
  'match-search',
  'match-ban-selection',
  'match-ban-animation',
  'match-opponent-wait',
  'match-smart',
  'session-summary',
  'session-current',
  'session-rating',
  'session-rank',
  'session-games',
  'season-info',
  'season-name',
  'season-time-limit',
  'season-pause-limit',
  'season-start-date',
  'season-end-date',
  'bans-system',
  'bans-player1',
  'bans-player2',
]);

const normalizeImportedLayout = (layout) => (
  layout ? {
    ...layout,
    baseSize: layout.baseSize ? { ...layout.baseSize } : layout.baseSize,
    lockOriginalSize: layout.lockOriginalSize ? { ...layout.lockOriginalSize } : layout.lockOriginalSize,
    rarityLimits: layout.rarityLimits ? { ...layout.rarityLimits } : layout.rarityLimits,
    visibleFields: layout.visibleFields ? { ...layout.visibleFields } : layout.visibleFields,
  } : layout
);

// Generate unique ID
const generateId = () => `element-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

const cloneElements = (elements) => elements.map((el) => ({
  ...el,
  position: el.position ? { ...el.position } : el.position,
  size: el.size ? { ...el.size } : el.size,
  layout: el.layout ? {
    ...el.layout,
    baseSize: el.layout.baseSize ? { ...el.layout.baseSize } : el.layout.baseSize,
    lockOriginalSize: el.layout.lockOriginalSize ? { ...el.layout.lockOriginalSize } : el.layout.lockOriginalSize,
    gapX: el.layout.gapX,
    gapY: el.layout.gapY,
    rarityLimits: el.layout.rarityLimits ? { ...el.layout.rarityLimits } : el.layout.rarityLimits,
    visibleFields: el.layout.visibleFields ? { ...el.layout.visibleFields } : el.layout.visibleFields,
  } : el.layout,
}));

const cloneGroups = (groups) => groups.map((group) => ({
  ...group,
  elementIds: [...group.elementIds],
}));

const sortElementsByZ = (elements) => (
  [...elements].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
);

const reassignZIndexes = (sortedElements) => (
  sortedElements.map((el, index) => ({
    ...el,
    zIndex: index + 1,
  }))
);

const reorderZIndexes = (elements, selectedIds, mode) => {
  const selectedSet = new Set(selectedIds);
  const sorted = sortElementsByZ(elements);
  const selected = [];
  const others = [];

  sorted.forEach((el) => {
    if (selectedSet.has(el.id)) {
      selected.push(el);
    } else {
      others.push(el);
    }
  });

  const ordered = mode === 'front'
    ? [...others, ...selected]
    : [...selected, ...others];

  return reassignZIndexes(ordered);
};

const stepZIndexes = (elements, selectedIds, direction) => {
  const selectedSet = new Set(selectedIds);
  const sorted = sortElementsByZ(elements);

  if (direction === 'forward') {
    for (let i = sorted.length - 2; i >= 0; i -= 1) {
      if (selectedSet.has(sorted[i].id) && !selectedSet.has(sorted[i + 1].id)) {
        const temp = sorted[i];
        sorted[i] = sorted[i + 1];
        sorted[i + 1] = temp;
      }
    }
  } else {
    for (let i = 1; i < sorted.length; i += 1) {
      if (selectedSet.has(sorted[i].id) && !selectedSet.has(sorted[i - 1].id)) {
        const temp = sorted[i];
        sorted[i] = sorted[i - 1];
        sorted[i - 1] = temp;
      }
    }
  }

  return reassignZIndexes(sorted);
};

const normalizeArray = (list) => (Array.isArray(list) ? list : []);

const createKillTrackingEntry = () => ({
  lastKillCount: null,
  prevKillCount: null,
  history: [],
  lastTick: 0,
  prevTick: 0,
});

const createKillTrackingState = () => ({
  1: createKillTrackingEntry(),
  2: createKillTrackingEntry(),
});

const createSpoofStageHistory = () => ({
  1: {
    1: { timeSeconds: null, kills: null, difficultyPercent: null },
    2: { timeSeconds: null, kills: null, difficultyPercent: null },
    3: { timeSeconds: null, kills: null, difficultyPercent: null },
  },
  2: {
    1: { timeSeconds: null, kills: null, difficultyPercent: null },
    2: { timeSeconds: null, kills: null, difficultyPercent: null },
    3: { timeSeconds: null, kills: null, difficultyPercent: null },
  },
});

const createSavedLayouts = () => ([]);

const updateKillTrackingState = (tracking, playerId, killCount) => {
  if (!playerId) return tracking;
  const numeric = Number(killCount);
  const nextKillCount = Number.isFinite(numeric) ? numeric : 0;
  const current = tracking?.[playerId] || createKillTrackingEntry();

  if (current.lastKillCount === null || current.lastKillCount === undefined) {
    return {
      ...(tracking || {}),
      [playerId]: {
        ...current,
        lastKillCount: nextKillCount,
        prevKillCount: nextKillCount,
        history: [nextKillCount],
      },
    };
  }

  if (nextKillCount === current.lastKillCount) {
    return tracking;
  }

  const history = [...(current.history || []), nextKillCount];
  if (history.length > 10) history.shift();

  let nextTick = current.lastTick ?? 0;
  let prevTick = current.lastTick ?? 0;
  if (history.length === 10) {
    const newest = history[history.length - 1];
    const oldest = history[0];
    prevTick = current.lastTick ?? 0;
    nextTick = (newest - oldest) / 10;
  }

  return {
    ...(tracking || {}),
    [playerId]: {
      ...current,
      prevKillCount: current.lastKillCount,
      lastKillCount: nextKillCount,
      history,
      prevTick,
      lastTick: nextTick,
    },
  };
};

const getAbilityId = (ability) => (
  ability?.id
  ?? ability?.ingameId
  ?? ability?.key
  ?? ability?.name
  ?? ability?.type
  ?? null
);

const buildSmartSnapshot = (playerState) => {
  if (!playerState) return null;
  const equipment = playerState.equipment || {};
  const weapons = normalizeArray(equipment.weapons).map((weapon) => ({
    id: weapon?.id ?? null,
    level: weapon?.level ?? 0,
    name: weapon?.name,
  }));
  const tomes = normalizeArray(equipment.tomes).map((tome) => ({
    id: tome?.id ?? null,
    level: tome?.level ?? 0,
    name: tome?.name,
  }));
  const items = normalizeArray(equipment.items).map((item) => ({
    id: item?.id ?? null,
    count: item?.count ?? 1,
    rarity: item?.rarity,
    name: item?.name,
  }));
  const rawAbilities = playerState.character?.abilities ?? playerState.character?.skills ?? null;
  const abilities = Array.isArray(rawAbilities)
    ? rawAbilities.map((ability) => ({
      id: getAbilityId(ability),
      level: ability?.level ?? ability?.rank ?? 0,
      name: ability?.name,
    }))
    : (rawAbilities && typeof rawAbilities === 'object' ? { ...rawAbilities } : null);

  return {
    stats: playerState.character?.stats ? { ...playerState.character.stats } : null,
    shrines: playerState.combat?.shrines ? { ...playerState.combat.shrines } : null,
    weapons,
    tomes,
    items,
    abilities,
  };
};

const diffScalarMap = (prev, next) => {
  if (!prev && !next) return {};
  const prevMap = prev || {};
  const nextMap = next || {};
  const changes = {};
  const keys = new Set([...Object.keys(prevMap), ...Object.keys(nextMap)]);
  keys.forEach((key) => {
    const prevValue = prevMap[key];
    const nextValue = nextMap[key];
    if (prevValue === undefined && nextValue === undefined) return;
    if (prevValue === nextValue) return;
    const delta = (typeof prevValue === 'number' && typeof nextValue === 'number')
      ? nextValue - prevValue
      : null;
    changes[key] = {
      from: prevValue ?? null,
      to: nextValue ?? null,
      delta,
    };
  });
  return changes;
};

const buildIdMap = (list) => {
  const map = new Map();
  const ambiguous = [];
  normalizeArray(list).forEach((item) => {
    const id = item?.id;
    if (id === null || id === undefined) {
      ambiguous.push(item);
      return;
    }
    map.set(id, item);
  });
  return { map, ambiguous };
};

const diffInventory = (prevList, nextList, fields) => {
  const prevData = buildIdMap(prevList);
  const nextData = buildIdMap(nextList);
  const added = [];
  const removed = [];
  const updated = [];

  prevData.map.forEach((prevItem, id) => {
    const nextItem = nextData.map.get(id);
    if (!nextItem) {
      removed.push(prevItem);
      return;
    }
    const changes = {};
    fields.forEach((field) => {
      if (prevItem?.[field] !== nextItem?.[field]) {
        const delta = (typeof prevItem?.[field] === 'number' && typeof nextItem?.[field] === 'number')
          ? nextItem[field] - prevItem[field]
          : null;
        changes[field] = {
          from: prevItem?.[field] ?? null,
          to: nextItem?.[field] ?? null,
          delta,
        };
      }
    });
    if (Object.keys(changes).length > 0) {
      updated.push({ id, changes });
    }
  });

  nextData.map.forEach((nextItem, id) => {
    if (!prevData.map.has(id)) {
      added.push(nextItem);
    }
  });

  return {
    added,
    removed,
    updated,
    ambiguous: [...prevData.ambiguous, ...nextData.ambiguous],
  };
};

const hasInventoryChanges = (diff) => (
  (diff?.added?.length || 0) > 0
  || (diff?.removed?.length || 0) > 0
  || (diff?.updated?.length || 0) > 0
  || (diff?.ambiguous?.length || 0) > 0
);

const buildSmartDiff = (prevSnapshot, nextSnapshot) => {
  if (!prevSnapshot || !nextSnapshot) return null;
  const stats = diffScalarMap(prevSnapshot.stats, nextSnapshot.stats);
  const shrines = diffScalarMap(prevSnapshot.shrines, nextSnapshot.shrines);
  const weapons = diffInventory(prevSnapshot.weapons, nextSnapshot.weapons, ['level']);
  const tomes = diffInventory(prevSnapshot.tomes, nextSnapshot.tomes, ['level']);
  const items = diffInventory(prevSnapshot.items, nextSnapshot.items, ['count', 'rarity']);
  const abilities = (Array.isArray(prevSnapshot.abilities) || Array.isArray(nextSnapshot.abilities))
    ? diffInventory(prevSnapshot.abilities || [], nextSnapshot.abilities || [], ['level'])
    : diffScalarMap(prevSnapshot.abilities || {}, nextSnapshot.abilities || {});

  const hasChanges = Object.keys(stats).length > 0
    || Object.keys(shrines).length > 0
    || hasInventoryChanges(weapons)
    || hasInventoryChanges(tomes)
    || hasInventoryChanges(items)
    || (Array.isArray(prevSnapshot.abilities) || Array.isArray(nextSnapshot.abilities)
      ? hasInventoryChanges(abilities)
      : Object.keys(abilities).length > 0);

  return {
    stats,
    shrines,
    weapons,
    tomes,
    items,
    abilities,
    hasChanges,
    timestamp: Date.now(),
  };
};

export const useOverlayStore = create(
  persist(
    (set, get) => {
      const snapshotState = (state) => ({
        elements: cloneElements(state.elements),
        groups: cloneGroups(state.groups),
      });

      const setWithHistory = (updater) => set((state) => {
        const result = updater(state);
        if (!result) return state;

        const nextElements = result.elements ?? state.elements;
        const nextGroups = result.groups ?? state.groups;

        if (nextElements === state.elements && nextGroups === state.groups) return state;

        const pastEntry = snapshotState(state);
        const nextPast = [...state.historyPast, pastEntry].slice(-state.historyLimit);

        return {
          ...result,
          elements: nextElements,
          groups: nextGroups,
          historyPast: nextPast,
          historyFuture: [],
        };
      });

      return ({
      // Initial state
      resolution: '1920x1080',
      customResolution: { width: 1920, height: 1080 },
      gridSize: 10,
      showGrid: true,
      transparentBackground: false,
      backgroundImageUrl: null,
      iconScale: 1,
      sidebarOpen: false,
      sidebarVisible: false,
      selectedPlayerId: 1,
      isDragging: false,
      instaDragTimestamp: 0, // Timestamp for forcing Moveable remount on InstaDrag
      selectedElementId: null,
      selectedElementIds: [], // Multi-select: array of selected element IDs
      elementClickedRecently: false, // Track if an element was just clicked (to prevent canvas deselection)
      isSelectingRectangle: false, // Whether user is drawing selection rectangle
      selectionRectangle: null, // { startX, startY, endX, endY } in canvas coordinates
      groups: [], // Array of { id, name, elementIds: [] }
      roomBans: {
        system: { heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
        player1: { player1_id: null, heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
        player2: { player2_id: null, heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
      },
      roomMeta: {
        roomId: null,
        lobbyNumber: null,
        queueType: null,
        status: null,
        phase: null,
        map: null,
        winnerId: null,
        player1_id: null,
        player2_id: null,
        player1Profile: null,
        player2Profile: null,
        gamePhaseStartedAt: null,
        player1GameStatus: null,
        player2GameStatus: null,
        currentPlayerGameStatus: null,
        player1RunHasData: null,
        player2RunHasData: null,
      },
      queueState: {
        inQueue: false,
        queueType: null,
        seasonId: null,
        rating: 0,
        queueSize: 0,
        elapsedTime: 0,
        status: 'idle',
        proposalId: null,
        matchTimeout: null,
        playerAccepted: false,
        opponentAccepted: false,
        declinedBy: null,
        message: null,
        lastEvent: null,
      },
      matchEndState: {
        active: false,
        status: null,
        roomId: null,
        endedAt: null,
        fadeActive: false,
        fadeStartedAt: null,
        fadeDuration: null,
      },
      elements: [],
      historyPast: [],
      historyFuture: [],
      historyLimit: 10,
      player1State: null,
      player2State: null,
      smartSnapshots: { player1: null, player2: null },
      smartDiffs: { player1: null, player2: null },
      
      killTracking: createKillTrackingState(),
      stageTracking: createStageTrackingState(),
      // Canvas zoom/pan state
      canvasZoom: 1,
      canvasPan: { x: 0, y: 0 },
      isPanning: false,
      
      // Connection state
      isConnected: false,
      connectionError: null,
      
      // Room state
      activeRoom: null,
      currentUser_id: null,
      
      // Spectator mode state
      isSpectator: false,
      autoSpectatorMode: true, // Auto-detect and switch to spectator mode
      
      // Season data (fetched once via /room API)
      seasonInfo: null,
      
      // Timer settings
      timeFlowDirection: 'elapsed', // 'elapsed' (count up) or 'remaining' (countdown to limit)
      
      // Sidebar settings
      sidebarAutoHide: false, // Auto-hide sidebar on inactivity
      allowUserSelect: false, // Allow text/image selection in overlay
      advancedSettingsEnabled: false, // Show advanced settings
      smartInteractionsEnabled: false, // Enable smart interactions elements/settings
      showElementOutlines: false, // Show icon borders/backgrounds
      hideElementTitles: false, // Hide element titles globally
      spoofEnabled: false, // Enable fake game data
      spoofMatchState: 'idle', // Fake matchmaking state
      showClippingWarnings: true, // Show clipping overflow indicator
      spoofItemCounts: { 0: 0, 1: 0, 2: 0, 3: 0 }, // Fake data item counts per rarity
      spoofDiffs: { timeSeconds: null, difficulty: null, kills: null }, // Fake diff overrides
      spoofSessionGamesCount: 8, // Fake session games count
      spoofStageHistory: createSpoofStageHistory(),
      savedLayouts: createSavedLayouts(),
      settingsSyncMode: 'off', // off | upload | download

      // Language & OBS label settings
      language: 'en',
      obsHideLabels: true,

      // Match end visual settings
      globalBlurOnMatchEnd: false,
      perPlayerEndBlurEnabled: { 1: true, 2: true },

      // Session tracking display
      sessionStats: {
        active: false,
        startRating: null,
        startRank: null,
        currentRating: null,
        currentRank: null,
        games: [],
        lastUpdated: null,
      },
      sessionGameDisplayLimit: 10,

      // Stat formatting
      statPlainFormat: 'round', // 'round' | 'decimal'
      
      // Grid settings
      gridEnabled: true, // Enable/disable grid and snapping entirely
      
      // Icon source setting
      iconSource: 'local', // 'cdn' for game CDN icons, 'local' for Game Icons folder
      
      // Actions
      setResolution: (resolution) => set({ resolution }),
      setCustomResolution: (width, height) => set({ customResolution: { width, height } }),
      setGridSize: (gridSize) => set({ gridSize }),
      setShowGrid: (showGrid) => set({ showGrid }),
      setTransparentBackground: (transparentBackground) => set({ transparentBackground }),
      setBackgroundImageUrl: (backgroundImageUrl) => set({ backgroundImageUrl }),
      setIconScale: (iconScale) => set({ iconScale }),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      setSidebarVisible: (sidebarVisible) => set({ sidebarVisible }),
      setSelectedPlayerId: (selectedPlayerId) => set({ selectedPlayerId }),
      setIsDragging: (isDragging) => set({ isDragging }),
      setInstaDragTimestamp: (timestamp) => set({ instaDragTimestamp: timestamp }),
      setSelectedElementId: (selectedElementId) => set({ 
        selectedElementId,
        // Clear multi-select when single-selecting
        selectedElementIds: selectedElementId ? [] : get().selectedElementIds,
      }),
      
      // Multi-select actions
      setSelectedElementIds: (selectedElementIds) => {

        set({ 
          selectedElementIds,
          // Clear single select when multi-selecting
          selectedElementId: selectedElementIds.length > 0 ? null : get().selectedElementId,
        });
      },
      
      addToSelection: (elementId) => set((state) => {
        if (state.selectedElementIds.includes(elementId)) return state;
        return {
          selectedElementIds: [...state.selectedElementIds, elementId],
          selectedElementId: null,
        };
      }),
      
      removeFromSelection: (elementId) => set((state) => ({
        selectedElementIds: state.selectedElementIds.filter(id => id !== elementId),
      })),
      
      toggleSelection: (elementId) => set((state) => {
        const hasMulti = state.selectedElementIds.includes(elementId);
        
        if (hasMulti) {
          const newIds = state.selectedElementIds.filter(id => id !== elementId);
          return { selectedElementIds: newIds };
        }

        // If a single element is selected, promote it into multi-selection
        const baseIds = state.selectedElementId
          ? [state.selectedElementId]
          : state.selectedElementIds;

        const newIds = [...baseIds, elementId];
        return {
          selectedElementIds: newIds,
          selectedElementId: null,
        };
      }),
      
      clearSelection: () => {
        set({ selectedElementId: null, selectedElementIds: [] });
      },
      
      // Selection rectangle actions
      setIsSelectingRectangle: (isSelectingRectangle) => set({ isSelectingRectangle }),
      setSelectionRectangle: (selectionRectangle) => set({ selectionRectangle }),
      setElementClickedRecently: (clicked) => set({ elementClickedRecently: clicked }),
      setRoomBans: (roomBans) => set({ roomBans }),
      setRoomMeta: (roomMeta) => set({ roomMeta }),
      setQueueState: (queueState) => set({ queueState }),
      setMatchEndState: (matchEndState) => set({ matchEndState }),
      clearMatchEndState: () => set({
        matchEndState: {
          active: false,
          status: null,
          roomId: null,
          endedAt: null,
          fadeActive: false,
          fadeStartedAt: null,
          fadeDuration: null,
        },
      }),
      applyLayoutPayload: (payload) => set(() => ({
        resolution: payload.resolution || '1920x1080',
        customResolution: payload.customResolution || { width: 1920, height: 1080 },
        elements: (payload.elements || []).map((el) => {
          const importedLayout = normalizeImportedLayout(el.layout);
          const matchEnd = {
            blurOnEnd: get().globalBlurOnMatchEnd,
            showEndTitle: importedLayout?.matchEnd?.showEndTitle ?? false,
            blurAmount: importedLayout?.matchEnd?.blurAmount ?? 6,
            desaturate: importedLayout?.matchEnd?.desaturate ?? 0.6,
            dim: importedLayout?.matchEnd?.dim ?? 0.2,
          };
          return {
            ...el,
            id: el.id || generateId(),
            layout: {
              ...(importedLayout || {}),
              justify: importedLayout?.justify ?? 'start',
              matchEnd,
            },
          };
        }),
        groups: (payload.groups || []).map((group) => ({
          ...group,
          id: group.id || `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          elementIds: Array.isArray(group.elementIds) ? group.elementIds : [],
        })),
        iconScale: payload.iconScale ?? 1,
        iconSource: payload.iconSource || 'cdn',
        gridEnabled: payload.gridEnabled ?? true,
        showGrid: payload.showGrid ?? true,
        gridSize: payload.gridSize ?? 10,
        transparentBackground: payload.transparentBackground ?? false,
        selectedElementId: null,
        selectedElementIds: [],
        historyPast: [],
        historyFuture: [],
        canvasZoom: 1,
        canvasPan: { x: 0, y: 0 },
      })),

      addElementsFromPayload: (payload, fallbackPlayerId) => setWithHistory((state) => {
        if (!payload || !Array.isArray(payload.elements) || payload.elements.length === 0) return null;

        const maxZ = state.elements.length > 0
          ? Math.max(...state.elements.map(el => el.zIndex ?? 0))
          : 0;
        const globalBlurOnMatchEnd = state.globalBlurOnMatchEnd;
        const sortedIncoming = [...payload.elements]
          .filter(Boolean)
          .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
        const idMap = new Map();

        const newElements = sortedIncoming.map((el, index) => {
          const newId = generateId();
          idMap.set(el.id, newId);

          const resolvedPlayerId = SHARED_ELEMENT_TYPES.has(el.type)
            ? null
            : (el.playerId ?? fallbackPlayerId ?? null);

          const importedLayout = normalizeImportedLayout(el.layout);
          const matchEnd = {
            blurOnEnd: globalBlurOnMatchEnd,
            showEndTitle: importedLayout?.matchEnd?.showEndTitle ?? false,
            blurAmount: importedLayout?.matchEnd?.blurAmount ?? 6,
            desaturate: importedLayout?.matchEnd?.desaturate ?? 0.6,
            dim: importedLayout?.matchEnd?.dim ?? 0.2,
          };

          return {
            ...el,
            id: newId,
            playerId: resolvedPlayerId,
            position: el.position ? { ...el.position } : { x: 100, y: 100 },
            size: el.size ? { ...el.size } : { width: 200, height: 100 },
            layout: {
              ...(importedLayout || {}),
              justify: importedLayout?.justify ?? 'start',
              matchEnd,
            },
            zIndex: maxZ + index + 1,
          };
        });

        const incomingGroups = Array.isArray(payload.groups) ? payload.groups : [];
        const newGroups = incomingGroups
          .filter(group => Array.isArray(group.elementIds) && group.elementIds.every(id => idMap.has(id)))
          .map(group => ({
            id: `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: group.name || 'Group',
            elementIds: group.elementIds.map(id => idMap.get(id)),
          }));

        return {
          elements: [...state.elements, ...newElements],
          groups: [...state.groups, ...newGroups],
        };
      }),
      
      // Group actions
      createGroup: (elementIds, name) => {
        if (!elementIds || elementIds.length < 2) return null;
        const normalizedIds = Array.from(new Set(elementIds));
        if (normalizedIds.length < 2) return null;

        const { groups } = get();
        const hasGroupedElement = groups.some(g => g.elementIds.some(id => normalizedIds.includes(id)));
        if (hasGroupedElement) return null;

        const groupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setWithHistory((state) => ({
          groups: [...state.groups, { id: groupId, name: name || 'Group', elementIds: normalizedIds }],
        }));
        return groupId;
      },
      addElementsToGroup: (groupId, elementIds) => setWithHistory((state) => {
        const targetGroup = state.groups.find(g => g.id === groupId);
        if (!targetGroup || !elementIds || elementIds.length === 0) return null;

        const normalizedIds = Array.from(new Set(elementIds));

        const elementIdsToAdd = normalizedIds.filter(id => {
          const alreadyInTarget = targetGroup.elementIds.includes(id);
          const inOtherGroup = state.groups.some(g => g.id !== groupId && g.elementIds.includes(id));
          return !alreadyInTarget && !inOtherGroup;
        });

        if (elementIdsToAdd.length === 0) return null;

        return {
          groups: state.groups.map(g =>
            g.id === groupId
              ? { ...g, elementIds: [...g.elementIds, ...elementIdsToAdd] }
              : g
          ),
        };
      }),
      
      deleteGroup: (groupId) => setWithHistory((state) => ({
        groups: state.groups.filter(g => g.id !== groupId),
      })),
      
      updateGroupName: (groupId, name) => setWithHistory((state) => ({
        groups: state.groups.map(g => g.id === groupId ? { ...g, name } : g),
      })),
      
      // Get group for an element
      getGroupForElement: (elementId) => {
        const { groups } = get();
        return groups.find(g => g.elementIds.includes(elementId));
      },
      
      // Get all elements in the same group as the given element
      getGroupElements: (elementId) => {
        const group = get().getGroupForElement(elementId);
        if (!group) return [elementId];
        return group.elementIds;
      },
      
      // Move multiple elements together (for group or multi-select movement)
      moveElements: (elementIds, deltaX, deltaY) => setWithHistory((state) => ({
        elements: state.elements.map(e => 
          elementIds.includes(e.id) 
            ? { ...e, position: { x: e.position.x + deltaX, y: e.position.y + deltaY } }
            : e
        ),
      })),
      
      setIsConnected: (isConnected) => set({ isConnected }),
      setConnectionError: (connectionError) => set({ connectionError }),
      
      // Room state actions
      setActiveRoom: (activeRoom) => set({ activeRoom }),
      setCurrentUser_id: (currentUser_id) => set({ currentUser_id }),
      clearRoom: () => set({
        activeRoom: null,
        player1State: null,
        player2State: null,
        smartSnapshots: { player1: null, player2: null },
        smartDiffs: { player1: null, player2: null },
        killTracking: createKillTrackingState(),
        stageTracking: createStageTrackingState(),
        isSpectator: false,
        matchEndState: {
          active: false,
          status: null,
          roomId: null,
          endedAt: null,
          fadeActive: false,
          fadeStartedAt: null,
          fadeDuration: null,
        },
        queueState: {
          inQueue: false,
          queueType: null,
          seasonId: null,
          rating: 0,
          queueSize: 0,
          elapsedTime: 0,
          status: 'idle',
          proposalId: null,
          matchTimeout: null,
          playerAccepted: false,
          opponentAccepted: false,
          declinedBy: null,
          message: null,
          lastEvent: null,
        },
        roomMeta: {
          roomId: null,
          lobbyNumber: null,
          queueType: null,
          status: null,
          phase: null,
          map: null,
          winnerId: null,
          player1_id: null,
          player2_id: null,
          player1Profile: null,
          player2Profile: null,
          gamePhaseStartedAt: null,
          player1GameStatus: null,
          player2GameStatus: null,
          currentPlayerGameStatus: null,
          player1RunHasData: null,
          player2RunHasData: null,
        },
        roomBans: {
          system: { heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
          player1: { player1_id: null, heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
          player2: { player2_id: null, heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
        },
      }),
      
      // Spectator mode actions
      setIsSpectator: (isSpectator) => set({ isSpectator }),
      setAutoSpectatorMode: (autoSpectatorMode) => set({ autoSpectatorMode }),
      
      // Season info action
      setSeasonInfo: (seasonInfo) => set({ seasonInfo }),
      
      // Timer settings action
      setTimeFlowDirection: (timeFlowDirection) => set({ timeFlowDirection }),
      
      // Sidebar settings action
      setSidebarAutoHide: (sidebarAutoHide) => set({ sidebarAutoHide }),
      setAllowUserSelect: (allowUserSelect) => set({ allowUserSelect }),
      setAdvancedSettingsEnabled: (advancedSettingsEnabled) => set({ advancedSettingsEnabled }),
      setSmartInteractionsEnabled: (smartInteractionsEnabled) => set({ smartInteractionsEnabled }),
      setShowElementOutlines: (showElementOutlines) => set({ showElementOutlines }),
      setHideElementTitles: (hideElementTitles) => set({ hideElementTitles }),
      setSpoofEnabled: (spoofEnabled) => set(() => {
        if (spoofEnabled) {
          return { spoofEnabled: true };
        }

        return {
          spoofEnabled: false,
          spoofMatchState: 'idle',
          player1State: null,
          player2State: null,
          activeRoom: null,
          isSpectator: false,
          smartSnapshots: { player1: null, player2: null },
          smartDiffs: { player1: null, player2: null },
          stageTracking: createStageTrackingState(),
          roomMeta: {
            roomId: null,
            lobbyNumber: null,
            queueType: null,
            status: null,
            phase: null,
            map: null,
            winnerId: null,
            player1_id: null,
            player2_id: null,
            player1Profile: null,
            player2Profile: null,
            gamePhaseStartedAt: null,
            player1GameStatus: null,
            player2GameStatus: null,
            currentPlayerGameStatus: null,
            player1RunHasData: null,
            player2RunHasData: null,
          },
          roomBans: {
            system: { heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
            player1: { player1_id: null, heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
            player2: { player2_id: null, heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } },
          },
          queueState: {
            inQueue: false,
            queueType: null,
            seasonId: null,
            rating: 0,
            queueSize: 0,
            elapsedTime: 0,
            status: 'idle',
            proposalId: null,
            matchTimeout: null,
            playerAccepted: false,
            opponentAccepted: false,
            declinedBy: null,
            message: null,
            lastEvent: null,
          },
          matchEndState: {
            active: false,
            status: null,
            roomId: null,
            endedAt: null,
            fadeActive: false,
            fadeStartedAt: null,
            fadeDuration: null,
          },
        };
      }),
      setSpoofMatchState: (spoofMatchState) => set({ spoofMatchState }),
      setSpoofItemCounts: (spoofItemCounts) => set({ spoofItemCounts }),
      setSpoofDiffs: (spoofDiffs) => set({ spoofDiffs }),
      setSpoofSessionGamesCount: (spoofSessionGamesCount) => set({ spoofSessionGamesCount }),
      setSpoofStageHistory: (spoofStageHistory) => set({ spoofStageHistory }),
      setSettingsSyncMode: (settingsSyncMode) => set({ settingsSyncMode }),
      saveLayout: (name, layoutString) => set((state) => {
        if (!name || !layoutString) return state;
        const entry = {
          id: `layout-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name,
          layoutString,
          updatedAt: Date.now(),
        };
        return {
          savedLayouts: [...(state.savedLayouts || []), entry],
        };
      }),
      deleteSavedLayout: (id) => set((state) => ({
        savedLayouts: (state.savedLayouts || []).filter((entry) => entry.id !== id),
      })),
      setShowClippingWarnings: (showClippingWarnings) => set({ showClippingWarnings }),
      setLanguage: (language) => set({ language }),
      setObsHideLabels: (obsHideLabels) => set({ obsHideLabels }),
      setGlobalBlurOnMatchEnd: (enabled) => set((state) => ({
        globalBlurOnMatchEnd: enabled,
        elements: state.elements.map((el) => ({
          ...el,
          layout: {
            ...(el.layout || {}),
            matchEnd: {
              blurOnEnd: enabled,
              showEndTitle: el.layout?.matchEnd?.showEndTitle ?? false,
              blurAmount: el.layout?.matchEnd?.blurAmount ?? 6,
              desaturate: el.layout?.matchEnd?.desaturate ?? 0.6,
              dim: el.layout?.matchEnd?.dim ?? 0.2,
            },
          },
        })),
      })),
      setPlayerEndBlurEnabled: (playerId, enabled) => set((state) => ({
        perPlayerEndBlurEnabled: {
          ...(state.perPlayerEndBlurEnabled || { 1: true, 2: true }),
          [playerId]: !!enabled,
        },
      })),
      setSessionStats: (sessionStats) => set({ sessionStats }),
      setSessionGameDisplayLimit: (sessionGameDisplayLimit) => set({ sessionGameDisplayLimit }),
      setStatPlainFormat: (statPlainFormat) => set({ statPlainFormat }),
      setHistoryLimit: (historyLimit) => set((state) => {
        const clamped = Math.max(5, Math.min(20, historyLimit));
        return {
          historyLimit: clamped,
          historyPast: state.historyPast.slice(-clamped),
        };
      }),
      
      // Grid settings action
      setGridEnabled: (gridEnabled) => set({ gridEnabled }),
      
      // Icon source action
      setIconSource: (iconSource) => set({ iconSource }),
      
      // Canvas zoom/pan actions
      setCanvasZoom: (canvasZoom) => set({ canvasZoom: Math.max(0.1, Math.min(3, canvasZoom)) }),
      setCanvasPan: (canvasPan) => set({ canvasPan }),
      setIsPanning: (isPanning) => set({ isPanning }),
      resetCanvasView: () => set({ canvasZoom: 1, canvasPan: { x: 0, y: 0 } }),
      
      addElement: (type, playerId, position) => {
        const id = generateId();
        const config = ELEMENT_TYPES.find(e => e.type === type);
        const defaultSize = config?.defaultSize || { width: 200, height: 100 };
        const currentElements = get().elements;
        const globalBlurOnMatchEnd = get().globalBlurOnMatchEnd;
        const maxZ = currentElements.length > 0
          ? Math.max(...currentElements.map(el => el.zIndex ?? 0))
          : 0;
        const baseLayout = {
          align: 'left',
          flow: 'row',
          justify: 'start',
          itemsOrder: 'rarity',
          lockScale: false,
          baseSize: null,
          lockOriginalSize: null,
          gapX: 4,
          gapY: 4,
          rarityLimits: { 0: 0, 1: 0, 2: 0, 3: 0 },
          hideTitle: false,
          matchEnd: {
            blurOnEnd: globalBlurOnMatchEnd,
            showEndTitle: false,
            blurAmount: 6,
            desaturate: 0.6,
            dim: 0.2,
          },
        };
        const layout = type === 'shape-rect'
          ? { ...baseLayout, fillColor: '#000000' }
          : baseLayout;

        const resolvedPlayerId = SHARED_ELEMENT_TYPES.has(type) ? null : playerId;
        
        const newElement = {
          id,
          type,
          position: position || { x: 100, y: 100 },
          size: defaultSize,
          scale: 1,
          opacity: 1,
          zIndex: maxZ + 1,
          layout,
          playerId: resolvedPlayerId,
        };
        
        setWithHistory((state) => ({
          elements: [...state.elements, newElement],
        }));
        
        return id;
      },
      
      removeElement: (id) => setWithHistory((state) => ({
        elements: state.elements.filter(e => e.id !== id),
        selectedElementId: state.selectedElementId === id ? null : state.selectedElementId,
        selectedElementIds: state.selectedElementIds.filter(eId => eId !== id),
        // Remove element from any groups it's in
        groups: state.groups.map(g => ({
          ...g,
          elementIds: g.elementIds.filter(eId => eId !== id),
        })).filter(g => g.elementIds.length >= 2), // Remove groups with less than 2 elements
      })),

      removeElements: (ids) => setWithHistory((state) => {
        const toRemove = new Set(ids);
        return {
          elements: state.elements.filter(e => !toRemove.has(e.id)),
          selectedElementId: null,
          selectedElementIds: [],
          groups: state.groups.map(g => ({
            ...g,
            elementIds: g.elementIds.filter(eId => !toRemove.has(eId)),
          })).filter(g => g.elementIds.length >= 2),
        };
      }),
      
      updateElement: (id, updates) => setWithHistory((state) => ({
        elements: state.elements.map(e => 
          e.id === id ? { ...e, ...updates } : e
        ),
      })),

      bringElementsToFront: (ids) => setWithHistory((state) => {
        if (!ids || ids.length === 0) return null;
        return { elements: reorderZIndexes(state.elements, ids, 'front') };
      }),

      sendElementsToBack: (ids) => setWithHistory((state) => {
        if (!ids || ids.length === 0) return null;
        return { elements: reorderZIndexes(state.elements, ids, 'back') };
      }),

      moveElementsForward: (ids) => setWithHistory((state) => {
        if (!ids || ids.length === 0) return null;
        return { elements: stepZIndexes(state.elements, ids, 'forward') };
      }),

      moveElementsBackward: (ids) => setWithHistory((state) => {
        if (!ids || ids.length === 0) return null;
        return { elements: stepZIndexes(state.elements, ids, 'backward') };
      }),

      bringElementToFront: (id) => get().bringElementsToFront([id]),
      sendElementToBack: (id) => get().sendElementsToBack([id]),
      moveElementForward: (id) => get().moveElementsForward([id]),
      moveElementBackward: (id) => get().moveElementsBackward([id]),
      
      moveElement: (id, position) => setWithHistory((state) => ({
        elements: state.elements.map(e => 
          e.id === id ? { ...e, position } : e
        ),
      })),
      
      resizeElement: (id, size) => setWithHistory((state) => ({
        elements: state.elements.map(e => 
          e.id === id ? { ...e, size } : e
        ),
      })),
      
      scaleElement: (id, scale) => setWithHistory((state) => ({
        elements: state.elements.map(e => 
          e.id === id ? { ...e, scale } : e
        ),
      })),

      undo: () => set((state) => {
        if (state.historyPast.length === 0) return state;
        const previous = state.historyPast[state.historyPast.length - 1];
        const nextFuture = [snapshotState(state), ...state.historyFuture];
        return {
          elements: previous.elements,
          groups: previous.groups,
          historyPast: state.historyPast.slice(0, -1),
          historyFuture: nextFuture,
          selectedElementId: null,
          selectedElementIds: [],
        };
      }),

      redo: () => set((state) => {
        if (state.historyFuture.length === 0) return state;
        const next = state.historyFuture[0];
        const nextPast = [...state.historyPast, snapshotState(state)].slice(-state.historyLimit);
        return {
          elements: next.elements,
          groups: next.groups,
          historyPast: nextPast,
          historyFuture: state.historyFuture.slice(1),
          selectedElementId: null,
          selectedElementIds: [],
        };
      }),
      
      setPlayer1State: (player1State) => set((state) => {
        const nextSnapshot = buildSmartSnapshot(player1State);
        const prevSnapshot = state.smartSnapshots?.player1 || null;
        const nextDiff = prevSnapshot && nextSnapshot ? buildSmartDiff(prevSnapshot, nextSnapshot) : null;
        const nextKillTracking = updateKillTrackingState(
          state.killTracking,
          1,
          player1State?.combat?.killCount
        );
        const nextStageTracking = updateStageTrackingState(
          state.stageTracking,
          1,
          player1State
        );
        return {
          player1State,
          smartSnapshots: {
            ...(state.smartSnapshots || {}),
            player1: nextSnapshot,
          },
          smartDiffs: {
            ...(state.smartDiffs || {}),
            player1: nextDiff,
          },
          killTracking: nextKillTracking,
          stageTracking: nextStageTracking,
        };
      }),
      setPlayer2State: (player2State) => set((state) => {
        const nextSnapshot = buildSmartSnapshot(player2State);
        const prevSnapshot = state.smartSnapshots?.player2 || null;
        const nextDiff = prevSnapshot && nextSnapshot ? buildSmartDiff(prevSnapshot, nextSnapshot) : null;
        const nextKillTracking = updateKillTrackingState(
          state.killTracking,
          2,
          player2State?.combat?.killCount
        );
        const nextStageTracking = updateStageTrackingState(
          state.stageTracking,
          2,
          player2State
        );
        return {
          player2State,
          smartSnapshots: {
            ...(state.smartSnapshots || {}),
            player2: nextSnapshot,
          },
          smartDiffs: {
            ...(state.smartDiffs || {}),
            player2: nextDiff,
          },
          killTracking: nextKillTracking,
          stageTracking: nextStageTracking,
        };
      }),
      
      getResolutionDimensions: () => {
        const { resolution, customResolution } = get();
        if (resolution === 'custom') {
          return customResolution;
        }
        return RESOLUTION_PRESETS[resolution];
      },
      
      getPlayerState: (playerId) => {
        const state = get();
        return playerId === 1 ? state.player1State : state.player2State;
      },
      
      // Get player label based on spectator mode
      getPlayerLabel: (playerId) => {
        const state = get();
        if (state.isSpectator) {
          return playerId === 1 ? 'P1' : 'P2';
        }
        if (state.language === 'ru') {
          return playerId === 1 ? 'Вы' : 'Враг';
        }
        return playerId === 1 ? 'You' : 'Enemy';
      },
    });
    },
    {
      name: 'megabonk-overlay-storage',
      partialize: (state) => ({
        resolution: state.resolution,
        customResolution: state.customResolution,
        gridSize: state.gridSize,
        showGrid: state.showGrid,
        transparentBackground: state.transparentBackground,
        backgroundImageUrl: state.backgroundImageUrl,
        iconScale: state.iconScale,
        elements: state.elements,
        groups: state.groups,
        autoSpectatorMode: state.autoSpectatorMode,
        timeFlowDirection: state.timeFlowDirection,
        sidebarAutoHide: state.sidebarAutoHide,
        advancedSettingsEnabled: state.advancedSettingsEnabled,
        smartInteractionsEnabled: state.smartInteractionsEnabled,
        showElementOutlines: state.showElementOutlines,
        hideElementTitles: state.hideElementTitles,
        spoofEnabled: state.spoofEnabled,
        spoofMatchState: state.spoofMatchState,
        spoofItemCounts: state.spoofItemCounts,
        spoofDiffs: state.spoofDiffs,
        spoofSessionGamesCount: state.spoofSessionGamesCount,
        spoofStageHistory: state.spoofStageHistory,
        savedLayouts: state.savedLayouts,
        settingsSyncMode: state.settingsSyncMode,
        showClippingWarnings: state.showClippingWarnings,
        gridEnabled: state.gridEnabled,
        iconSource: state.iconSource,
        historyLimit: state.historyLimit,
        language: state.language,
        obsHideLabels: state.obsHideLabels,
        globalBlurOnMatchEnd: state.globalBlurOnMatchEnd,
        perPlayerEndBlurEnabled: state.perPlayerEndBlurEnabled,
        statPlainFormat: state.statPlainFormat,
        sessionGameDisplayLimit: state.sessionGameDisplayLimit,
      }),
    }
  )
);

// Expose store to window for Playwright testing
if (typeof window !== 'undefined') {
  window.__overlayStore = useOverlayStore;
}
