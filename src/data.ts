// Types + loaders for the static JSON produced by pipeline/build_data.py

export interface Journey {
  id: string;
  bot: boolean;
  /** movement samples only, flattened [t, ix, iy, ...]; ix/iy are 0..1 image coords, t = seconds since match start */
  path: number[];
  /** path + event locations merged in time order (built on load); used for drawing */
  track: number[];
  /** flattened [code, t, ix, iy, ...] */
  ev: number[];
  out: 'died' | 'survived';
  /** numeric user_id but human telemetry (see ARCHITECTURE.md) */
  idMismatch?: boolean;
}

export interface Match {
  id: string;
  date: string;
  /** unix seconds */
  start: number;
  dur: number;
  humans: number;
  bots: number;
  counts: Partial<Record<string, number>>;
  journeys: Journey[];
}

export interface MapMeta {
  id: string;
  image: string;
  scale: number;
  ox: number;
  oz: number;
  matches: number;
  dates: string[];
}

export interface MapData {
  map: string;
  matches: Match[];
}

export interface JourneyRef {
  j: Journey;
  match: Match;
}

export type Shape = 'cross' | 'x' | 'circleX' | 'diamond' | 'square';

export interface EventStyle {
  code: number;
  key: string;
  label: string;
  color: string;
  shape: Shape;
}

// Codes match EVENT_CODES in the pipeline. Shape AND colour differ so markers
// stay distinguishable for colour-blind users and in overlapping clusters.
export const EVENTS: EventStyle[] = [
  { code: 0, key: 'Kill', label: 'Kill · player', color: '#ff4d4d', shape: 'cross' },
  { code: 2, key: 'BotKill', label: 'Kill · bot', color: '#ffd23f', shape: 'x' },
  { code: 1, key: 'Killed', label: 'Death · by player', color: '#ff4d4d', shape: 'circleX' },
  { code: 3, key: 'BotKilled', label: 'Death · by bot', color: '#ff7ad9', shape: 'circleX' },
  { code: 4, key: 'KilledByStorm', label: 'Death · storm', color: '#b48cff', shape: 'diamond' },
  { code: 5, key: 'Loot', label: 'Loot pickup', color: '#46e08a', shape: 'square' },
];
export const EVENT_BY_CODE: Record<number, EventStyle> = Object.fromEntries(EVENTS.map((e) => [e.code, e]));

export const KILL_CODES = [0, 2];
export const DEATH_CODES = [1, 3, 4];

export const HUMAN_COLOR = '#3fd0ff';
export const BOT_COLOR = '#ff9f43';

const cache = new Map<string, Promise<unknown>>();
function getJSON<T>(url: string): Promise<T> {
  if (!cache.has(url)) {
    cache.set(
      url,
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
        return r.json();
      }),
    );
  }
  return cache.get(url) as Promise<T>;
}

/**
 * Merge movement samples and event locations into one time-ordered polyline,
 * so a drawn journey reaches the exact spot of each loot / kill / death.
 * At equal t the movement sample comes first (event happens at/after it).
 */
export function buildTrack(path: number[], ev: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let k = 0;
  const push = (t: number, x: number, y: number) => {
    const n = out.length;
    if (n && out[n - 3] === t && out[n - 2] === x && out[n - 1] === y) return;
    out.push(t, x, y);
  };
  while (i < path.length || k < ev.length) {
    if (k >= ev.length || (i < path.length && path[i] <= ev[k + 1])) {
      push(path[i], path[i + 1], path[i + 2]);
      i += 3;
    } else {
      push(ev[k + 1], ev[k + 2], ev[k + 3]);
      k += 4;
    }
  }
  return out;
}

export const loadIndex = () => getJSON<{ maps: MapMeta[] }>('data/index.json');

const prepared = new Map<string, Promise<MapData>>();
export function loadMap(id: string): Promise<MapData> {
  if (!prepared.has(id)) {
    prepared.set(
      id,
      getJSON<MapData>(`data/${id}.json`).then((d) => {
        for (const m of d.matches) for (const j of m.journeys) j.track = buildTrack(j.path, j.ev);
        return d;
      }),
    );
  }
  return prepared.get(id)!;
}
