import { memo, useMemo } from 'react';
import { useOverlayStore, RARITY_TIERS } from '@/stores/overlayStore';
import { useGameDataStore } from '@/stores/gameDataStore';
import { useI18n } from '@/lib/i18n';
import { BanBadge } from '@/components/elements/BanBadge';

const DEFAULT_ICON_SIZE = 34;

const HeroBanIcon = memo(function HeroBanIcon({ heroId, size = DEFAULT_ICON_SIZE, isShadow = false, isBanned = false }) {
  const { iconScale, iconSource, showElementOutlines } = useOverlayStore();
  const { getHeroByIngameId, getLocalHeroByIngameId } = useGameDataStore();
  const { tGameData } = useI18n();

  const cdnHero = getHeroByIngameId(heroId);
  const localHero = getLocalHeroByIngameId(heroId);

  const imageSrc = iconSource === 'local' && localHero?.imageSrc
    ? localHero.imageSrc
    : cdnHero?.imageSrc;

  const rawHeroName = cdnHero?.name || localHero?.name || `Hero ${heroId}`;
  const heroName = tGameData('heroes', rawHeroName, rawHeroName);
  const scaledSize = size * iconScale;

  return (
    <div
      className={`relative flex items-center justify-center rounded-full ${showElementOutlines ? 'bg-yellow-500/20 border border-yellow-500/50' : ''} ${isShadow ? 'opacity-40 grayscale obs-hide-in-overlay' : ''}`}
      style={{ width: scaledSize, height: scaledSize, borderWidth: showElementOutlines ? 1 : 0, borderColor: showElementOutlines ? 'rgba(234, 179, 8, 0.5)' : 'transparent' }}
      title={heroName}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={heroName}
          className="w-full h-full object-cover select-none"
          style={{ filter: isBanned ? 'brightness(0.6) saturate(0.7)' : undefined }}
          draggable={false}
        />
      ) : (
        <span className="text-xs text-white/60">?</span>
      )}
      {isBanned && !isShadow && <BanBadge iconSize={scaledSize} />}
    </div>
  );
});

const WeaponBanIcon = memo(function WeaponBanIcon({ weaponId, size = DEFAULT_ICON_SIZE, isShadow = false, isBanned = false }) {
  const { iconScale, iconSource, showElementOutlines } = useOverlayStore();
  const { getWeaponByIngameId, getLocalWeaponByIngameId } = useGameDataStore();
  const { tGameData } = useI18n();

  const cdnWeapon = getWeaponByIngameId(weaponId);
  const localWeapon = getLocalWeaponByIngameId(weaponId);

  const imageSrc = iconSource === 'local' && localWeapon?.imageSrc
    ? localWeapon.imageSrc
    : cdnWeapon?.imageSrc;

  const rawWeaponName = cdnWeapon?.name || localWeapon?.name || `Weapon ${weaponId}`;
  const weaponName = tGameData('weapons', rawWeaponName, rawWeaponName);
  const scaledSize = size * iconScale;

  return (
    <div
      className={`relative flex items-center justify-center rounded ${showElementOutlines ? 'bg-orange-500/20 border border-orange-500/50' : ''} ${isShadow ? 'opacity-40 grayscale obs-hide-in-overlay' : ''}`}
      style={{ width: scaledSize, height: scaledSize, borderWidth: showElementOutlines ? 1 : 0, borderColor: showElementOutlines ? 'rgba(249, 115, 22, 0.5)' : 'transparent' }}
      title={weaponName}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={weaponName}
          className="w-full h-full object-contain p-1 select-none"
          style={{ filter: isBanned ? 'brightness(0.6) saturate(0.7)' : undefined }}
          draggable={false}
        />
      ) : (
        <span className="text-xs text-white/60">?</span>
      )}
      {isBanned && !isShadow && <BanBadge iconSize={scaledSize} />}
    </div>
  );
});

const TomeBanIcon = memo(function TomeBanIcon({ tomeId, size = DEFAULT_ICON_SIZE, isShadow = false, isBanned = false }) {
  const { iconScale, iconSource, showElementOutlines } = useOverlayStore();
  const { getTomeByIngameId, getLocalTomeByIngameId } = useGameDataStore();
  const { tGameData } = useI18n();

  const cdnTome = getTomeByIngameId(tomeId);
  const localTome = getLocalTomeByIngameId(tomeId);

  const imageSrc = iconSource === 'local' && localTome?.imageSrc
    ? localTome.imageSrc
    : cdnTome?.imageSrc;

  const rawTomeName = cdnTome?.name || localTome?.name || `Tome ${tomeId}`;
  const tomeName = tGameData('tomes', rawTomeName, rawTomeName);
  const scaledSize = size * iconScale;

  return (
    <div
      className={`relative flex items-center justify-center rounded ${showElementOutlines ? 'bg-purple-500/20 border border-purple-500/50' : ''} ${isShadow ? 'opacity-40 grayscale obs-hide-in-overlay' : ''}`}
      style={{ width: scaledSize, height: scaledSize, borderWidth: showElementOutlines ? 1 : 0, borderColor: showElementOutlines ? 'rgba(168, 85, 247, 0.5)' : 'transparent' }}
      title={tomeName}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={tomeName}
          className="w-full h-full object-contain p-0.5 select-none"
          style={{ filter: isBanned ? 'brightness(0.6) saturate(0.7)' : undefined }}
          draggable={false}
        />
      ) : (
        <span className="text-xs text-white/60">?</span>
      )}
      {isBanned && !isShadow && <BanBadge iconSize={scaledSize} />}
    </div>
  );
});

const ItemBanIcon = memo(function ItemBanIcon({ itemId, rarity, size = DEFAULT_ICON_SIZE, isShadow = false, isBanned = false }) {
  const { iconScale, iconSource, showElementOutlines } = useOverlayStore();
  const { getItemByIngameId, getLocalItemByIngameId } = useGameDataStore();
  const { tGameData } = useI18n();

  const cdnItem = getItemByIngameId(itemId);
  const localItem = getLocalItemByIngameId(itemId);

  const imageSrc = iconSource === 'local' && localItem?.imageSrc
    ? localItem.imageSrc
    : cdnItem?.imageSrc;

  const rawItemName = cdnItem?.name || localItem?.name || `Item ${itemId}`;
  const itemName = tGameData('items', rawItemName, rawItemName);
  const rarityInfo = RARITY_TIERS[rarity] || RARITY_TIERS[0];
  const scaledSize = size * iconScale;

  return (
    <div
      className={`relative flex items-center justify-center rounded ${isShadow ? 'opacity-40 grayscale obs-hide-in-overlay' : ''}`}
      style={{
        width: scaledSize,
        height: scaledSize,
        backgroundColor: showElementOutlines ? `${rarityInfo.color}20` : 'transparent',
        borderColor: showElementOutlines ? rarityInfo.color : 'transparent',
        borderWidth: showElementOutlines ? 1 : 0,
      }}
      title={itemName}
    >
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={itemName}
          className="w-full h-full object-contain p-0.5 select-none"
          style={{ filter: isBanned ? 'brightness(0.6) saturate(0.7)' : undefined }}
          draggable={false}
        />
      ) : (
        <span className="text-xs text-white/60">?</span>
      )}
      {isBanned && !isShadow && <BanBadge iconSize={scaledSize} />}
    </div>
  );
});

function Section({ children, gapX = 4, gapY = 4, layout }) {
  const align = layout?.align || 'left';
  const flow = layout?.flow || 'row';
  const isRow = flow !== 'column';
  const justifyContent = isRow
    ? (align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start')
    : 'flex-start';
  const alignItems = isRow
    ? 'flex-start'
    : (align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start');

  return (
    <div
      className="flex flex-wrap"
      style={{
        columnGap: gapX,
        rowGap: gapY,
        flexDirection: isRow ? 'row' : 'column',
        justifyContent,
        alignItems,
        alignContent: justifyContent,
        flex: '0 0 auto',
      }}
    >
      {children}
    </div>
  );
}

function ItemRarityGrid({ items, layout, rarity, fillWidth = true }) {
  const iconScale = useOverlayStore(state => state.iconScale);
  if (!items || items.length === 0) return null;

  const align = layout?.align || 'left';
  const flow = layout?.flow || 'row';
  const isRow = flow !== 'column';
  const columnGap = layout?.gapX ?? 4;
  const rowGap = layout?.gapY ?? 4;
  const maxLines = layout?.rarityLimits?.[rarity] || 0;
  const itemSize = DEFAULT_ICON_SIZE * iconScale;
  const hasLimit = maxLines > 0;

  const justifyContent = isRow
    ? (align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start')
    : 'flex-start';
  const alignItems = isRow
    ? 'flex-start'
    : (align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start');
  const alignContent = isRow
    ? (align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start')
    : 'flex-start';
  const wrapDirection = !isRow && align === 'right' ? 'wrap-reverse' : 'wrap';
  const justifyItems = align === 'center' ? 'center' : align === 'right' ? 'end' : 'start';

  const maxWidth = !isRow && hasLimit
    ? (maxLines * itemSize) + (Math.max(0, maxLines - 1) * columnGap)
    : undefined;
  const maxHeight = isRow && hasLimit
    ? (maxLines * itemSize) + (Math.max(0, maxLines - 1) * rowGap)
    : undefined;

  const gridStyles = hasLimit ? (
    isRow
      ? {
        display: 'grid',
        gridAutoFlow: 'column',
        gridAutoColumns: `${itemSize}px`,
        gridTemplateRows: `repeat(${maxLines}, ${itemSize}px)`,
      }
      : {
        display: 'grid',
        gridAutoFlow: 'row',
        gridAutoRows: `${itemSize}px`,
        gridTemplateColumns: `repeat(${maxLines}, ${itemSize}px)`,
      }
  ) : null;

  return (
    <div
      className="flex"
      style={{
        ...(gridStyles || {}),
        flexDirection: gridStyles ? undefined : (isRow ? 'row' : 'column'),
        flexWrap: gridStyles ? undefined : wrapDirection,
        justifyContent,
        alignItems: gridStyles ? 'flex-start' : alignItems,
        alignContent,
        justifyItems,
        columnGap,
        rowGap,
        width: isRow
          ? (hasLimit ? 'auto' : (fillWidth ? '100%' : 'max-content'))
          : (hasLimit ? maxWidth : 'max-content'),
        height: !isRow ? (hasLimit ? 'auto' : maxHeight) : (hasLimit ? '100%' : 'auto'),
        minHeight: !isRow ? undefined : (hasLimit ? '100%' : undefined),
        maxWidth: fillWidth ? maxWidth : '100%',
        maxHeight,
        overflow: 'visible',
        flex: '0 0 auto',
      }}
    >
      {items.map((entry, idx) => (
        <ItemBanIcon
          key={`${entry.id}-${idx}`}
          itemId={entry.id}
          rarity={rarity}
          isShadow={entry.isShadow}
          isBanned={!entry.isShadow}
        />
      ))}
    </div>
  );
}

function BansElement({ scope, title, layout }) {
  const { roomBans, hideElementTitles, isSpectator } = useOverlayStore();
  const { getHeroWeaponIngameId, localImageMap, heroes, weapons, tomes, items: cdnItems } = useGameDataStore();
  const flow = layout?.flow || 'row';
  const align = layout?.align || 'left';
  const columnGap = layout?.gapX ?? 4;
  const rowGap = layout?.gapY ?? 4;

  const justifyContent = flow === 'row'
    ? (align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start')
    : 'flex-start';
  const alignItems = flow === 'row'
    ? 'flex-start'
    : (align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start');
  const hideTitle = hideElementTitles || !!layout?.hideTitle;
  const resolvedTitle = layout?.title || title;

  const resolvedScope = useMemo(() => {
    if (scope === 'system') return scope;
    if (isSpectator) return scope;
    return scope === 'player1' ? 'player2' : 'player1';
  }, [scope, isSpectator]);

  const bans = useMemo(() => (
    roomBans?.[resolvedScope] || { heroes: [], weapons: [], tomes: [], items: { common: [], rare: [], epic: [], legendary: [] } }
  ), [roomBans, resolvedScope]);

  const heroIds = useMemo(() => bans.heroes || [], [bans]);
  const weaponIds = useMemo(() => bans.weapons || [], [bans]);
  const tomeIds = useMemo(() => bans.tomes || [], [bans]);
  const items = useMemo(() => bans.items || { common: [], rare: [], epic: [], legendary: [] }, [bans]);

  const shadowIds = useMemo(() => {
    const heroList = localImageMap?.heroes?.length ? localImageMap.heroes : heroes || [];
    const weaponList = localImageMap?.weapons?.length ? localImageMap.weapons : weapons || [];
    const tomeList = localImageMap?.tomes?.length ? localImageMap.tomes : tomes || [];
    const itemList = localImageMap?.items?.length ? localImageMap.items : cdnItems || [];

    const shadow = {
      hero: heroList[0]?.ingameId,
      weapon: weaponList[0]?.ingameId,
      tome: tomeList[0]?.ingameId,
      itemsByRarity: { 0: null, 1: null, 2: null, 3: null },
    };

    itemList.forEach((item) => {
      if (shadow.itemsByRarity[item.rarity] == null) {
        shadow.itemsByRarity[item.rarity] = item.ingameId;
      }
    });

    return shadow;
  }, [localImageMap, heroes, weapons, tomes, cdnItems]);

  const filteredHeroIds = useMemo(() => {
    const weaponSet = new Set(weaponIds);
    return heroIds.filter(id => !weaponSet.has(getHeroWeaponIngameId(id)));
  }, [heroIds, weaponIds, getHeroWeaponIngameId]);

  const heroEntries = filteredHeroIds.length > 0
    ? filteredHeroIds.map((id) => ({ id, isShadow: false }))
    : (shadowIds.hero ? [{ id: shadowIds.hero, isShadow: true }] : []);

  const weaponEntries = weaponIds.length > 0
    ? weaponIds.map((id) => ({ id, isShadow: false }))
    : (shadowIds.weapon ? [{ id: shadowIds.weapon, isShadow: true }] : []);

  const tomeEntries = tomeIds.length > 0
    ? tomeIds.map((id) => ({ id, isShadow: false }))
    : (shadowIds.tome ? [{ id: shadowIds.tome, isShadow: true }] : []);

  const getShadowItemEntries = (rarityKey) => {
    const shadowId = shadowIds.itemsByRarity[rarityKey];
    if (!shadowId) return [];
    const maxLines = layout?.rarityLimits?.[rarityKey] || 0;
    const count = maxLines > 0 ? maxLines : 1;
    return Array.from({ length: count }, () => ({ id: shadowId, isShadow: true }));
  };

  const itemEntries = {
    common: items.common?.length
      ? items.common.map((id) => ({ id, isShadow: false }))
      : getShadowItemEntries(0),
    rare: items.rare?.length
      ? items.rare.map((id) => ({ id, isShadow: false }))
      : getShadowItemEntries(1),
    epic: items.epic?.length
      ? items.epic.map((id) => ({ id, isShadow: false }))
      : getShadowItemEntries(2),
    legendary: items.legendary?.length
      ? items.legendary.map((id) => ({ id, isShadow: false }))
      : getShadowItemEntries(3),
  };

  const hasAnyBans = filteredHeroIds.length > 0
    || weaponIds.length > 0
    || tomeIds.length > 0
    || items.common?.length
    || items.rare?.length
    || items.epic?.length
    || items.legendary?.length;

  return (
    <div className={`p-2 flex flex-col gap-2 h-full overflow-visible ${hasAnyBans ? '' : 'obs-hide-shadow'}`}>
      {!hideTitle && (
        <div className="text-xs font-semibold text-white/80 uppercase tracking-wider obs-hide-in-overlay obs-preserve-space">
          {resolvedTitle}
        </div>
      )}

      <div
        className="flex"
        style={{
          // flexDirection: flow === 'column' ? 'column' : 'row',
          flexWrap: flow === 'column' ? 'wrap' : 'wrap',
          justifyContent,
          alignItems,
          columnGap,
          rowGap,
          width: '100%'
        }}
      >
        {heroEntries.length > 0 && (
          <Section gapX={columnGap} gapY={rowGap} layout={layout}>
            {heroEntries.map((entry, idx) => (
              <HeroBanIcon
                key={`${scope}-hero-${entry.id}-${idx}`}
                heroId={entry.id}
                isShadow={entry.isShadow}
                isBanned={!entry.isShadow}
              />
            ))}
          </Section>
        )}

        {weaponEntries.length > 0 && (
          <Section gapX={columnGap} gapY={rowGap} layout={layout}>
            {weaponEntries.map((entry, idx) => (
              <WeaponBanIcon
                key={`${scope}-weapon-${entry.id}-${idx}`}
                weaponId={entry.id}
                isShadow={entry.isShadow}
                isBanned={!entry.isShadow}
              />
            ))}
          </Section>
        )}

        {tomeEntries.length > 0 && (
          <Section gapX={columnGap} gapY={rowGap} layout={layout}>
            {tomeEntries.map((entry, idx) => (
              <TomeBanIcon
                key={`${scope}-tome-${entry.id}-${idx}`}
                tomeId={entry.id}
                isShadow={entry.isShadow}
                isBanned={!entry.isShadow}
              />
            ))}
          </Section>
        )}

        {itemEntries.common.length > 0 && (
          <ItemRarityGrid items={itemEntries.common} layout={layout} rarity={0} fillWidth={false} />
        )}
        {itemEntries.rare.length > 0 && (
          <ItemRarityGrid items={itemEntries.rare} layout={layout} rarity={1} fillWidth={false} />
        )}
        {itemEntries.epic.length > 0 && (
          <ItemRarityGrid items={itemEntries.epic} layout={layout} rarity={2} fillWidth={false} />
        )}
        {itemEntries.legendary.length > 0 && (
          <ItemRarityGrid items={itemEntries.legendary} layout={layout} rarity={3} fillWidth={false} />
        )}
      </div>

      {filteredHeroIds.length === 0 && weaponIds.length === 0 && tomeIds.length === 0 &&
        (!items.common?.length && !items.rare?.length && !items.epic?.length && !items.legendary?.length) && null}
    </div>
  );
}

export function SystemBansElement({ layout }) {
  const { t } = useI18n();
  return <BansElement scope="system" title={t('roomBans', 'Room Bans')} layout={layout} />;
}

export function Player1BansElement({ layout }) {
  const { t } = useI18n();
  return <BansElement scope="player1" title={t('player1Bans', 'Player 1 Bans')} layout={layout} />;
}

export function Player2BansElement({ layout }) {
  const { t } = useI18n();
  return <BansElement scope="player2" title={t('player2Bans', 'Player 2 Bans')} layout={layout} />;
}
