import { memo } from 'react';
import { resolvePublicAssetPath } from '@/lib/publicAsset';

const toGameIconPath = (relativePath) => resolvePublicAssetPath(relativePath);

const DEFAULT_BADGE_SCALE = 0.6;
const DEFAULT_BADGE_OFFSET = 0.18;
const BAN_BADGE_SRC = toGameIconPath('/Game Icons/Interface/banned.png');
export const BanBadge = memo(function BanBadge({ iconSize, scale = DEFAULT_BADGE_SCALE, offset = DEFAULT_BADGE_OFFSET }) {
  if (!iconSize) return null;
  const badgeSize = iconSize * scale;
  const bottomOffset = -iconSize * offset;

  return (
    <img
      src={BAN_BADGE_SRC}
      alt="Banned"
      className="absolute select-none pointer-events-none"
      style={{
        width: badgeSize,
        height: badgeSize,
        // left: '50%',
        bottom: bottomOffset,
        // transform: 'translateX(-50%)',
        scale: 0.75,
      }}
      draggable={false}
    />
  );
});
