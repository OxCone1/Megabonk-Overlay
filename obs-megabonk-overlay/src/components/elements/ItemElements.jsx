import { memo, useMemo } from 'react';
import { useOverlayStore, RARITY_TIERS } from '@/stores/overlayStore';
import { useGameDataStore } from '@/stores/gameDataStore';
import { useI18n } from '@/lib/i18n';

// Default item icon size (42x42 for rarity items)
const DEFAULT_ITEM_SIZE = 42;

// Memoized ItemIcon component to prevent unnecessary re-renders
const ItemIcon = memo(function ItemIcon({ item, size = DEFAULT_ITEM_SIZE }) {
  const { iconScale, iconSource, showElementOutlines } = useOverlayStore();
  const { getItemByIngameId, getLocalItemByIngameId } = useGameDataStore();
  const { tGameData } = useI18n();
  
  // Get item data from appropriate source
  const cdnItemData = getItemByIngameId(item.id);
  const localItemData = getLocalItemByIngameId(item.id);
  
  // Determine which image source to use
  const imageSrc = iconSource === 'local' && localItemData?.imageSrc
    ? localItemData.imageSrc
    : cdnItemData?.imageSrc;
  
  const rawItemName = cdnItemData?.name || localItemData?.name || `Item ${item.id}`;
  const itemName = tGameData('items', rawItemName, rawItemName);
  const rarityKey = item.rarity ?? cdnItemData?.rarity ?? localItemData?.rarity ?? 0;
  const rarity = RARITY_TIERS[rarityKey];
  
  const scaledSize = size * iconScale;
  const countFontSize = scaledSize * 0.3;
  
  return (
    <div 
      className={`relative flex items-center justify-center rounded select-none ${item.isShadow ? 'opacity-40 grayscale obs-hide-shadow' : ''}`}
      style={{ 
        width: scaledSize, 
        height: scaledSize,
        backgroundColor: showElementOutlines ? `${rarity?.color}20` : 'transparent',
        borderColor: showElementOutlines ? rarity?.color : 'transparent',
        borderWidth: showElementOutlines ? 1 : 0,
      }}
      title={itemName}
    >
      {imageSrc ? (
        <img 
          src={imageSrc} 
          alt={itemName}
          className="w-full h-full object-contain p-0.5"
          draggable={false}
        />
      ) : (
        <span className="text-xs text-white/60">?</span>
      )}
      {item.count > 1 && !item.isShadow && (
        <span 
          className="absolute flex items-center justify-center text-white leading-none alagard-numeric"
          style={{
            fontSize: `${countFontSize}px`,
            left: '75%',
            bottom: 0,
            transform: 'translate(-50%, 50%)',
            padding: '0 4px',
            filter: 'drop-shadow(1px 1px 0px rgba(0, 0, 0, 1))',
          }}
        >
          x{item.count}
        </span>
      )}
    </div>
  );
});

function RarityGroup({ items, layout, rarity }) {
  const iconScale = useOverlayStore(state => state.iconScale);
  if (items.length === 0) return null;
  const align = layout?.align || 'left';
  const flow = layout?.flow || 'row';
  const lockScale = !!layout?.lockScale;
  const isRow = flow !== 'column';
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
  const columnGap = layout?.gapX ?? 4;
  const rowGap = layout?.gapY ?? 4;
  const maxLines = layout?.rarityLimits?.[rarity] || 0;
  const itemSize = DEFAULT_ITEM_SIZE * iconScale;
  const hasLimit = maxLines > 0;
  const limitSingleLine = maxLines === 1;
  const maxWidth = !isRow && maxLines > 0
    ? (maxLines * itemSize) + (Math.max(0, maxLines - 1) * columnGap)
    : undefined;
  const maxHeight = isRow && maxLines > 0
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
        flexWrap: gridStyles ? undefined : (lockScale || (hasLimit && limitSingleLine) ? 'nowrap' : wrapDirection),
        justifyContent,
        alignItems: gridStyles ? 'flex-start' : alignItems,
        alignContent,
        justifyItems,
        columnGap,
        rowGap,
        width: isRow
          ? (hasLimit ? 'auto' : '100%')
          : (hasLimit ? maxWidth : 'max-content'),
        height: isRow ? (hasLimit ? maxHeight : 'auto') : (hasLimit ? 'auto' : '100%'),
        minHeight: isRow ? undefined : (hasLimit ? undefined : '100%'),
        maxWidth,
        maxHeight,
        overflow: 'visible',
        flex: '0 0 auto',
        flexShrink: 0,
      }}
    >
      {items.map((item, idx) => (
        <ItemIcon key={`${item.id}-${idx}`} item={item} size={DEFAULT_ITEM_SIZE} />
      ))}
    </div>
  );
}

export function ItemGroupElement({ playerId, layout }) {
  const { getPlayerState } = useOverlayStore();
  const { getItemByIngameId, items: cdnItems, localImageMap } = useGameDataStore();
  const playerState = getPlayerState(playerId);
  
  const items = playerState?.equipment?.items || [];
  const itemsOrder = layout?.itemsOrder || 'rarity';
  const flow = layout?.flow || 'row';
  const align = layout?.align || 'left';
  const lockScale = !!layout?.lockScale;

  const shadowItemsByRarity = useMemo(() => {
    const sourceItems = localImageMap?.items?.length ? localImageMap.items : cdnItems || [];
    const result = { 0: null, 1: null, 2: null, 3: null };
    sourceItems.forEach((item) => {
      if (result[item.rarity] == null) {
        result[item.rarity] = item.ingameId;
      }
    });
    return result;
  }, [cdnItems, localImageMap]);

  const getShadowEntries = (rarity) => {
    const shadowId = shadowItemsByRarity[rarity];
    if (!shadowId) return [];
    const maxLines = layout?.rarityLimits?.[rarity] || 0;
    const count = maxLines > 0 ? maxLines : 1;
    return Array.from({ length: count }, () => ({ id: shadowId, count: 1, rarity, isShadow: true }));
  };
  
  // Group items by rarity (4 tiers: 0=Common, 1=Rare, 2=Epic, 3=Legendary)
  const itemsByRarity = { 0: [], 1: [], 2: [], 3: [] };
  items.forEach(item => {
    const itemData = getItemByIngameId(item.id);
    const rarity = item.rarity ?? itemData?.rarity ?? 0;
    if (!itemsByRarity[rarity]) itemsByRarity[rarity] = [];
    itemsByRarity[rarity].push({ ...item, rarity });
  });

  const columnGap = layout?.gapX ?? 4;
  const rowGap = layout?.gapY ?? 4;
  
  return (
    <div className="p-2 flex h-full overflow-visible">
      {itemsOrder === 'acquired' ? (
        <div
          className="flex"
          style={{
            flexDirection: flow === 'column' ? 'column' : 'row',
            flexWrap: flow === 'row' ? (lockScale ? 'nowrap' : 'wrap') : 'wrap',
            justifyContent: 'flex-start',
            alignItems: 'flex-start',
            alignContent: 'flex-start',
            columnGap,
            rowGap,
            width: '100%'
          }}
        >
          {items.map((item, idx) => {
            const itemData = getItemByIngameId(item.id);
            const rarity = item.rarity ?? itemData?.rarity ?? 0;
            return (
              <ItemIcon key={`${item.id}-${idx}`} item={{ ...item, rarity }} size={DEFAULT_ITEM_SIZE} />
            );
          })}
        </div>
      ) : (
        <div
          className="flex"
          style={{
            flexDirection: flow === 'column' ? 'row' : 'column',
            flexWrap: 'nowrap',
            alignItems: flow === 'column' ? 'stretch' : (align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'),
            justifyContent: flow === 'column'
              ? (align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start')
              : 'flex-start',
            alignContent: 'flex-start',
            columnGap,
            rowGap,
            width: '100%',
            height: flow === 'column' ? '100%' : 'auto',
          }}
        >
          {([0, 1, 2, 3]).map((rarity) => (
            <RarityGroup
              key={rarity}
              items={itemsByRarity[rarity].length > 0
                ? itemsByRarity[rarity]
                : getShadowEntries(rarity)
              }
              rarity={rarity}
              layout={{ ...layout, flow: flow === 'column' ? 'column' : 'row' }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function RarityGroupElement({ playerId, rarity, layout }) {
  const { getPlayerState } = useOverlayStore();
  const { getItemByIngameId, items: cdnItems, localImageMap } = useGameDataStore();
  const playerState = getPlayerState(playerId);
  
  const items = playerState?.equipment?.items || [];
  
  // Filter items by rarity
  const filteredItems = items.filter(item => {
    const itemData = getItemByIngameId(item.id);
    return (item.rarity ?? itemData?.rarity ?? 0) === rarity;
  }).map(item => ({ ...item, rarity }));
  
  const shadowItemId = useMemo(() => {
    const sourceItems = localImageMap?.items?.length ? localImageMap.items : cdnItems || [];
    const item = sourceItems.find(i => i.rarity === rarity);
    return item?.ingameId;
  }, [cdnItems, localImageMap, rarity]);

  const shadowCount = layout?.rarityLimits?.[rarity] > 0 ? layout.rarityLimits[rarity] : 1;

  const itemsToRender = filteredItems.length > 0
    ? filteredItems
    : (shadowItemId
      ? Array.from({ length: shadowCount }, () => ({ id: shadowItemId, count: 1, rarity, isShadow: true }))
      : []);

  return (
    <div className="p-2 h-full overflow-visible">
      <RarityGroup items={itemsToRender} layout={layout} rarity={rarity} />
    </div>
  );
}
