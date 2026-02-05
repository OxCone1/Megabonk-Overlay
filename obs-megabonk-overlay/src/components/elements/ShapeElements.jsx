import { useMemo } from 'react';

export function ShapeRectElement({ layout }) {
  const fillColor = useMemo(() => layout?.fillColor || '#000000', [layout?.fillColor]);

  return (
    <div
      className="w-full h-full"
      style={{
        backgroundColor: fillColor,
      }}
    />
  );
}
