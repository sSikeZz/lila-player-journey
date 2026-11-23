import { useMemo } from 'react';
import { BOT_COLOR, EVENTS, HUMAN_COLOR, MapMeta, Match } from '../data';
import { fmtClock, fmtDate, fmtUtc, pct } from '../format';
import { HEAT_KINDS, HeatKind } from '../heatmap';
import { LineIcon, MarkerIcon } from './MarkerIcon';

export type SortKey = 'time' | 'duration' | 'combat' | 'players';

export interface UIState {
  mapId: string;
  dates: string[];
  matchId: string | null;
  humans: boolean;
  bots: boolean;
  paths: boolean;
  grid: boolean;
  markers: Record<number, boolean>;
  heat: HeatKind;
  heatOpacity: number;
  multiOnly: boolean;
  sort: SortKey;
}

export interface Stats {
  matches: number;
  humans: number;
  bots: number;
  humansSurvived: number;
  eventCounts: Record<number, number>;
}

interface Props {
  ui: UIState;
  set: (patch: Partial<UIState>) => void;
  maps: MapMeta[];
  matches: Match[] | null; // filtered list for current map, null while loading
  stats: Stats;
  heatSamples: number | null;
}

const MAP_LABEL: Record<string, string> = {
  AmbroseValley: 'Ambrose Valley',
  GrandRift: 'Grand Rift',
  Lockdown: 'Lockdown',
};

const kills = (m: Match) => (m.counts.Kill ?? 0) + (m.counts.BotKill ?? 0);
const deaths = (m: Match) => (m.counts.Killed ?? 0) + (m.counts.BotKilled ?? 0);
const combat = (m: Match) => kills(m) + deaths(m) + (m.counts.KilledByStorm ?? 0);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function Sidebar({ ui, set, maps, matches, stats, heatSamples }: Props) {
  const meta = maps.find((m) => m.id === ui.mapId);

  const sorted = useMemo(() => {
    if (!matches) return [];
    const arr = [...matches];
    const by: Record<SortKey, (m: Match) => number> = {
      time: (m) => -m.start,
      duration: (m) => -m.dur,
      combat: (m) => -combat(m),
      players: (m) => -m.journeys.length,
    };
    return arr.sort((a, b) => by[ui.sort](a) - by[ui.sort](b));
  }, [matches, ui.sort]);

  const toggleDate = (d: string) =>
    set({ dates: ui.dates.includes(d) ? ui.dates.filter((x) => x !== d) : [...ui.dates, d], matchId: null });

  return (
    <aside className="sidebar">
      <header className="brand">
        <div className="logo" />
        <div>
          <h1>Player Journeys</h1>
          <p className="muted">LILA BLACK · Feb 10–14, 2026</p>
        </div>
      </header>

      <section>
        <h2>Map</h2>
        <div className="seg">
          {maps.map((m) => (
            <button
              key={m.id}
              className={m.id === ui.mapId ? 'on' : ''}
              onClick={() => set({ mapId: m.id, matchId: null, dates: [] })}
            >
              {MAP_LABEL[m.id] ?? m.id}
              <small>{m.matches}</small>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>
          Date <span className="muted">{ui.dates.length ? `${ui.dates.length} selected` : 'all days'}</span>
        </h2>
        <div className="chips">
          {meta?.dates.map((d) => (
            <button key={d} className={ui.dates.includes(d) ? 'chip on' : 'chip'} onClick={() => toggleDate(d)}>
              {fmtDate(d)}
              {d === '2026-02-14' && <span title="Partial day (collection ongoing)">*</span>}
            </button>
          ))}
          {ui.dates.length > 0 && (
            <button className="chip ghost" onClick={() => set({ dates: [], matchId: null })}>
              Clear
            </button>
          )}
        </div>
      </section>

      <section className="matches">
        <h2>
          Matches <span className="muted">{matches ? `${matches.length}` : '…'}</span>
        </h2>
        <div className="row list-ctl">
          <select value={ui.sort} onChange={(e) => set({ sort: e.target.value as SortKey })} aria-label="Sort matches">
            <option value="time">Newest first</option>
            <option value="combat">Most combat</option>
            <option value="duration">Longest</option>
            <option value="players">Most journeys</option>
          </select>
          <label className="toggle small" title="Most matches only contain a single player's file">
            <input type="checkbox" checked={ui.multiOnly} onChange={(e) => set({ multiOnly: e.target.checked, matchId: null })} />
            2+ journeys only
          </label>
        </div>
        <ul className="match-list">
          <li className={ui.matchId === null ? 'sel all' : 'all'} onClick={() => set({ matchId: null })}>
            <b>All matches</b>
            <span className="muted">aggregate view</span>
          </li>
          {sorted.map((m) => (
            <li key={m.id} className={ui.matchId === m.id ? 'sel' : ''} onClick={() => set({ matchId: m.id })}>
              <div className="m-top">
                <span>
                  {fmtDate(m.date)} · {fmtUtc(m.start)}
                </span>
                <span className="muted">{fmtClock(m.dur)}</span>
              </div>
              <div className="m-bot">
                <span style={{ color: HUMAN_COLOR }}>{m.humans}H</span>
                {m.bots > 0 && <span style={{ color: BOT_COLOR }}>{m.bots}B</span>}
                {kills(m) > 0 && <span className="pill k">{plural(kills(m), 'kill')}</span>}
                {deaths(m) > 0 && <span className="pill d">{plural(deaths(m), 'death')}</span>}
                {(m.counts.KilledByStorm ?? 0) > 0 && <span className="pill s">storm</span>}
                <code className="muted">{m.id.slice(0, 6)}</code>
              </div>
            </li>
          ))}
        </ul>
      </section>
      <section className="stats">
        <div>
          <b>{stats.matches}</b>
          <span>matches</span>
        </div>
        <div>
          <b>{pct(stats.humansSurvived, stats.humans)}</b>
          <span>humans survived</span>
        </div>
        <div>
          <b>{stats.eventCounts[4] ?? 0}</b>
          <span>storm deaths</span>
        </div>
      </section>

      <section>
        <h2>Show</h2>
        <label className="row toggle">
          <input type="checkbox" checked={ui.humans} onChange={(e) => set({ humans: e.target.checked })} />
          <LineIcon color={HUMAN_COLOR} /> Humans <span className="count">{stats.humans}</span>
        </label>
        <label className="row toggle">
          <input type="checkbox" checked={ui.bots} onChange={(e) => set({ bots: e.target.checked })} />
          <LineIcon color={BOT_COLOR} dashed /> Bots <span className="count">{stats.bots}</span>
        </label>
        <label className="row toggle">
          <input type="checkbox" checked={ui.paths} onChange={(e) => set({ paths: e.target.checked })} />
          Movement paths
        </label>
        <label className="row toggle">
          <input type="checkbox" checked={ui.grid} onChange={(e) => set({ grid: e.target.checked })} />
          Zone grid (A1–H8)
        </label>
      </section>

      <section>
        <h2>Events</h2>
        {EVENTS.map((ev) => (
          <label key={ev.code} className="row toggle">
            <input
              type="checkbox"
              checked={!!ui.markers[ev.code]}
              onChange={(e) => set({ markers: { ...ui.markers, [ev.code]: e.target.checked } })}
            />
            <MarkerIcon shape={ev.shape} color={ev.color} />
            {ev.label}
            <span className="count">{stats.eventCounts[ev.code] ?? 0}</span>
          </label>
        ))}
      </section>

      <section>
        <h2>
          Heatmap
          {heatSamples !== null && ui.heat !== 'off' && <span className="muted">{heatSamples.toLocaleString()} samples</span>}
        </h2>
        <div className="seg wrap">
          {HEAT_KINDS.map((h) => (
            <button key={h.kind} className={ui.heat === h.kind ? 'on' : ''} title={h.hint} onClick={() => set({ heat: h.kind })}>
              {h.label}
            </button>
          ))}
        </div>
        {ui.heat !== 'off' && (
          <>
            <div className="heat-legend" aria-label="Heatmap scale: low to high">
              <span>Low</span>
              <span className="bar" />
              <span>High</span>
            </div>
            <p className="hint">{HEAT_KINDS.find((h) => h.kind === ui.heat)?.hint}. Respects all filters &amp; the timeline.</p>
            <label className="row slider">
              Opacity
              <input
                type="range"
                min={0.2}
                max={1}
                step={0.05}
                value={ui.heatOpacity}
                onChange={(e) => set({ heatOpacity: Number(e.target.value) })}
              />
            </label>
          </>
        )}
      </section>

    </aside>
  );
}
