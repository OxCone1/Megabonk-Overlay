import { memo, useId, useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useOverlayStore, RARITY_TIERS } from '@/stores/overlayStore';
import { useGameDataStore } from '@/stores/gameDataStore';
import { cn } from '@/lib/utils';
import { resolvePublicAssetPath } from '@/lib/publicAsset';

const DEFAULT_ICON_SIZE = 36;
const ICON_SIZE_ZOOM_FACTOR = 1.6;
const BAN_BADGE_SRC = resolvePublicAssetPath('/Game Icons/Interface/banned.png');
const DEFAULT_KEYFRAMES = {
  fadeIn: 7,
  fadeFull: 15,
  entryEnd: 25,
  badgeStart: 22,
  badgeEnd: 35,
  desaturateStart: 32,
  desaturateEnd: 42,
  jumpStart: 42,
  jumpPeak: 52,
  fallStart: 52.1,
  fadeStart: 52.2,
  fadeEnd: 65,
  fallEnd: 80,
};

const BAN_ANIMATION_DEFAULTS = {
  cycleDurationMs: 4700,
  staggerMs: 300,
  easing: 'cubic-bezier(0.25, 0.8, 0.25, 1)',
  entryOffsetX: '140%',
  entryOffsetY: '0%',
  entryScale: 3,
  exitOffsetX: '0%',
  exitOffsetY: '170%',
  jumpHeight: '-15%',
  badgeSlideDistance: '45%',
  bannedScale: 0.9,
  bannedBrightness: 0.6,
  bannedSaturation: 0.7,
  iconSize: DEFAULT_ICON_SIZE * ICON_SIZE_ZOOM_FACTOR,
  badgeScale: 0.4,
  badgeOffset: 0.13,
  // stacking controls
  stackEnabled: true,
  stackPeriodMs: 1100, // how often a new item can enter when stacking is enabled
  stackGap: 8, // px gap between stacked icons
  stackMax: 3, // limit concurrent stacked items
  keyframes: DEFAULT_KEYFRAMES,
};

const BAN_ANIMATION_COMPACT = {
  cycleDurationMs: 4700,
  staggerMs: 100,
  jumpHeight: '-15%',
  iconSize: DEFAULT_ICON_SIZE * ICON_SIZE_ZOOM_FACTOR,
};

const mergeKeyframes = (base, overrides) => ({
  ...base,
  ...(overrides || {}),
});

const resolveConfig = (compact, overrides) => {
  const keyframes = mergeKeyframes(
    DEFAULT_KEYFRAMES,
    overrides?.keyframes
  );
  return {
    ...BAN_ANIMATION_DEFAULTS,
    ...(compact ? BAN_ANIMATION_COMPACT : {}),
    ...(overrides || {}),
    keyframes,
  };
};

const normalizeId = (entry) => entry?.ingameId ?? entry?.id ?? null;

const AnimatedBanBadge = memo(function AnimatedBanBadge({ size, scale, offset, className, style, animation }) {
  const badgeSize = size * scale;
  const bottomOffset = -size * offset;

  return (
    <img
      src={BAN_BADGE_SRC}
      alt="Banned"
      className={cn('absolute select-none pointer-events-none', className)}
      style={{
        imageRendering: 'pixelated',
        width: badgeSize,
        height: badgeSize,
        bottom: bottomOffset,
        left: '50%',
        transform: 'translateX(-50%)',
        ...animation,
        ...style,
      }}
      draggable={false}
    />
  );
});

const BanPhaseIcon = memo(function BanPhaseIcon({ type, id, rarity, size, showOutlines, iconScale, iconSource }) {
  const { getHeroByIngameId, getLocalHeroByIngameId, getWeaponByIngameId, getLocalWeaponByIngameId, getTomeByIngameId, getLocalTomeByIngameId, getItemByIngameId, getLocalItemByIngameId } = useGameDataStore();

  const scaledSize = size * iconScale;
  const rarityInfo = RARITY_TIERS[rarity] || RARITY_TIERS[0];

  const imageSrc = useMemo(() => {
    if (type === 'hero') {
      const cdn = getHeroByIngameId(id);
      const local = getLocalHeroByIngameId(id);
      return iconSource === 'local' && local?.imageSrc ? local.imageSrc : cdn?.imageSrc;
    }
    if (type === 'weapon') {
      const cdn = getWeaponByIngameId(id);
      const local = getLocalWeaponByIngameId(id);
      return iconSource === 'local' && local?.imageSrc ? local.imageSrc : cdn?.imageSrc;
    }
    if (type === 'tome') {
      const cdn = getTomeByIngameId(id);
      const local = getLocalTomeByIngameId(id);
      return iconSource === 'local' && local?.imageSrc ? local.imageSrc : cdn?.imageSrc;
    }
    const cdn = getItemByIngameId(id);
    const local = getLocalItemByIngameId(id);
    return iconSource === 'local' && local?.imageSrc ? local.imageSrc : cdn?.imageSrc;
  }, [type, id, iconSource, getHeroByIngameId, getLocalHeroByIngameId, getWeaponByIngameId, getLocalWeaponByIngameId, getTomeByIngameId, getLocalTomeByIngameId, getItemByIngameId, getLocalItemByIngameId]);

  const frameClass = type === 'hero' ? 'rounded-full' : 'rounded';
  const frameStyle = type === 'item'
    ? {
      backgroundColor: showOutlines ? `${rarityInfo.color}20` : 'transparent',
      borderColor: showOutlines ? rarityInfo.color : 'transparent',
      borderWidth: showOutlines ? 1 : 0,
    }
    : {
      backgroundColor: showOutlines ? 'rgba(255,255,255,0.08)' : 'transparent',
      borderColor: showOutlines ? 'rgba(255,255,255,0.2)' : 'transparent',
      borderWidth: showOutlines ? 1 : 0,
    };

  return (
    <div
      className={cn('relative flex items-center justify-center', frameClass)}
      style={{
        width: scaledSize,
        height: scaledSize,
        ...frameStyle,
      }}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt=""
          className={cn('w-full h-full select-none', type === 'hero' ? 'object-cover' : 'object-contain p-0.5')}
          style={{ imageRendering: 'pixelated' }}
          draggable={false}
        />
      ) : (
        <span className="text-xs text-white/60">?</span>
      )}
    </div>
  );
});

export const BanPhaseAnimation = memo(function BanPhaseAnimation({ layout, compact = false, overrides, active = true }) {
  const { iconScale, iconSource, showElementOutlines } = useOverlayStore();
  const { heroes, weapons, tomes, items, localImageMap } = useGameDataStore();
  const uniqueId = useId();

  const resolvedOverrides = overrides ?? layout?.banAnimation ?? null;
  const config = useMemo(() => resolveConfig(compact, resolvedOverrides), [compact, resolvedOverrides]);
  const keyframeName = useMemo(() => `ban-phase-${uniqueId.replace(/:/g, '')}`, [uniqueId]);

  const iconPools = useMemo(() => {
    const heroList = localImageMap?.heroes?.length ? localImageMap.heroes : heroes || [];
    const weaponList = localImageMap?.weapons?.length ? localImageMap.weapons : weapons || [];
    const tomeList = localImageMap?.tomes?.length ? localImageMap.tomes : tomes || [];
    const itemList = localImageMap?.items?.length ? localImageMap.items : items || [];

    return {
      heroes: heroList,
      weapons: weaponList,
      tomes: tomeList,
      items: itemList,
    };
  }, [heroes, weapons, tomes, items, localImageMap]);

  const allEntries = useMemo(() => {
    const heroEntries = (iconPools.heroes || [])
      .map(hero => ({ type: 'hero', id: normalizeId(hero) }))
      .filter(entry => entry.id);

    const weaponEntries = (iconPools.weapons || [])
      .map(weapon => ({ type: 'weapon', id: normalizeId(weapon) }))
      .filter(entry => entry.id);

    const tomeEntries = (iconPools.tomes || [])
      .map(tome => ({ type: 'tome', id: normalizeId(tome) }))
      .filter(entry => entry.id);

    const itemEntries = (iconPools.items || [])
      .map(item => ({ type: 'item', id: normalizeId(item), rarity: item?.rarity ?? 0 }))
      .filter(entry => entry.id);

    const combined = [...heroEntries, ...weaponEntries, ...tomeEntries, ...itemEntries];
    const seen = new Set();
    return combined.filter((entry) => {
      const key = `${entry.type}-${entry.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [iconPools]);

  // Random-per-cycle: pick random entries and keep a stack of concurrently animated items
  const [stack, setStack] = useState([]); // [{key, entry, createdAt, removeTimerId}]
  const timersRef = useRef(new Map());
  const lastKeyRef = useRef(null);
  const pickRandomEntry = useCallback((excludeId = null) => {
    if (!Array.isArray(allEntries) || allEntries.length === 0) return null;
    if (allEntries.length === 1) return allEntries[0];

    let attempts = 0;
    let pick = null;
    while (attempts < 8) {
      const idx = Math.floor(Math.random() * allEntries.length);
      pick = allEntries[idx];
      if (!pick) break;
      if (excludeId == null || `${pick.type}-${pick.id}` !== excludeId) break;
      attempts += 1;
    }
    // if still same, allow repetition
    return pick || allEntries[0];
  }, [allEntries]);

  // manage stack: add initial entry and setup stacking timer when enabled
  useEffect(() => {
    if (!active || allEntries.length === 0) return undefined;

    // copy refs for cleanup
    const timers = timersRef.current;
    // clear previous timers
    timers.forEach((id) => clearTimeout(id));
    // schedule clearing stack asynchronously to avoid sync setState in effect
    const clearStackTimeout = setTimeout(() => setStack([]), 0);

    const addEntry = (excludeKey = null) => {
      const entry = pickRandomEntry(excludeKey);
      if (!entry) return null;
      const key = `${entry.type}-${entry.id}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
      const removeAfter = Math.max(0, Math.round(config.cycleDurationMs));

      // limit stack size
      setStack((prev) => {
        const max = Math.max(1, config.stackMax || 5);
        const next = [...prev, { key, entry, createdAt: Date.now() }];
        if (next.length > max) {
          // remove oldest
          const [old, ...rest] = next;
          const id = timers.get(old.key);
          if (id) clearTimeout(id);
          timers.delete(old.key);
          return rest;
        }
        return next;
      });

      // update last key ref for exclusion
      lastKeyRef.current = `${entry.type}-${entry.id}`;

      // schedule removal
      const removeTimer = setTimeout(() => {
        setStack((prev) => prev.filter(s => s.key !== key));
        timers.delete(key);
      }, removeAfter);
      timers.set(key, removeTimer);


      return key;
    };

    // add first entry asynchronously
    const t0 = setTimeout(() => addEntry(null), 0);

    // interval for stacking (uses lastKeyRef to avoid closure over stack)
    const period = Math.max(50, overrides?.stackPeriodMs ?? config.stackPeriodMs ?? config.staggerMs);
    const intervalId = setInterval(() => {
      const currentKey = lastKeyRef.current;
      addEntry(currentKey);
    }, config.stackEnabled ? period : Math.max(200, config.cycleDurationMs));

    return () => {
      clearTimeout(t0);
      clearTimeout(clearStackTimeout);
      if (intervalId) clearInterval(intervalId);
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      setStack([]);
      lastKeyRef.current = null;
    };
  }, [active, allEntries.length, pickRandomEntry, config.stackEnabled, overrides, config.cycleDurationMs, config.stackPeriodMs, config.staggerMs, config.stackMax]);

  const animationStyle = useMemo(() => {
    const k = config.keyframes;
    return `
@keyframes ${keyframeName}-group {
  0% { transform: translateX(var(--entry-x)) translateY(var(--entry-y)) scale(var(--entry-scale)); opacity: 0; }
  6% {opacity: 0;}
  ${k.fadeIn}% { opacity: 0.55; }
  ${k.fadeFull}% { opacity: 0.85; }
  ${k.entryEnd}% { transform: translateX(0) translateY(0) scale(1); opacity: 1;}
  ${k.jumpStart}% { transform: translateX(0) translateY(0) scale(1); opacity: 1; }
  ${k.jumpPeak}% { transform: translateX(0) translateY(var(--jump-height)) scale(1); opacity: 1; }
  ${k.fallStart}% { transform: translateX(0) translateY(var(--jump-height)) scale(1); opacity: 1; }
  ${k.fadeStart}% {  opacity: 0.85; }
  ${k.fadeEnd}% {  opacity: 0; }
  ${k.fallEnd}% { transform: translateX(var(--exit-x)) translateY(var(--exit-y)) scale(1); opacity: 0; }
  100% { transform: translateX(var(--exit-x)) translateY(var(--exit-y)) scale(1); opacity: 0; }
}

@keyframes ${keyframeName}-icon {
  0%, ${k.desaturateStart}% { filter: brightness(1) saturate(1); transform: scale(1); }
  ${k.desaturateEnd}%, 100% { filter: brightness(var(--ban-brightness)) saturate(var(--ban-saturation)); transform: scale(var(--ban-scale)); }
}

@keyframes ${keyframeName}-badge {
  0%, ${k.badgeStart}% { opacity: 0; transform: translate(-50%, var(--badge-slide)); }
  ${k.badgeEnd}%, 100% { opacity: 1; transform: translate(-50%, 0); }
}
`;
  }, [config, keyframeName]);


  return (
    <div
      className="relative w-full h-full overflow-hidden"
      style={{
        minHeight: config.iconSize * iconScale * 2,
        opacity: active ? 1 : 0,
      }}
    >
      <style>{animationStyle}</style>

      <div className="absolute left-1/3 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ pointerEvents: 'none' }}>
        {stack.map((s, idx) => {
          const iconW = config.iconSize * iconScale;
          const gap = (config.stackGap || 0) * iconScale;
          const count = stack.length || 1;
          const totalWidth = count * iconW + Math.max(0, count - 1) * gap;
          const start = -totalWidth / 2 + iconW / 2;
          const x = Math.round(start + idx * (iconW + gap));

          return (
            <div
              key={s.key}
              className="absolute"
              style={{
                left: '50%',
                top: '50%',
                transform: `translate(${x}px, -50%)`,
                transition: `transform 320ms ${config.easing}`,
                pointerEvents: 'none',
              }}
            >
              <div
                className="relative"
                style={{
                  animation: `${keyframeName}-group ${config.cycleDurationMs}ms ${config.easing} both`,
                  animationPlayState: active ? 'running' : 'paused',
                  '--entry-x': config.entryOffsetX,
                  '--entry-y': config.entryOffsetY,
                  '--entry-scale': config.entryScale,
                  '--exit-x': config.exitOffsetX,
                  '--exit-y': config.exitOffsetY,
                  '--jump-height': config.jumpHeight,
                }}
              >
                <div
                  className="relative"
                  style={{
                    animation: `${keyframeName}-icon ${config.cycleDurationMs}ms ${config.easing} both`,
                    animationPlayState: active ? 'running' : 'paused',
                    '--ban-scale': config.bannedScale,
                    '--ban-brightness': config.bannedBrightness,
                    '--ban-saturation': config.bannedSaturation,
                  }}
                >
                  <BanPhaseIcon
                    type={s.entry.type}
                    id={s.entry.id}
                    rarity={s.entry.rarity}
                    size={config.iconSize}
                    showOutlines={showElementOutlines}
                    iconScale={iconScale}
                    iconSource={iconSource}
                  />
                </div>

                <AnimatedBanBadge
                  size={config.iconSize * iconScale}
                  scale={config.badgeScale}
                  offset={config.badgeOffset}
                  animation={{
                    animation: `${keyframeName}-badge ${config.cycleDurationMs}ms ${config.easing} both`,
                    animationPlayState: active ? 'running' : 'paused',
                    '--badge-slide': config.badgeSlideDistance,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
