import { memo, useMemo } from 'react';
import { useOverlayStore } from '@/stores/overlayStore';
import { useGameDataStore } from '@/stores/gameDataStore';
import { useI18n } from '@/lib/i18n';

const MAX_WEAPONS = 4;
const MAX_TOMES = 4;
const BONK_CLASSIC_TILE = 60;
const BONK_CLASSIC_PADDING = 7;
const BONK_CLASSIC_SECTION_GAP = 10;

// Memoized WeaponIcon component to prevent unnecessary re-renders
const WeaponIcon = memo(function WeaponIcon({ weaponId, level, size = 40, isShadow = false }) {
  const { iconScale, iconSource, showElementOutlines } = useOverlayStore();
  const { getWeaponByIngameId, getLocalWeaponByIngameId } = useGameDataStore();
  const { t, tGameData } = useI18n();
  
  const cdnWeapon = getWeaponByIngameId(weaponId);
  const localWeapon = getLocalWeaponByIngameId(weaponId);
  
  // Determine which image source to use
  const imageSrc = iconSource === 'local' && localWeapon?.imageSrc
    ? localWeapon.imageSrc
    : cdnWeapon?.imageSrc;
  
  const rawWeaponName = cdnWeapon?.name || localWeapon?.name || `Weapon ${weaponId}`;
  const weaponName = tGameData('weapons', rawWeaponName, rawWeaponName);
  
  const scaledSize = size * iconScale;
  const levelFontSize = scaledSize * 0.3;
  
  return (
    <div className={`flex flex-col items-center gap-0.5 ${isShadow ? 'opacity-40 grayscale obs-hide-shadow' : ''}`}>
      <div 
        className={`relative flex items-center justify-center rounded ${showElementOutlines ? 'bg-orange-500/20 border border-orange-500/50' : ''}`}
        style={{ width: scaledSize, height: scaledSize, borderWidth: showElementOutlines ? 1 : 0, borderColor: showElementOutlines ? 'rgba(249, 115, 22, 0.5)' : 'transparent' }}
        title={weaponName}
      >
        {imageSrc ? (
          <img 
            src={imageSrc} 
            alt={weaponName}
            className="w-full h-full object-contain p-1 select-none"
            draggable={false}
          />
        ) : (
          <span className="text-xs text-white/60">?</span>
        )}
        {level != null && !isShadow && (
          <span
            className="absolute flex items-center justify-center text-white leading-none text-nowrap alagard-numeric"
            style={{
              fontSize: `${levelFontSize}px`,
              left: '50%',
              bottom: 0,
              transform: 'translate(-50%, 50%)',
              padding: '0 4px',
              filter: 'drop-shadow(1px 1px 0px rgba(0, 0, 0, 1))',
            }}
          >
            {t('lvlShort', 'LVL')} {level}
          </span>
        )}
      </div>
    </div>
  );
});

export function WeaponElement({ playerId, layout }) {
  const { getPlayerState } = useOverlayStore();
  const { weapons: cdnWeapons, localImageMap } = useGameDataStore();
  const playerState = getPlayerState(playerId);
  
  const weapons = useMemo(() => playerState?.equipment?.weapons || [], [playerState]);
  const shadowWeaponIds = useMemo(() => {
    const sourceWeapons = localImageMap?.weapons?.length ? localImageMap.weapons : cdnWeapons || [];
    return sourceWeapons.slice(0, MAX_WEAPONS).map(w => w.ingameId);
  }, [cdnWeapons, localImageMap]);

  const weaponEntries = useMemo(() => {
    const realEntries = weapons.map(w => ({ id: w.id, level: w.level, isShadow: false }));
    const needed = Math.max(0, MAX_WEAPONS - realEntries.length);
    const shadowEntries = shadowWeaponIds.slice(0, needed).map(id => ({ id, level: null, isShadow: true }));
    return [...realEntries, ...shadowEntries];
  }, [weapons, shadowWeaponIds]);
  const align = layout?.align || 'left';
  const flow = layout?.flow || 'row';
  const isRow = flow !== 'column';
  const justifyContent = isRow
    ? (align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start')
    : 'flex-start';
  const alignItems = !isRow
    ? (align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start')
    : 'center';
  
  const columnGap = layout?.gapX ?? 4;
  const rowGap = layout?.gapY ?? 4;

  return (
    <div className="p-2 h-full flex">
      <div
        className="flex"
        style={{
          flexDirection: isRow ? 'row' : 'column',
          flexWrap: isRow ? 'wrap' : 'nowrap',
          justifyContent,
          alignItems,
          columnGap,
          rowGap,
          width: '100%'
        }}
      >
        {weaponEntries.map((weapon, idx) => (
          <WeaponIcon 
            key={`${weapon.id}-${idx}`} 
            weaponId={weapon.id} 
            level={weapon.level}
            isShadow={weapon.isShadow}
            size={36}
          />
        ))}
      </div>
    </div>
  );
}

// Memoized TomeIcon component to prevent unnecessary re-renders
const TomeIcon = memo(function TomeIcon({ tomeId, level, size = 36, isShadow = false }) {
  const { iconScale, iconSource, showElementOutlines } = useOverlayStore();
  const { getTomeByIngameId, getLocalTomeByIngameId } = useGameDataStore();
  const { t, tGameData } = useI18n();
  
  const cdnTome = getTomeByIngameId(tomeId);
  const localTome = getLocalTomeByIngameId(tomeId);
  
  // Determine which image source to use
  const imageSrc = iconSource === 'local' && localTome?.imageSrc
    ? localTome.imageSrc
    : cdnTome?.imageSrc;
  
  const rawTomeName = cdnTome?.name || localTome?.name || `Tome ${tomeId}`;
  const tomeName = tGameData('tomes', rawTomeName, rawTomeName);
  
  const scaledSize = size * iconScale;
  const levelFontSize = scaledSize * 0.3;
  
  return (
    <div className={`flex flex-col items-center gap-0.5 ${isShadow ? 'opacity-40 grayscale obs-hide-shadow' : ''}`}>
      <div 
        className={`relative flex items-center justify-center rounded ${showElementOutlines ? 'bg-purple-500/20 border border-purple-500/50' : ''}`}
        style={{ width: scaledSize, height: scaledSize, borderWidth: showElementOutlines ? 1 : 0, borderColor: showElementOutlines ? 'rgba(168, 85, 247, 0.5)' : 'transparent' }}
        title={tomeName}
      >
        {imageSrc ? (
          <img 
            src={imageSrc} 
            alt={tomeName}
            className="w-full h-full object-contain p-0.5 select-none"
            draggable={false}
          />
        ) : (
          <span className="text-xs text-white/60">?</span>
        )}
        {level != null && !isShadow && (
          <span
            className="absolute flex items-center justify-center text-white leading-none text-nowrap alagard-numeric"
            style={{
              fontSize: `${levelFontSize}px`,
              left: '50%',
              bottom: 0,
              transform: 'translate(-50%, 50%)',
              padding: '0 4px',
              filter: 'drop-shadow(1px 1px 0px rgba(0, 0, 0, 1))',
            }}
          >
            {t('lvlShort', 'LVL')} {level}
          </span>
        )}
      </div>
    </div>
  );
});

export function TomeElement({ playerId, layout }) {
  const { getPlayerState } = useOverlayStore();
  const { tomes: cdnTomes, localImageMap } = useGameDataStore();
  const playerState = getPlayerState(playerId);
  
  const tomes = useMemo(() => playerState?.equipment?.tomes || [], [playerState]);
  const shadowTomeIds = useMemo(() => {
    const sourceTomes = localImageMap?.tomes?.length ? localImageMap.tomes : cdnTomes || [];
    return sourceTomes.slice(0, MAX_TOMES).map(t => t.ingameId);
  }, [cdnTomes, localImageMap]);

  const tomeEntries = useMemo(() => {
    const realEntries = tomes.map(t => ({ id: t.id, level: t.level, isShadow: false }));
    const needed = Math.max(0, MAX_TOMES - realEntries.length);
    const shadowEntries = shadowTomeIds.slice(0, needed).map(id => ({ id, level: null, isShadow: true }));
    return [...realEntries, ...shadowEntries];
  }, [tomes, shadowTomeIds]);
  const align = layout?.align || 'left';
  const flow = layout?.flow || 'row';
  const isRow = flow !== 'column';
  const justifyContent = isRow
    ? (align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start')
    : 'flex-start';
  const alignItems = !isRow
    ? (align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start')
    : 'center';
  
  const columnGap = layout?.gapX ?? 4;
  const rowGap = layout?.gapY ?? 4;

  return (
    <div className="p-2 h-full flex">
      <div
        className="flex"
        style={{
          flexDirection: isRow ? 'row' : 'column',
          flexWrap: isRow ? 'wrap' : 'nowrap',
          justifyContent,
          alignItems,
          columnGap,
          rowGap,
          width: '100%'
        }}
      >
        {tomeEntries.map((tome, idx) => (
          <TomeIcon 
            key={`${tome.id}-${idx}`} 
            tomeId={tome.id} 
            level={tome.level}
            isShadow={tome.isShadow}
            size={36}
          />
        ))}
      </div>
    </div>
  );
}

const BonkClassicWeaponIcon = memo(function BonkClassicWeaponIcon({ weaponId, level, size = BONK_CLASSIC_TILE, isShadow = false }) {
  const { iconScale, iconSource, showElementOutlines } = useOverlayStore();
  const { getWeaponByIngameId, getLocalWeaponByIngameId } = useGameDataStore();
  const { t, tGameData } = useI18n();

  const cdnWeapon = getWeaponByIngameId(weaponId);
  const localWeapon = getLocalWeaponByIngameId(weaponId);

  const imageSrc = iconSource === 'local' && localWeapon?.imageSrc
    ? localWeapon.imageSrc
    : cdnWeapon?.imageSrc;

  const rawWeaponName = cdnWeapon?.name || localWeapon?.name || `Weapon ${weaponId}`;
  const weaponName = tGameData('weapons', rawWeaponName, rawWeaponName);

  const scaledSize = size * iconScale;
  const iconPadding = BONK_CLASSIC_PADDING * iconScale;
  const levelFontSize = scaledSize * 0.3;

  return (
    <div
      className={`relative flex items-center justify-center select-none ${isShadow ? 'opacity-40 grayscale obs-hide-shadow' : ''}`}
      style={{
        width: scaledSize,
        height: scaledSize,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 0,
        borderWidth: showElementOutlines ? 1 : 0,
        borderColor: showElementOutlines ? 'rgba(249, 115, 22, 0.5)' : 'transparent',
      }}
      title={weaponName}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={weaponName}
          className="w-full h-full object-contain select-none"
          style={{ padding: iconPadding }}
          draggable={false}
        />
      ) : (
        <span className="text-xs text-white/60">?</span>
      )}
      {level != null && !isShadow && (
        <span
          className="absolute flex items-center justify-center text-white leading-none text-nowrap alagard-numeric"
          style={{
            fontSize: `${levelFontSize}px`,
            // left: '50%',
            bottom: 0,
            translate: '0 30%',
            transform: 'scaleY(1.07)',
            padding: '0 4px',
            filter: 'drop-shadow(1px 1px 0px rgba(0, 0, 0, 1))',
          }}
        >
          {t('lvlShort', 'LVL')} {level}
        </span>
      )}
    </div>
  );
});

const BonkClassicTomeIcon = memo(function BonkClassicTomeIcon({ tomeId, level, size = BONK_CLASSIC_TILE, isShadow = false }) {
  const { iconScale, iconSource, showElementOutlines } = useOverlayStore();
  const { getTomeByIngameId, getLocalTomeByIngameId } = useGameDataStore();
  const { t, tGameData } = useI18n();

  const cdnTome = getTomeByIngameId(tomeId);
  const localTome = getLocalTomeByIngameId(tomeId);

  const imageSrc = iconSource === 'local' && localTome?.imageSrc
    ? localTome.imageSrc
    : cdnTome?.imageSrc;

  const rawTomeName = cdnTome?.name || localTome?.name || `Tome ${tomeId}`;
  const tomeName = tGameData('tomes', rawTomeName, rawTomeName);

  const scaledSize = size * iconScale;
  const iconPadding = BONK_CLASSIC_PADDING * iconScale;
  const levelFontSize = scaledSize * 0.3;

  return (
    <div
      className={`relative flex items-center justify-center select-none ${isShadow ? 'opacity-40 grayscale obs-hide-shadow' : ''}`}
      style={{
        width: scaledSize,
        height: scaledSize,
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 0,
        borderWidth: showElementOutlines ? 1 : 0,
        borderColor: showElementOutlines ? 'rgba(168, 85, 247, 0.5)' : 'transparent',
      }}
      title={tomeName}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={tomeName}
          className="w-full h-full object-contain select-none"
          style={{ padding: iconPadding }}
          draggable={false}
        />
      ) : (
        <span className="text-xs text-white/60">?</span>
      )}
      {level != null && !isShadow && (
        <span
          className="absolute flex items-center justify-center text-white leading-none text-nowrap alagard-numeric"
          style={{
            fontSize: `${levelFontSize}px`,
            bottom: 0,
            translate: '0 30%',
            transform: 'scaleY(1.07)',
            padding: '0 4px',
            filter: 'drop-shadow(1px 1px 0px rgba(0, 0, 0, 1))',
          }}
        >
          {t('lvlShort', 'LVL')} {level}
        </span>
      )}
    </div>
  );
});

export function BonkClassicElement({ playerId, layout }) {
  const { getPlayerState } = useOverlayStore();
  const { weapons: cdnWeapons, tomes: cdnTomes, localImageMap } = useGameDataStore();
  const playerState = getPlayerState(playerId);

  const weapons = useMemo(() => playerState?.equipment?.weapons || [], [playerState]);
  const tomes = useMemo(() => playerState?.equipment?.tomes || [], [playerState]);

  const shadowWeaponIds = useMemo(() => {
    const sourceWeapons = localImageMap?.weapons?.length ? localImageMap.weapons : cdnWeapons || [];
    return sourceWeapons.slice(0, MAX_WEAPONS).map(w => w.ingameId);
  }, [cdnWeapons, localImageMap]);

  const shadowTomeIds = useMemo(() => {
    const sourceTomes = localImageMap?.tomes?.length ? localImageMap.tomes : cdnTomes || [];
    return sourceTomes.slice(0, MAX_TOMES).map(t => t.ingameId);
  }, [cdnTomes, localImageMap]);

  const weaponEntries = useMemo(() => {
    const realEntries = weapons.map(w => ({ id: w.id, level: w.level, isShadow: false }));
    const needed = Math.max(0, MAX_WEAPONS - realEntries.length);
    const shadowEntries = shadowWeaponIds.slice(0, needed).map(id => ({ id, level: null, isShadow: true }));
    return [...realEntries, ...shadowEntries];
  }, [weapons, shadowWeaponIds]);

  const tomeEntries = useMemo(() => {
    const realEntries = tomes.map(t => ({ id: t.id, level: t.level, isShadow: false }));
    const needed = Math.max(0, MAX_TOMES - realEntries.length);
    const shadowEntries = shadowTomeIds.slice(0, needed).map(id => ({ id, level: null, isShadow: true }));
    return [...realEntries, ...shadowEntries];
  }, [tomes, shadowTomeIds]);

  const align = layout?.align || 'left';
  const justifyContent = align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start';
  const columnGap = layout?.gapX ?? 4;
  const rowGap = layout?.gapY ?? 4;

  return (
    <div className="p-2 h-full flex flex-col" style={{ rowGap: BONK_CLASSIC_SECTION_GAP }}>
      <div
        className="flex"
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent,
          alignItems: 'center',
          columnGap,
          rowGap,
        }}
      >
        {weaponEntries.map((weapon, idx) => (
          <BonkClassicWeaponIcon
            key={`${weapon.id}-${idx}`}
            weaponId={weapon.id}
            level={weapon.level}
            isShadow={weapon.isShadow}
          />
        ))}
      </div>
      <div
        className="flex"
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent,
          alignItems: 'center',
          columnGap,
          rowGap,
        }}
      >
        {tomeEntries.map((tome, idx) => (
          <BonkClassicTomeIcon
            key={`${tome.id}-${idx}`}
            tomeId={tome.id}
            level={tome.level}
            isShadow={tome.isShadow}
          />
        ))}
      </div>
    </div>
  );
}

export function HeroElement({ playerId, layout }) {
  const { getPlayerState, iconScale, iconSource, showElementOutlines } = useOverlayStore();
  const { getHeroByIngameId, getLocalHeroByIngameId, heroes, localImageMap } = useGameDataStore();
  const { t, tGameData } = useI18n();
  const playerState = getPlayerState(playerId);
  
  const character = playerState?.character;
  const shadowHeroId = useMemo(() => {
    const sourceHeroes = localImageMap?.heroes?.length ? localImageMap.heroes : heroes || [];
    return sourceHeroes[0]?.ingameId;
  }, [heroes, localImageMap]);

  const heroId = character?.id ?? shadowHeroId;
  const isShadow = !character && shadowHeroId != null;
 

  // Use explicit null check instead of truthy check because Fox hero has ingameId: 0
  const cdnHero = heroId != null ? getHeroByIngameId(heroId) : null;
  const localHero = heroId != null ? getLocalHeroByIngameId(heroId) : null;
  
  // Determine which image source to use
  const imageSrc = iconSource === 'local'
    ? (localHero?.imageSrc || cdnHero?.imageSrc)
    : (cdnHero?.imageSrc || localHero?.imageSrc);
  
  const rawHeroName = cdnHero?.name || localHero?.name || t('unknown', 'Unknown');
  const heroName = tGameData('heroes', rawHeroName, rawHeroName);
  
  const heroSize = 64 * iconScale;
  const levelFontSize = heroSize * 0.3;
  
  const align = layout?.align || 'center';
  const alignClass = align === 'left' ? 'items-start' : align === 'right' ? 'items-end' : 'items-center';

  return (
    <div className={`p-2 h-full flex flex-col justify-center ${alignClass}`}>
      {(cdnHero || localHero) ? (
        <>
          <div 
            className={`relative ${showElementOutlines ? 'bg-gradient-to-br from-yellow-500/30 to-orange-500/30 border-2 border-yellow-500/50' : ''} ${isShadow ? 'opacity-40 grayscale obs-hide-shadow' : ''}`}
            style={{ width: heroSize, height: heroSize, borderWidth: showElementOutlines ? 2 : 0, borderColor: showElementOutlines ? 'rgba(234, 179, 8, 0.5)' : 'transparent', filter: 'drop-shadow(1px 1px 0px rgba(0, 0, 0, 1))' }}
          >
            {imageSrc ? (
              <>
              <img 
                src={imageSrc} 
                alt={heroName}
                className="w-full h-full object-cover select-none"
                draggable={false}
              />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-2xl">
                🦊
              </div>
            )}
            {!isShadow && (
              <span
                className="absolute flex items-center justify-center text-white leading-none text-nowrap alagard-numeric"
                style={{
                  fontSize: `${levelFontSize*0.8}px`,
                  left: '50%',
                  bottom: 0,
                  transform: 'translate(-50%, 110%)',
                  padding: '0 4px',
                  filter: 'drop-shadow(1px 1px 0px rgba(0, 0, 0, 1))',
                }}
              >
                {t('lvlShort', 'LVL')} {character?.level || 1}
              </span>
            )}
          </div>
        </>
      ) : (
        null
      )}
    </div>
  );
}
