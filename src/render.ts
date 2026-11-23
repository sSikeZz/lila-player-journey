import { BOT_COLOR, EVENT_BY_CODE, HUMAN_COLOR, JourneyRef, Shape } from './data';

/** screen = t + n * base * scale, where n is a 0..1 image coordinate */
export interface View {
  scale: number;
  tx: number;
  ty: number;
}

export interface Hit {
  x: number;
  y: number;
  code: number;
  t: number;
  ref: JourneyRef;
}

export function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, x: number, y: number, r: number, color: string) {
  ctx.save(); // inherits globalAlpha from caller
  ctx.lineWidth = Math.max(1.5, r * 0.35);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.beginPath();
  switch (shape) {
    case 'cross':
      ctx.moveTo(x - r, y);
      ctx.lineTo(x + r, y);
      ctx.moveTo(x, y - r);
      ctx.lineTo(x, y + r);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'x':
      ctx.moveTo(x - r * 0.7, y - r * 0.7);
      ctx.lineTo(x + r * 0.7, y + r * 0.7);
      ctx.moveTo(x + r * 0.7, y - r * 0.7);
      ctx.lineTo(x - r * 0.7, y + r * 0.7);
      ctx.stroke();
      break;
    case 'circleX':
      ctx.fillStyle = 'rgba(10,12,18,0.75)';
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - r * 0.45, y - r * 0.45);
      ctx.lineTo(x + r * 0.45, y + r * 0.45);
      ctx.moveTo(x + r * 0.45, y - r * 0.45);
      ctx.lineTo(x - r * 0.45, y + r * 0.45);
      ctx.stroke();
      break;
    case 'diamond':
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
    case 'square':
      ctx.rect(x - r * 0.55, y - r * 0.55, r * 1.1, r * 1.1);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
      break;
  }
  ctx.restore();
}

/** 8×8 reference grid (columns A–H, rows 1–8) so zones can be named in discussions / INSIGHTS.md */
export function drawGrid(ctx: CanvasRenderingContext2D, view: View, base: number) {
  const G = 8;
  const S = base * view.scale;
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i <= G; i++) {
    const o = (i / G) * S;
    ctx.moveTo(view.tx + o, view.ty);
    ctx.lineTo(view.tx + o, view.ty + S);
    ctx.moveTo(view.tx, view.ty + o);
    ctx.lineTo(view.tx + S, view.ty + o);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '600 11px Inter, system-ui, sans-serif';
  for (let r = 0; r < G; r++)
    for (let c = 0; c < G; c++) ctx.fillText(`${'ABCDEFGH'[c]}${r + 1}`, view.tx + (c / G) * S + 4, view.ty + (r / G) * S + 13);
  ctx.restore();
}

/** Position of a journey at fractional time t (linear interpolation), or null if not started. */
export function positionAt(path: number[], t: number): [number, number] | null {
  if (!path.length || path[0] > t) return null;
  for (let i = 3; i < path.length; i += 3) {
    if (path[i] > t) {
      const t0 = path[i - 3];
      const f = path[i] === t0 ? 0 : (t - t0) / (path[i] - t0);
      return [path[i - 2] + f * (path[i + 1] - path[i - 2]), path[i - 1] + f * (path[i + 2] - path[i - 1])];
    }
  }
  return [path[path.length - 2], path[path.length - 1]];
}

export interface DrawOpts {
  focus: boolean; // single match selected
  t: number;
  showPaths: boolean;
  markerOn: Record<number, boolean>;
  colorOf: (j: JourneyRef['j']) => string;
  /** fade paths/markers so a heatmap underneath stays readable */
  dim: boolean;
}

// Distinct per-human colours in match view (cool hues, away from marker colours).
export const HUMAN_PALETTE = [HUMAN_COLOR, '#4dffb8', '#f2f5ff', '#6f8bff', '#9be15d', '#00e5d0'];

export function colorFor(refs: JourneyRef[], focus: boolean): (j: JourneyRef['j']) => string {
  if (!focus) return (j) => (j.bot ? BOT_COLOR : HUMAN_COLOR);
  const m = new Map<JourneyRef['j'], string>();
  let i = 0;
  for (const { j } of refs) if (!j.bot) m.set(j, HUMAN_PALETTE[i++ % HUMAN_PALETTE.length]);
  return (j) => m.get(j) ?? (j.bot ? BOT_COLOR : HUMAN_COLOR);
}

export function drawJourneys(
  ctx: CanvasRenderingContext2D,
  refs: JourneyRef[],
  view: View,
  base: number,
  o: DrawOpts,
): Hit[] {
  const S = base * view.scale;
  const X = (n: number) => view.tx + n * S;
  const Y = (n: number) => view.ty + n * S;
  const zoomK = Math.min(2, Math.max(1, Math.sqrt(view.scale)));

  // --- paths (bots first so humans sit on top)
  if (o.showPaths) {
    const ordered = [...refs].sort((a, b) => Number(b.j.bot) - Number(a.j.bot));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const { j } of ordered) {
      const p = j.track;
      if (!p.length || p[0] > o.t) continue;
      ctx.strokeStyle = o.colorOf(j);
      if (o.focus) {
        ctx.globalAlpha = j.bot ? 0.75 : 0.95;
        ctx.lineWidth = (j.bot ? 1.4 : 2.2) * zoomK;
      } else {
        ctx.globalAlpha = (j.bot ? 0.22 : 0.3) * (o.dim ? 0.35 : 1);
        ctx.lineWidth = j.bot ? 0.8 : 1;
      }
      ctx.setLineDash(j.bot ? [4 * zoomK, 3 * zoomK] : []);
      ctx.beginPath();
      ctx.moveTo(X(p[1]), Y(p[2]));
      let i = 3;
      for (; i < p.length && p[i] <= o.t; i += 3) ctx.lineTo(X(p[i + 1]), Y(p[i + 2]));
      if (o.focus && i < p.length) {
        const pos = positionAt(p, o.t);
        if (pos) ctx.lineTo(X(pos[0]), Y(pos[1]));
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  // --- event markers
  const hits: Hit[] = [];
  const r = (o.focus ? 6 : 3.5) * zoomK;
  // loot first (most numerous), deaths last so they're never hidden
  const order = [5, 2, 0, 3, 1, 4];
  ctx.globalAlpha = o.dim ? 0.3 : 1;
  for (const code of order) {
    if (!o.markerOn[code]) continue;
    const st = EVENT_BY_CODE[code];
    const rr = code === 5 ? r * 0.75 : r;
    for (const ref of refs) {
      const e = ref.j.ev;
      for (let i = 0; i < e.length; i += 4) {
        if (e[i] !== code || e[i + 1] > o.t) continue;
        const x = X(e[i + 2]);
        const y = Y(e[i + 3]);
        drawShape(ctx, st.shape, x, y, rr, st.color);
        hits.push({ x, y, code, t: e[i + 1], ref });
      }
    }
  }
  ctx.globalAlpha = 1;

  // --- live heads during playback (focus mode)
  if (o.focus && o.showPaths) {
    for (const ref of refs) {
      const p = ref.j.track;
      const pos = positionAt(p, o.t);
      if (!pos) continue;
      const ended = o.t >= p[p.length - 3];
      const x = X(pos[0]);
      const y = Y(pos[1]);
      ctx.beginPath();
      ctx.arc(x, y, (ref.j.bot ? 3.5 : 5) * zoomK, 0, Math.PI * 2);
      if (ended) {
        // survived to the end of the recording = likely extraction
        if (ref.j.out === 'survived' && !ref.j.bot) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(x, y, 9 * zoomK, 0, Math.PI * 2);
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = o.colorOf(ref.j);
        ctx.strokeStyle = '#0b0d12';
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  return hits;
}
