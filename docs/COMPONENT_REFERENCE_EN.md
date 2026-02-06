# MegaBonk Overlay -- Component Reference (Elements)

This document provides a complete reference for every overlay element type available in MegaBonk Overlay. Each entry describes what the element displays, which data it reads, how the context menu affects it, and its visibility behavior.

---

## Table of Contents

- [General Properties (All Elements)](#general-properties-all-elements)
- [Context Menu Reference (All Elements)](#context-menu-reference-all-elements)
- [Equipment Elements](#equipment-elements)
- [Item Elements](#item-elements)
- [Stats Elements (Grouped)](#stats-elements-grouped)
- [Stats Elements (Individual)](#stats-elements-individual)
- [Combat Elements (Grouped)](#combat-elements-grouped)
- [Combat Elements (Individual)](#combat-elements-individual)
- [Game Info Elements](#game-info-elements)
- [Match Elements](#match-elements)
- [Session Elements](#session-elements)
- [Season Elements](#season-elements)
- [Ban Elements](#ban-elements)
- [Diff Elements](#diff-elements)
- [Shape Elements](#shape-elements)

---

## General Properties (All Elements)

Every overlay element shares these properties:

| Property | Description | Default |
|----------|-------------|---------|
| `id` | Unique element identifier (auto-generated) | `element-{timestamp}-{random}` |
| `type` | Element type string (determines component rendered) | -- |
| `playerId` | Player slot: `1` (you/player 1), `2` (opponent/player 2), or `null` (shared) | Varies by type |
| `position` | `{ x, y }` coordinates on canvas (in pixels) | `{ x: 100, y: 100 }` |
| `size` | `{ width, height }` in pixels | Per-type default |
| `scale` | Visual scale multiplier | `1` |
| `opacity` | Visual opacity (0.0 - 1.0) | `1` |
| `zIndex` | Stacking order (higher = on top) | Auto-incremented |
| `layout.align` | Content alignment within element: `left`, `center`, `right` | `left` |
| `layout.flow` | Flex direction for multi-item elements: `row`, `column` | `row` |
| `layout.justify` | Content justification: `start`, `center`, `end`, `space-between`, `space-around` | `start` |
| `layout.hideTitle` | Whether the element's title is hidden | `false` |
| `layout.title` | Custom title text override | `undefined` (uses default label) |
| `layout.obsVisibility` | OBS visibility mode: `always`, `run`, `off` | `always` |
| `layout.obsVisibilityPhases` | Array of match phases during which element is visible | `undefined` (all phases) |
| `layout.matchEnd.blurOnEnd` | Whether blur effects apply on match end | `false` (follows global setting) |
| `layout.matchEnd.showEndTitle` | Whether to show Victory/Defeat/Draw label on match end | `false` |
| `layout.matchEnd.blurAmount` | Blur strength in pixels (0-16) | `6` |
| `layout.matchEnd.desaturate` | Desaturation amount (0.0-1.0) | `0.6` |
| `layout.matchEnd.dim` | Dimming amount (0.0-1.0) | `0.2` |
| `layout.lockScale` | Lock content scale to base size (content scales proportionally on resize) | `false` |
| `layout.baseSize` | Base size for locked scale calculation | `null` |

### Shared vs Per-Player Elements

Elements are categorized as **per-player** or **shared**:

- **Per-player elements** are assigned to Player 1 or Player 2, displaying data from that specific player's state. They appear in the P1 or P2 sidebar tabs.
- **Shared elements** have `playerId: null` and display data that is common to the match (diffs, match flow, bans, season info, session stats). They appear in both sidebar tabs.

Shared element types: `time-diff`, `difficulty-diff`, `kill-diff`, `match-flow`, `match-search`, `match-ban-selection`, `match-ban-animation`, `match-opponent-wait`, `match-smart`, `session-summary`, `session-current`, `session-rating`, `session-rank`, `session-games`, `season-info`, `season-name`, `season-time-limit`, `season-pause-limit`, `season-start-date`, `season-end-date`, `bans-system`, `bans-player1`, `bans-player2`.

---

## Context Menu Reference (All Elements)

Right-clicking any element opens a context menu. The following options are available for all elements (some with restrictions):

| Menu Item | Description | Availability |
|-----------|-------------|-------------|
| **Export elements** | Copies selected element(s) as an encoded string to clipboard | Always |
| **Remove Element** | Deletes the element (or all selected elements) | Always |
| **Align Content** | Sub-menu: Left / Center / Right -- sets horizontal alignment | Always |
| **Justify Content** | Sub-menu: Start / Center / End / Space Between / Space Around | Always |
| **Flow Direction** | Sub-menu: Row / Column -- sets flex direction | Always |
| **Item Order** | Sub-menu: By Rarity / By Acquisition -- sets item sorting | Only on `item-group` and `rarity-group-*` types |
| **Fields** | Sub-menu: Toggle individual fields on/off | Only on grouped stat/combat elements |
| **Rarity Limits** | Sub-menu: Set max items shown per rarity tier (Auto, 1-5) | Only on `item-group`, `rarity-group-*`, and `bans-*` types |
| **Experimental** | Sub-menu: Horizontal Gap (0-20px), Vertical Gap (0-20px) sliders | Only when Advanced Settings is enabled, and only on item/weapon/tome/bans types |
| **Fill Color** | Color picker for background fill | Only on `shape-rect` type |
| **Text Color** | Color picker for text color | Only on Season elements |
| **OBS Visibility** | Sub-menu: Off / Always / During Your Run / Per-phase toggles (Idle, Searching, Acceptance, Ban Phase, Game, Match End) | Always |
| **Scale** | Slider: 0.25x - 2.0x | Always |
| **Opacity** | Slider: 0% - 100% | Always |
| **Match End Effects** | Sub-menu: Blur on end (on/off), Show end title (on/off), Blur Amount (0-16px), Desaturate (0-100%), Dim (0-100%) | Always |
| **Edit Title** | Sub-menu: Set Title (dialog), Clear Title, Show/Hide Title | Always |
| **Edit Label** | Sub-menu: Set Label (dialog), Clear Label, Show/Hide Label | Only on `stats-individual` and `combat-individual` category elements |
| **Event Position** | Sub-menu: Above Timer / Below Timer | Only on `stage-state` element |
| **Z-Index** | Sub-menu: Bring to Front / Send to Back / Move Forward / Move Backward | Always |
| **Add to Group** | Sub-menu listing existing groups; adds ungrouped selected elements to a group | When groups exist |
| **Group Selected** | Groups all selected elements (requires 2+ ungrouped selected) | Multi-selection only |
| **Ungroup** | Removes element from its group | Only when element is in a group |

---

## Equipment Elements

### Hero (`hero`)

| Property | Value |
|----------|-------|
| Category | `equipment` |
| Default Size | 120 x 140 px |
| Per-Player | Yes |
| Data Source | `playerState.character.id` resolved via `gameDataStore` hero lookup |
| Displays | Hero icon image, optionally hero name |
| Icon Source | Local (`/Game Icons/Heroes/{name}.webp`) or CDN (from game API `imageSrc` field) |

### Weapons (`weapons`)

| Property | Value |
|----------|-------|
| Category | `equipment` |
| Default Size | 200 x 80 px |
| Per-Player | Yes |
| Data Source | `playerState.equipment.weapons` array |
| Displays | Row/column of weapon icons with level indicator |
| Icon Source | Local or CDN weapon images |
| Context Menu Extras | Flow direction, alignment, gap settings (experimental) |

### Tomes (`tomes`)

| Property | Value |
|----------|-------|
| Category | `equipment` |
| Default Size | 280 x 80 px |
| Per-Player | Yes |
| Data Source | `playerState.equipment.tomes` array |
| Displays | Row/column of tome icons with level indicator |
| Icon Source | Local or CDN tome images |
| Context Menu Extras | Flow direction, alignment, gap settings (experimental) |

### Bonk Classic (`bonk-classic`)

| Property | Value |
|----------|-------|
| Category | `equipment` |
| Default Size | 280 x 170 px |
| Per-Player | Yes |
| Data Source | `playerState.equipment.weapons` + `playerState.equipment.tomes` |
| Displays | Combined layout: weapons row on top, tomes row below (classic stacked view) |

---

## Item Elements

### All Items (`item-group`)

| Property | Value |
|----------|-------|
| Category | `items` |
| Default Size | 450 x 300 px |
| Per-Player | Yes |
| Data Source | `playerState.equipment.items` array |
| Displays | All items grouped by rarity tier with rarity-colored borders. Items sorted by rarity (Common -> Rare -> Epic -> Legendary) or by acquisition order. |
| Context Menu Extras | Item Order (rarity/acquisition), Rarity Limits (max items per tier), Flow, Alignment, Gap |
| Overflow | Visible (content can extend beyond element bounds) |

### Common Items (`rarity-group-common`)

| Property | Value |
|----------|-------|
| Category | `items` |
| Default Size | 200 x 60 px |
| Per-Player | Yes |
| Data Source | `playerState.equipment.items` filtered to rarity `0` (Common/Green) |
| Displays | Only common (green) items with count indicators |

### Rare Items (`rarity-group-rare`)

Same structure as Common Items but filters to rarity `1` (Rare/Blue).

### Epic Items (`rarity-group-epic`)

Same structure as Common Items but filters to rarity `2` (Epic/Purple).

### Legendary Items (`rarity-group-legendary`)

Same structure as Common Items but filters to rarity `3` (Legendary/Gold).

---

## Stats Elements (Grouped)

Grouped stat elements display multiple related stats in a single element. Each stat within the group can be individually toggled on/off via the **Fields** context menu.

### Health Stats (`stats-health`)

| Property | Value |
|----------|-------|
| Category | `stats` |
| Default Size | 180 x 120 px |
| Per-Player | Yes |
| Data Source | `playerState.character.stats` |
| Fields | Max HP, Regen, Shield, Overheal, Healing Multiplier, Lifesteal |

### Damage Stats (`stats-damage`)

| Property | Value |
|----------|-------|
| Category | `stats` |
| Default Size | 180 x 140 px |
| Per-Player | Yes |
| Data Source | `playerState.character.stats` |
| Fields | Damage Multiplier, Attack Speed, Crit Chance, Crit Damage, Projectiles, Bounces, Size |

### Defense Stats (`stats-defense`)

| Property | Value |
|----------|-------|
| Category | `stats` |
| Default Size | 180 x 100 px |
| Per-Player | Yes |
| Data Source | `playerState.character.stats` |
| Fields | Armor, Evasion, Thorns, Damage Reduction, Fall Damage Reduction |

### Utility Stats (`stats-utility`)

| Property | Value |
|----------|-------|
| Category | `stats` |
| Default Size | 180 x 120 px |
| Per-Player | Yes |
| Data Source | `playerState.character.stats` |
| Fields | Move Speed, Jump Height, Extra Jumps, Pickup Range, Duration, Projectile Speed |

### Economy Stats (`stats-economy`)

| Property | Value |
|----------|-------|
| Category | `stats` |
| Default Size | 180 x 120 px |
| Per-Player | Yes |
| Data Source | `playerState.character.stats` |
| Fields | Gold Multiplier, XP Multiplier, Silver Multiplier, Luck, Chest Multiplier, Shop Discount |

### Enemy Stats (`stats-enemy`)

| Property | Value |
|----------|-------|
| Category | `stats` |
| Default Size | 180 x 120 px |
| Per-Player | Yes |
| Data Source | `playerState.character.stats` |
| Fields | Difficulty, Elite Spawn, Enemy Amount, Enemy Size, Enemy Speed, Enemy HP, Enemy Damage |

---

## Stats Elements (Individual)

Individual stat elements display a single stat value. They support the **Edit Label** context menu to override the stat name and **Hide Label** to show only the value.

All individual stat elements share:
- Category: `stats-individual`
- Default Size: 120 x 40 px
- Per-Player: Yes
- Data Source: `playerState.character.stats`

| Element Type | Label | Stat Key |
|-------------|-------|----------|
| `stat-maxhealth` | Max Health | `maxHealth` |
| `stat-healthregen` | Health Regen | `healthRegen` |
| `stat-shield` | Shield | `shield` |
| `stat-overheal` | Overheal | `overheal` |
| `stat-healingmultiplier` | Healing Multi | `healingMultiplier` |
| `stat-lifesteal` | Lifesteal | `lifesteal` |
| `stat-damagemultiplier` | Damage Multi | `damageMultiplier` |
| `stat-attackspeed` | Attack Speed | `attackSpeed` |
| `stat-critchance` | Crit Chance | `critChance` |
| `stat-critdamage` | Crit Damage | `critDamage` |
| `stat-projectiles` | Projectiles | `projectiles` |
| `stat-projectilebounces` | Bounces | `projectileBounces` |
| `stat-projectilespeedmultiplier` | Proj Speed | `projectileSpeedMultiplier` |
| `stat-armor` | Armor | `armor` |
| `stat-evasion` | Evasion | `evasion` |
| `stat-thorns` | Thorns | `thorns` |
| `stat-damagereductionmultiplier` | Dmg Reduction | `damageReductionMultiplier` |
| `stat-firedamage` | Fire Damage | `fireDamage` |
| `stat-icedamage` | Ice Damage | `iceDamage` |
| `stat-lightningdamage` | Lightning Dmg | `lightningDamage` |
| `stat-burnchance` | Burn Chance | `burnChance` |
| `stat-freezechance` | Freeze Chance | `freezeChance` |
| `stat-movespeedmultiplier` | Move Speed | `moveSpeedMultiplier` |
| `stat-jumpheight` | Jump Height | `jumpHeight` |
| `stat-extrajumps` | Extra Jumps | `extraJumps` |
| `stat-pickuprange` | Pickup Range | `pickupRange` |
| `stat-sizemultiplier` | Size | `sizeMultiplier` |
| `stat-durationmultiplier` | Duration | `durationMultiplier` |
| `stat-knockbackmultiplier` | Knockback | `knockbackMultiplier` |
| `stat-luck` | Luck | `luck` |
| `stat-goldincreasemultiplier` | Gold Multi | `goldIncreaseMultiplier` |
| `stat-xpincreasemultiplier` | XP Multi | `xpIncreaseMultiplier` |
| `stat-silverincreasemultiplier` | Silver Multi | `silverIncreaseMultiplier` |
| `stat-chestincreasemultiplier` | Chest Multi | `chestIncreaseMultiplier` |
| `stat-chestpricemultiplier` | Chest Price | `chestPriceMultiplier` |
| `stat-shoppricereduction` | Shop Discount | `shopPriceReduction` |
| `stat-powerupboostmultiplier` | Powerup Boost | `powerupBoostMultiplier` |
| `stat-powerupchance` | Powerup Chance | `powerupChance` |
| `stat-difficulty` | Difficulty | `difficulty` |
| `stat-difficulty-icon` | Difficulty (Icon) | `difficulty` (with skull icon label) |
| `stat-elitespawnincrease` | Elite Spawn | `eliteSpawnIncrease` |
| `stat-enemyamountmultiplier` | Enemy Amount | `enemyAmountMultiplier` |
| `stat-enemysizemultiplier` | Enemy Size | `enemySizeMultiplier` |
| `stat-enemyspeedmultiplier` | Enemy Speed | `enemySpeedMultiplier` |
| `stat-enemyhpmultiplier` | Enemy HP | `enemyHpMultiplier` |
| `stat-enemydamagemultiplier` | Enemy Damage | `enemyDamageMultiplier` |
| `stat-enemyscalingmultiplier` | Enemy Scaling | `enemyScalingMultiplier` |
| `stat-elitedamagemultiplier` | Elite Damage | `eliteDamageMultiplier` |
| `stat-holiness` | Holiness | `holiness` |
| `stat-wickedness` | Wickedness | `wickedness` |
| `stat-evolve` | Evolve | `evolve` |
| `stat-weaponburstcooldown` | Burst CD | `weaponBurstCooldown` |
| `stat-damagecooldownmultiplier` | Dmg CD Multi | `damageCooldownMultiplier` |
| `stat-effectdurationmultiplier` | Effect Duration | `effectDurationMultiplier` |
| `stat-falldamagereduction` | Fall Dmg Red | `fallDamageReduction` |
| `stat-slam` | Slam | `slam` |

---

## Combat Elements (Grouped)

### Combat Stats (`combat-stats`)

| Property | Value |
|----------|-------|
| Category | `combat` |
| Default Size | 200 x 140 px |
| Per-Player | Yes |
| Data Source | `playerState.combat` |
| Fields (toggleable) | Kills, Gold, Damage Dealt, Damage Taken |

### Shrine Stats (`shrine-stats`)

| Property | Value |
|----------|-------|
| Category | `combat` |
| Default Size | 200 x 160 px |
| Per-Player | Yes |
| Data Source | `playerState.combat.shrines` |
| Fields (toggleable) | Balance, Greed, Challenge, Cursed, Magnet, Moai, Charge, Golden Charge |

### Game Stats (`game-stats`)

| Property | Value |
|----------|-------|
| Category | `combat` |
| Default Size | 240 x 200 px |
| Per-Player | Yes |
| Data Source | `playerState.combat.gameStats` |
| Fields (toggleable) | Gold Earned, Gold Spent, XP Gained, Elite Kills, Boss Kills, Miniboss Kills, Skeleton Kills, Goblin Kills, Fire Kills, Lightning Kills, Crits, Evades, Projectiles Fired, Items Picked Up, Chests Opened, Chests Bought, Pots Broken, Powerups Used |

### Damage Sources (`damage-sources`)

| Property | Value |
|----------|-------|
| Category | `combat` |
| Default Size | 220 x 180 px |
| Per-Player | Yes |
| Data Source | `playerState.combat.damageSources` |
| Displays | Damage breakdown by weapon/source with percentages |

---

## Combat Elements (Individual)

Individual combat stat elements. Support **Hide Label** context menu.

All share:
- Category: `combat-individual`
- Default Size: 120 x 40 px (some are 140 x 40)
- Per-Player: Yes

| Element Type | Label | Data Source |
|-------------|-------|------------|
| `combat-killcount` | Kill Count | `combat.killCount` |
| `combat-killtick` | Kill Tick | Kill tracking history (last 10 samples, computed delta per tick) |
| `combat-currentgold` | Current Gold | `combat.currentGold` |
| `combat-totaldamagedealt` | Damage Dealt | `combat.totalDamageDealt` |
| `combat-totaldamagetaken` | Damage Taken | `combat.totalDamageTaken` |
| `combat-chestsnormal` | Normal Chests | `combat.chests.normal` |
| `combat-chestscorrupt` | Corrupt Chests | `combat.chests.corrupt` |
| `combat-chestsfree` | Free Chests | `combat.chests.free` |
| `combat-shrinebalance` | Balance Shrines | `combat.shrines.balance` |
| `combat-shrinegreed` | Greed Shrines | `combat.shrines.greed` |
| `combat-shrinechallenge` | Challenge Shrines | `combat.shrines.challenge` |
| `combat-shrinecursed` | Cursed Shrines | `combat.shrines.cursed` |
| `combat-shrinemagnet` | Magnet Shrines | `combat.shrines.magnet` |
| `combat-shrinemoai` | Moai Shrines | `combat.shrines.moai` |
| `combat-shrinechargenormal` | Charge Shrines | `combat.shrines.charge` |
| `combat-shrinechargegolden` | Golden Charges | `combat.shrines.goldenCharge` |
| `combat-goldearned` | Gold Earned | `combat.gameStats.goldEarned` |
| `combat-goldspent` | Gold Spent | `combat.gameStats.goldSpent` |
| `combat-silverearned` | Silver Earned | `combat.gameStats.silverEarned` |
| `combat-xpgained` | XP Gained | `combat.gameStats.xpGained` |
| `combat-elitekills` | Elite Kills | `combat.gameStats.eliteKills` |
| `combat-bosskills` | Boss Kills | `combat.gameStats.bossKills` |
| `combat-minibosskills` | Miniboss Kills | `combat.gameStats.minibossKills` |
| `combat-finalbosskills` | Final Boss Kills | `combat.gameStats.finalBossKills` |
| `combat-crits` | Critical Hits | `combat.gameStats.crits` |
| `combat-evades` | Evades | `combat.gameStats.evades` |
| `combat-projectilesfired` | Projectiles Fired | `combat.gameStats.projectilesFired` |
| `combat-lifestealhealing` | Lifesteal Heals | `combat.gameStats.lifestealHealing` |
| `combat-itemspickedup` | Items Picked | `combat.gameStats.itemsPickedUp` |
| `combat-chestsopened` | Chests Opened | `combat.gameStats.chestsOpened` |
| `combat-chestsbought` | Chests Bought | `combat.gameStats.chestsBought` |
| `combat-potsbroken` | Pots Broken | `combat.gameStats.potsBroken` |
| `combat-powerupsused` | Powerups Used | `combat.gameStats.powerupsUsed` |

---

## Game Info Elements

### Game Time (`game-time`)

| Property | Value |
|----------|-------|
| Category | `game-info` |
| Default Size | 160 x 80 px |
| Per-Player | Yes |
| Data Source | `playerState.timeElapsed`, `playerState.isPaused`, `playerState.pauseTime`, season time limit |
| Displays | Elapsed time or remaining time (based on Timer Direction setting), pause indicator |
| Behavior | Timer direction controlled by global `timeFlowDirection` setting. When set to "remaining", counts down from season time limit. |

### Level (`game-level`)

| Property | Value |
|----------|-------|
| Category | `game-info` |
| Default Size | 100 x 40 px |
| Per-Player | Yes |
| Data Source | `playerState.character.level` |
| Displays | Current character level number |

### Pause Limit (`pause-limit`)

| Property | Value |
|----------|-------|
| Category | `game-info` |
| Default Size | 140 x 48 px |
| Per-Player | Yes |
| Data Source | Season `pauseLimit` |
| Displays | Total allowed pause time for the season |

### Pause Remaining (`pause-remaining`)

| Property | Value |
|----------|-------|
| Category | `game-info` |
| Default Size | 160 x 48 px |
| Per-Player | Yes |
| Data Source | Season `pauseLimit` minus `playerState.pauseTime` |
| Displays | Remaining pause time available |

### Stage State (`stage-state`)

| Property | Value |
|----------|-------|
| Category | `game-info` |
| Default Size | 200 x 80 px |
| Per-Player | Yes |
| Data Source | Stage tracking system (`stageTracking` in overlayStore) |
| Displays | Current stage timer with event labels (Boss Spawn, Final Swarm, stage name). Timer counts up or down depending on stage context. |
| Context Menu Extras | Event Position: Above Timer / Below Timer |
| Special Behavior | Uses `level_timings.json` to determine boss spawn times and swarm durations. Detects stage transitions via kill count changes and map tier/stage changes. Labels fade out after a configurable duration. |

### Stage History (`stage-history`)

| Property | Value |
|----------|-------|
| Category | `game-info` |
| Default Size | 220 x 120 px |
| Per-Player | Yes |
| Data Source | Stage tracking system history (last 4 stages) |
| Displays | List of previous stages with exit time, kill count, and difficulty percentage for each stage |

### Smart Interactions (`smart-interactions`)

| Property | Value |
|----------|-------|
| Category | `game-info` |
| Default Size | 240 x 300 px |
| Per-Player | Yes |
| Data Source | `smartDiffs` in overlayStore (computed diffs between consecutive game state snapshots) |
| Displays | Animated notification entries showing stat changes, item pickups, weapon/tome level-ups |
| Requirements | Must enable "Smart Interactions" in Advanced Settings |
| Behavior | Compares consecutive player state snapshots. Detects changes in stats (scalar diff), shrines (scalar diff), weapons/tomes (inventory diff: added/removed/level changes), items (inventory diff: added/removed/count changes). Each detected change produces an animated notification that slides in and fades out. |

---

## Match Elements

### Time Diff (`time-diff`)

| Property | Value |
|----------|-------|
| Category | `match` |
| Default Size | 120 x 48 px |
| Per-Player | No (shared) |
| Data Source | `player1State.timeElapsed` vs `player2State.timeElapsed` |
| Displays | Time difference between players in seconds (positive = player 1 ahead) |

### Difficulty Diff (`difficulty-diff`)

| Property | Value |
|----------|-------|
| Category | `match` |
| Default Size | 140 x 48 px |
| Per-Player | No (shared) |
| Data Source | `player1State.character.stats.difficulty` vs `player2State.character.stats.difficulty` |
| Displays | Difficulty percentage difference between players |

### Kill Diff (`kill-diff`)

| Property | Value |
|----------|-------|
| Category | `match` |
| Default Size | 120 x 48 px |
| Per-Player | No (shared) |
| Data Source | `player1State.combat.killCount` vs `player2State.combat.killCount` |
| Displays | Kill count difference (positive = player 1 has more kills) |

### Match Flow (`match-flow`)

| Property | Value |
|----------|-------|
| Category | `match` |
| Default Size | 220 x 120 px |
| Per-Player | No (shared) |
| Data Source | `queueState`, `roomMeta` |
| Displays | Match lifecycle status: queue position, match found notification, acceptance status, ban phase, game in progress, match result |

### Match Search (`match-search`)

| Property | Value |
|----------|-------|
| Category | `match` |
| Default Size | 220 x 140 px |
| Per-Player | No (shared) |
| Data Source | `queueState` |
| Displays | Queue search timer with animated loader. Shows elapsed queue time, queue size, and status. |
| Visibility | Typically visible during `searching` phase |

### Ban Selection (`match-ban-selection`)

| Property | Value |
|----------|-------|
| Category | `match` |
| Default Size | 220 x 100 px |
| Per-Player | No (shared) |
| Data Source | `roomMeta` (ban readiness status) |
| Displays | Ban phase status showing which players have confirmed their bans |

### Ban Animation (`match-ban-animation`)

| Property | Value |
|----------|-------|
| Category | `match` |
| Default Size | 220 x 120 px |
| Per-Player | No (shared) |
| Data Source | `roomMeta`, `roomBans` |
| Displays | Animated "VS" screen during ban selection phase with hero/weapon previews for both players |

### Opponent Wait (`match-opponent-wait`)

| Property | Value |
|----------|-------|
| Category | `match` |
| Default Size | 220 x 80 px |
| Per-Player | No (shared) |
| Data Source | `roomMeta` (player run data availability) |
| Displays | "Waiting for opponent data..." message when opponent's game data has not yet arrived |

### Smart Matchmaking (`match-smart`)

| Property | Value |
|----------|-------|
| Category | `match` |
| Default Size | 240 x 200 px |
| Per-Player | No (shared) |
| Data Source | `queueState`, `roomMeta`, `roomBans` |
| Displays | Composite element combining Match Search, Ban Selection/Animation, and Opponent Wait into a single smart element that shows the appropriate view based on current match phase |

### Match End (`match-end`)

| Property | Value |
|----------|-------|
| Category | `match-player` |
| Default Size | 200 x 60 px |
| Per-Player | Yes |
| Data Source | `roomMeta` (winner ID, game status, phase) |
| Displays | Per-player match end status: Victory, Defeat, Draw, Death, Finished, Time Ended, Abandoned, Cancelled |

---

## Session Elements

All session elements are shared (no per-player assignment).

### Session Summary (`session-summary`)

| Property | Value |
|----------|-------|
| Category | `session` |
| Default Size | 260 x 110 px |
| Data Source | `sessionStats` (from relay server session tracking) |
| Displays | Start rating vs current rating, start rank vs current rank, total rating change |

### Session Current (`session-current`)

| Property | Value |
|----------|-------|
| Category | `session` |
| Default Size | 200 x 110 px |
| Data Source | `sessionStats.currentRating`, `sessionStats.currentRank` |
| Displays | Current rating and rank with delta change from session start |

### Session Rating (`session-rating`)

| Property | Value |
|----------|-------|
| Category | `session` |
| Default Size | 160 x 60 px |
| Data Source | `sessionStats.currentRating` |
| Displays | Current session rating value |

### Session Rank (`session-rank`)

| Property | Value |
|----------|-------|
| Category | `session` |
| Default Size | 160 x 60 px |
| Data Source | `sessionStats.currentRank` |
| Displays | Current session rank |

### Session Games (`session-games`)

| Property | Value |
|----------|-------|
| Category | `session` |
| Default Size | 260 x 140 px |
| Data Source | `sessionStats.games` array |
| Displays | Recent game results with rating delta per game. Number of games shown is controlled by the Session Games Limit setting (default: 10, max: 100). |

---

## Season Elements

All season elements are shared.

### Season Info (`season-info`)

| Property | Value |
|----------|-------|
| Category | `season` |
| Default Size | 220 x 140 px |
| Data Source | `seasonInfo` (from relay server `/api/season`) |
| Displays | Season name, time limit, pause limit, start date, end date |
| Context Menu Extras | Text Color picker |

### Season Name (`season-name`)

| Property | Value |
|----------|-------|
| Category | `season` |
| Default Size | 200 x 40 px |
| Data Source | `seasonInfo.name` |
| Context Menu Extras | Text Color picker |

### Season Time Limit (`season-time-limit`)

| Property | Value |
|----------|-------|
| Category | `season` |
| Default Size | 200 x 40 px |
| Data Source | `seasonInfo.timeLimit` |
| Displays | Time limit formatted as minutes:seconds |
| Context Menu Extras | Text Color picker |

### Season Pause Limit (`season-pause-limit`)

| Property | Value |
|----------|-------|
| Category | `season` |
| Default Size | 200 x 40 px |
| Data Source | `seasonInfo.pauseLimit` |
| Displays | Pause limit formatted as minutes:seconds |
| Context Menu Extras | Text Color picker |

### Season Start Date (`season-start-date`)

| Property | Value |
|----------|-------|
| Category | `season` |
| Default Size | 200 x 40 px |
| Data Source | `seasonInfo.startDate` |
| Context Menu Extras | Text Color picker |

### Season End Date (`season-end-date`)

| Property | Value |
|----------|-------|
| Category | `season` |
| Default Size | 200 x 40 px |
| Data Source | `seasonInfo.endDate` |
| Context Menu Extras | Text Color picker |

---

## Ban Elements

All ban elements are shared.

### Room Bans (`bans-system`)

| Property | Value |
|----------|-------|
| Category | `bans` |
| Default Size | 280 x 140 px |
| Data Source | `roomBans.system` |
| Displays | System/room-wide banned entities: heroes, weapons, tomes, items (grouped by rarity). Shows ban badge on each icon. |
| Context Menu Extras | Rarity Limits, Item Order, Flow, Alignment, Gap (experimental) |
| Overflow | Visible |

### Player 1 Bans (`bans-player1`)

| Property | Value |
|----------|-------|
| Category | `bans` |
| Default Size | 280 x 140 px |
| Data Source | `roomBans.player1` |
| Displays | Bans that apply TO player 1 (set BY player 2). Shows banned heroes, weapons, tomes, items with ban badges. |
| Important | Due to ban inversion logic, `roomBans.player1` contains the bans that restrict player 1, which were selected by player 2. |

### Player 2 Bans (`bans-player2`)

Same structure as Player 1 Bans but displays `roomBans.player2` (bans that apply TO player 2, set BY player 1).

---

## Diff Elements

All diff elements are shared.

### Time Diff (`time-diff`)

See [Match Elements > Time Diff](#time-diff).

### Difficulty Diff (`difficulty-diff`)

See [Match Elements > Difficulty Diff](#difficulty-diff).

### Kill Diff (`kill-diff`)

See [Match Elements > Kill Diff](#kill-diff).

---

## Shape Elements

### Color Block (`shape-rect`)

| Property | Value |
|----------|-------|
| Category | `shapes` |
| Default Size | 200 x 200 px |
| Per-Player | Yes |
| Data Source | None (pure visual element) |
| Displays | Solid color rectangle. Useful as a background behind other elements. |
| Context Menu Extras | Fill Color picker |
| Default Fill Color | `#000000` (black) |

---

## OBS Visibility Phases

Elements can be configured to appear only during specific match phases via the **OBS Visibility** context menu. The available phases are:

| Phase Key | Label | Active When |
|-----------|-------|-------------|
| `idle` | Out of Match | No queue, no room, no game |
| `searching` | Searching | In matchmaking queue |
| `acceptance` | Match Accept | Match found, waiting for acceptance |
| `ban_selection` | Ban Phase | In ban selection phase |
| `game` | Game | Game is in progress |
| `ended` | Match End | Match has ended, cancelled, or player has died/finished |

Additionally, the **During Your Run** (`run`) visibility mode only shows the element while the current user's run is active (not ended/cancelled/died).

When **OBS Overlay Mode** is active and an element's visibility conditions are not met, the element's opacity is set to `0` (fully transparent) rather than being removed from the DOM.

---

## Match End Behavior

When a match ends (or a player's run ends during a game):

1. Elements in categories `equipment`, `items`, `stats`, `stats-individual`, `combat`, `combat-individual`, `game-info`, and `bans` can have match end effects applied.
2. If `blurOnEnd` is enabled for an element, the following CSS filter is applied: `blur({blurAmount}px) saturate({1-desaturate}) brightness({1-dim})`.
3. If `showEndTitle` is enabled, a Victory/Defeat/Draw/Death label is overlaid on the element.
4. The match end state is active for 2.5 seconds, then fades out over 0.5 seconds.
5. Per-player run end (death during a game while the match continues) applies blur effects but does not fully fade the element.
6. Per-player end blur can be enabled/disabled independently for each player slot.

---

*This document covers all 80+ element types available in MegaBonk Overlay v1.0.3.*
*Last Updated: February 2026*


