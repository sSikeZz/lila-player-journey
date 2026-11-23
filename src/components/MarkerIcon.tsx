import { useEffect, useRef } from 'react';
import { Shape } from '../data';
import { drawShape } from '../render';

/** Renders the exact canvas marker used on the map, so the legend can't drift from it. */
export function MarkerIcon({ shape, color, size = 16 }: { shape: Shape; color: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = size * dpr;
    c.height = size * dpr;
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    drawShape(ctx, shape, size / 2, size / 2, size * 0.36, color);
  }, [shape, color, size]);
  return <canvas ref={ref} style={{ width: size, height: size, flex: 'none' }} />;
}

export function LineIcon({ color, dashed }: { color: string; dashed?: boolean }) {
  return (
    <svg width="22" height="10" style={{ flex: 'none' }}>
      <line x1="1" y1="5" x2="21" y2="5" stroke={color} strokeWidth="2.5" strokeDasharray={dashed ? '4 3' : undefined} strokeLinecap="round" />
    </svg>
  );
}
