import { useCallback, useEffect, useRef, useState } from 'react';
import { EVENT_BY_CODE, JourneyRef } from '../data';
import { fmtClock, fmtDate, shortId } from '../format';
import { Heat } from '../heatmap';
import { colorFor, drawGrid, drawJourneys, Hit, View } from '../render';
import { Roster } from './Roster';

interface Props {
  image: string;
  refs: JourneyRef[];
  focus: boolean;
  t: number;
  showPaths: boolean;
  markerOn: Record<number, boolean>;
  heat: Heat | null;
  heatOpacity: number;
  showGrid: boolean;
}

const MIN_SCALE = 0.6;
const MAX_SCALE = 16;

export function MapView({ image, refs, focus, t, showPaths, markerOn, heat, heatOpacity, showGrid }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
  const [tip, setTip] = useState<{ x: number; y: number; hit: Hit } | null>(null);
  const hitsRef = useRef<Hit[]>([]);
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);

  const base = Math.min(size.w, size.h);

  const fit = useCallback(() => {
    const b = Math.min(size.w, size.h);
    setView({ scale: 1, tx: (size.w - b) / 2, ty: (size.h - b) / 2 });
  }, [size.w, size.h]);

  // container size
  useEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(fit, [fit]);

  // minimap image
  useEffect(() => {
    setImg(null);
    const im = new Image();
    im.onload = () => setImg(im);
    im.src = image;
    fit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image]);

  // draw
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !size.w) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.round(size.w * dpr);
    c.height = Math.round(size.h * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#07080c';
    ctx.fillRect(0, 0, size.w, size.h);
    const S = base * view.scale;
    if (img) {
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, view.tx, view.ty, S, S);
      // dim the minimap slightly so overlays pop
      ctx.fillStyle = 'rgba(7,8,12,0.28)';
      ctx.fillRect(view.tx, view.ty, S, S);
    }
    if (heat && heat.samples) {
      ctx.globalAlpha = heatOpacity;
      ctx.drawImage(heat.canvas, view.tx, view.ty, S, S);
      ctx.globalAlpha = 1;
    }
    if (showGrid) drawGrid(ctx, view, base);
    hitsRef.current = drawJourneys(ctx, refs, view, base, {
      focus,
      t,
      showPaths,
      markerOn,
      colorOf: colorFor(refs, focus),
      dim: !focus && !!heat?.samples,
    });
  }, [size, img, view, refs, focus, t, showPaths, markerOn, heat, heatOpacity, base, showGrid]);

  const zoomAt = (mx: number, my: number, k: number) =>
    setView((v) => {
      const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.scale * k));
      const f = scale / v.scale;
      return { scale, tx: mx - (mx - v.tx) * f, ty: my - (my - v.ty) * f };
    });

  // wheel must be non-passive to preventDefault page scroll
  useEffect(() => {
    const el = canvasRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false };
    setTip(null);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (d) {
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
      setView((v) => ({ ...v, tx: d.tx + dx, ty: d.ty + dy }));
      return;
    }
    const r = canvasRef.current!.getBoundingClientRect();
    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    let best: Hit | null = null;
    let bd = 100; // 10px radius
    for (const h of hitsRef.current) {
      const dd = (h.x - mx) ** 2 + (h.y - my) ** 2;
      if (dd < bd) {
        bd = dd;
        best = h;
      }
    }
    setTip(best ? { x: mx, y: my, hit: best } : null);
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  return (
    <div className="map-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="map-canvas"
        style={{ width: size.w, height: size.h }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setTip(null)}
        onDoubleClick={(e) => {
          const r = canvasRef.current!.getBoundingClientRect();
          zoomAt(e.clientX - r.left, e.clientY - r.top, 2);
        }}
      />
      {!img && <div className="map-loading">Loading minimap…</div>}
      <div className="zoom-ctl">
        <button title="Zoom in" onClick={() => zoomAt(size.w / 2, size.h / 2, 1.5)}>+</button>
        <button title="Zoom out" onClick={() => zoomAt(size.w / 2, size.h / 2, 1 / 1.5)}>−</button>
        <button title="Fit map" onClick={fit}>⤢</button>
      </div>
      {focus && <Roster refs={refs} t={t} />}
      {tip && <Tooltip x={tip.x} y={tip.y} hit={tip.hit} />}
    </div>
  );
}

function Tooltip({ x, y, hit }: { x: number; y: number; hit: Hit }) {
  const st = EVENT_BY_CODE[hit.code];
  const { j, match } = hit.ref;
  return (
    <div className="tooltip" style={{ left: x + 14, top: y + 14 }}>
      <div className="tooltip-title" style={{ color: st.color }}>{st.label}</div>
      <div>
        {j.bot ? 'Bot' : 'Human'} <code>{shortId(j.id)}</code>
        {j.idMismatch && <span className="muted"> (numeric ID)</span>}
      </div>
      <div className="muted">
        {fmtClock(hit.t)} into match · {fmtDate(match.date)} · <code>{match.id.slice(0, 8)}</code>
      </div>
    </div>
  );
}
