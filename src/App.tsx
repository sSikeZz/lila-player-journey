import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEATH_CODES, JourneyRef, loadIndex, loadMap, MapData, MapMeta } from './data';
import { fmtClock, fmtDate, fmtUtc } from './format';
import { buildHeat } from './heatmap';
import { MapView } from './components/MapView';
import { Sidebar, Stats, UIState } from './components/Sidebar';
import { Timeline } from './components/Timeline';

const DEFAULT_UI: UIState = {
  mapId: 'AmbroseValley',
  dates: [],
  matchId: null,
  humans: true,
  bots: true,
  paths: true,
  grid: false,
  // loot is ~13k markers: off by default to keep the aggregate view readable
  markers: { 0: true, 1: true, 2: true, 3: true, 4: true, 5: false },
  heat: 'off',
  heatOpacity: 0.75,
  multiOnly: false,
  sort: 'time',
};

// Shareable links: map / match / dates / heatmap live in the URL hash.
function readHash(): Partial<UIState> {
  const p = new URLSearchParams(location.hash.slice(1));
  const out: Partial<UIState> = {};
  if (p.get('map')) out.mapId = p.get('map')!;
  if (p.get('match')) out.matchId = p.get('match');
  if (p.get('dates')) out.dates = p.get('dates')!.split(',');
  if (p.get('heat')) out.heat = p.get('heat') as UIState['heat'];
  return out;
}
function writeHash(ui: UIState) {
  const p = new URLSearchParams();
  p.set('map', ui.mapId);
  if (ui.matchId) p.set('match', ui.matchId);
  if (ui.dates.length) p.set('dates', ui.dates.join(','));
  if (ui.heat !== 'off') p.set('heat', ui.heat);
  history.replaceState(null, '', `#${p.toString()}`);
}

export default function App() {
  const [ui, setUi] = useState<UIState>(() => ({ ...DEFAULT_UI, ...readHash() }));
  const set = useCallback((patch: Partial<UIState>) => setUi((u) => ({ ...u, ...patch })), []);
  const [maps, setMaps] = useState<MapMeta[]>([]);
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [t, setT] = useState(0);
  const tRef = useRef(0);
  tRef.current = t;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(15);

  useEffect(() => writeHash(ui), [ui]);
  // a link pasted into an already-open tab (or edited hash) should apply too
  useEffect(() => {
    const onHash = () => setUi((u) => ({ ...u, matchId: null, dates: [], heat: 'off', ...readHash() }));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    loadIndex().then((i) => setMaps(i.maps), (e) => setError(String(e)));
  }, []);

  useEffect(() => {
    setData(null);
    loadMap(ui.mapId).then(setData, (e) => setError(String(e)));
  }, [ui.mapId]);

  const meta = maps.find((m) => m.id === ui.mapId);

  // ---- filtering
  const filtered = useMemo(() => {
    if (!data) return null;
    return data.matches.filter(
      (m) => (!ui.dates.length || ui.dates.includes(m.date)) && (!ui.multiOnly || m.journeys.length > 1),
    );
  }, [data, ui.dates, ui.multiOnly]);

  const selected = useMemo(
    () => (ui.matchId && data ? data.matches.find((m) => m.id === ui.matchId) ?? null : null),
    [data, ui.matchId],
  );
  const focus = !!selected;

  const refs: JourneyRef[] = useMemo(() => {
    const scope = selected ? [selected] : filtered ?? [];
    const out: JourneyRef[] = [];
    for (const match of scope)
      for (const j of match.journeys) if (j.bot ? ui.bots : ui.humans) out.push({ j, match });
    return out;
  }, [selected, filtered, ui.humans, ui.bots]);

  const tMax = useMemo(() => {
    if (selected) return selected.dur;
    return (filtered ?? []).reduce((a, m) => Math.max(a, m.dur), 0);
  }, [selected, filtered]);

  // Reset playback to "show everything" whenever the scope changes.
  useEffect(() => {
    setPlaying(false);
    setT(tMax);
  }, [tMax, selected, filtered]);

  // ---- playback loop
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    let id = 0;
    const step = (now: number) => {
      const next = tRef.current + ((now - last) / 1000) * speed;
      last = now;
      if (next >= tMax) {
        setT(tMax);
        setPlaying(false);
        return;
      }
      setT(next);
      id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [playing, speed, tMax]);

  const togglePlay = useCallback(() => {
    if (!playing && tRef.current >= tMax) setT(0);
    setPlaying((p) => !p);
  }, [playing, tMax]);

  // keyboard: space = play/pause, ←/→ = seek 5 s, Esc = back to all matches
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' && (e.target as HTMLInputElement).type !== 'range') return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowRight') setT((x) => Math.min(tMax, x + 5));
      else if (e.code === 'ArrowLeft') setT((x) => Math.max(0, x - 5));
      else if (e.code === 'Escape') set({ matchId: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, tMax, set]);

  // ---- heatmap (re-binned every 2 s of match time during playback)
  const heatT = t >= tMax ? tMax : Math.ceil(t / 2) * 2;
  const heat = useMemo(() => buildHeat(refs, ui.heat, heatT), [refs, ui.heat, heatT]);

  // ---- stats for what's on screen (up to time t)
  const stats: Stats = useMemo(() => {
    const eventCounts: Record<number, number> = {};
    let humans = 0;
    let bots = 0;
    let humansSurvived = 0;
    for (const { j } of refs) {
      if (j.bot) bots++;
      else {
        humans++;
        let died = false;
        for (let i = 0; i < j.ev.length; i += 4) if (DEATH_CODES.includes(j.ev[i])) died = true;
        if (!died) humansSurvived++;
      }
      for (let i = 0; i < j.ev.length; i += 4) eventCounts[j.ev[i]] = (eventCounts[j.ev[i]] ?? 0) + 1;
    }
    return { matches: selected ? 1 : filtered?.length ?? 0, humans, bots, humansSurvived, eventCounts };
  }, [refs, selected, filtered]);

  if (error)
    return (
      <div className="fatal">
        Couldn’t load data: <code>{error}</code>
      </div>
    );

  return (
    <div className="app">
      <Sidebar ui={ui} set={set} maps={maps} matches={filtered} stats={stats} heatSamples={heat?.samples ?? null} />
      <main className="stage">
        <div className="stage-head">
          {selected ? (
            <>
              <button className="back" onClick={() => set({ matchId: null })} title="Back to all matches (Esc)">
                ← All matches
              </button>
              <span>
                Match <code>{selected.id.slice(0, 8)}</code> · {fmtDate(selected.date)} {fmtUtc(selected.start)} UTC ·{' '}
                {fmtClock(selected.dur)} · {selected.humans} human{selected.humans === 1 ? '' : 's'}, {selected.bots} bot
                {selected.bots === 1 ? '' : 's'}
              </span>
            </>
          ) : (
            <span>
              {filtered ? filtered.length : '…'} matches on {meta?.id ?? ui.mapId}
              {ui.dates.length ? ` · ${ui.dates.map(fmtDate).join(', ')}` : ' · all days'}
              <span className="muted"> — pick a match on the left to replay it</span>
            </span>
          )}
        </div>
        {meta ? (
          <MapView
            image={meta.image}
            refs={refs}
            focus={focus}
            t={t}
            showPaths={ui.paths}
            markerOn={ui.markers}
            heat={heat}
            heatOpacity={ui.heatOpacity}
            showGrid={ui.grid}
          />
        ) : (
          <div className="map-wrap" />
        )}
        {!data && <div className="loading-bar" />}
        <Timeline
          t={t}
          max={tMax}
          playing={playing}
          speed={speed}
          focus={focus}
          refs={refs}
          onSeek={(v) => {
            setPlaying(false);
            setT(v);
          }}
          onPlay={togglePlay}
          onSpeed={setSpeed}
        />
      </main>
    </div>
  );
}
