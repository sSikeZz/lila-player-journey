import { DEATH_CODES, JourneyRef, KILL_CODES } from './data';

export type HeatKind = 'off' | 'traffic' | 'kills' | 'deaths' | 'storm' | 'loot';

export const HEAT_KINDS: { kind: HeatKind; label: string; hint: string }[] = [
  { kind: 'off', label: 'Off', hint: '' },
  { kind: 'traffic', label: 'Traffic', hint: 'Where players spend time (position samples, ~5 s apart)' },
  { kind: 'kills', label: 'Kills', hint: 'Where kills happen (player + bot kills)' },
  { kind: 'deaths', label: 'Deaths', hint: 'Where players die (player, bot and storm)' },
  { kind: 'storm', label: 'Storm', hint: 'Storm deaths only' },
  { kind: 'loot', label: 'Loot', hint: 'Item pickups' },
];

const EVENT_SET: Partial<Record<HeatKind, number[]>> = {
  kills: KILL_CODES,
  deaths: DEATH_CODES,
  storm: [4],
  loot: [5],
};

const N = 256;

// transparent -> blue -> teal -> yellow -> red
const RAMP: [number, number, number, number, number][] = [
  [0.0, 30, 70, 220, 0],
  [0.2, 40, 120, 255, 0.45],
  [0.45, 60, 220, 190, 0.7],
  [0.7, 255, 225, 60, 0.85],
  [1.0, 255, 50, 40, 0.95],
];

function ramp(v: number): [number, number, number, number] {
  for (let i = 1; i < RAMP.length; i++) {
    if (v <= RAMP[i][0]) {
      const a = RAMP[i - 1];
      const b = RAMP[i];
      const f = (v - a[0]) / (b[0] - a[0]);
      return [a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2]), a[3] + f * (b[3] - a[3]), a[4] + f * (b[4] - a[4])];
    }
  }
  const l = RAMP[RAMP.length - 1];
  return [l[1], l[2], l[3], l[4]];
}

function boxBlur(src: Float32Array, r: number): Float32Array {
  const tmp = new Float32Array(N * N);
  const out = new Float32Array(N * N);
  const w = 2 * r + 1;
  for (let y = 0; y < N; y++) {
    let acc = 0;
    for (let x = -r; x <= r; x++) acc += src[y * N + Math.min(N - 1, Math.max(0, x))];
    for (let x = 0; x < N; x++) {
      tmp[y * N + x] = acc / w;
      acc += src[y * N + Math.min(N - 1, x + r + 1)] - src[y * N + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < N; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(N - 1, Math.max(0, y)) * N + x];
    for (let y = 0; y < N; y++) {
      out[y * N + x] = acc / w;
      acc += tmp[Math.min(N - 1, y + r + 1) * N + x] - tmp[Math.max(0, y - r) * N + x];
    }
  }
  return out;
}

export interface Heat {
  canvas: HTMLCanvasElement;
  samples: number;
}

/** Density grid of the selected signal, up to match-time `t`, rendered to an N×N RGBA canvas. */
export function buildHeat(refs: JourneyRef[], kind: HeatKind, t: number): Heat | null {
  if (kind === 'off') return null;
  let grid = new Float32Array(N * N);
  let samples = 0;
  const add = (x: number, y: number) => {
    const gx = Math.floor(x * N);
    const gy = Math.floor(y * N);
    if (gx < 0 || gy < 0 || gx >= N || gy >= N) return;
    grid[gy * N + gx] += 1;
    samples++;
  };

  if (kind === 'traffic') {
    // movement samples only (not event locations) => density ∝ time spent
    for (const { j } of refs) {
      const p = j.path;
      for (let i = 0; i < p.length; i += 3) {
        if (p[i] > t) break;
        add(p[i + 1], p[i + 2]);
      }
    }
  } else {
    const codes = EVENT_SET[kind]!;
    for (const { j } of refs) {
      const e = j.ev;
      for (let i = 0; i < e.length; i += 4) {
        if (e[i + 1] <= t && codes.includes(e[i])) add(e[i + 2], e[i + 3]);
      }
    }
  }
  if (!samples) return { canvas: document.createElement('canvas'), samples: 0 };

  // Sparse events need a wider kernel to read as "zones" rather than dots.
  const r = kind === 'traffic' ? 2 : samples < 50 ? 5 : 4;
  for (let pass = 0; pass < 3; pass++) grid = boxBlur(grid, r);

  // Normalise against a high percentile so one hotspot doesn't wash out the rest.
  const nz = Array.from(grid).filter((v) => v > 0).sort((a, b) => a - b);
  const max = nz[Math.floor(nz.length * 0.995)] || nz[nz.length - 1];

  const canvas = document.createElement('canvas');
  canvas.width = N;
  canvas.height = N;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(N, N);
  for (let i = 0; i < grid.length; i++) {
    const v = Math.sqrt(Math.min(1, grid[i] / max));
    if (v < 0.04) continue;
    const [cr, cg, cb, ca] = ramp(v);
    img.data[i * 4] = cr;
    img.data[i * 4 + 1] = cg;
    img.data[i * 4 + 2] = cb;
    img.data[i * 4 + 3] = ca * 255;
  }
  ctx.putImageData(img, 0, 0);
  return { canvas, samples };
}
