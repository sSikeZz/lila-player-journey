import { EVENT_BY_CODE, JourneyRef } from '../data';
import { fmtClock } from '../format';

interface Props {
  t: number;
  max: number;
  playing: boolean;
  speed: number;
  focus: boolean;
  refs: JourneyRef[];
  onSeek: (t: number) => void;
  onPlay: () => void;
  onSpeed: (s: number) => void;
}

const SPEEDS = [1, 5, 15, 30, 60];

export function Timeline({ t, max, playing, speed, focus, refs, onSeek, onPlay, onSpeed }: Props) {
  // In match view, show kills/deaths as ticks so you can jump straight to the action.
  const ticks: { t: number; code: number }[] = [];
  if (focus && max > 0) {
    for (const { j } of refs) {
      for (let i = 0; i < j.ev.length; i += 4) if (j.ev[i] !== 5) ticks.push({ t: j.ev[i + 1], code: j.ev[i] });
    }
  }
  return (
    <div className="timeline">
      <button className="play" onClick={onPlay} title={playing ? 'Pause (space)' : 'Play (space)'} disabled={!max}>
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="clock">
        <b>{fmtClock(t)}</b>
        <span className="muted"> / {fmtClock(max)}</span>
      </div>
      <div className="track">
        <input
          type="range"
          min={0}
          max={max || 1}
          step={0.5}
          value={Math.min(t, max)}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Match time"
        />
        <div className="ticks">
          {ticks.map((k, i) => (
            <span
              key={i}
              className="tick"
              title={`${EVENT_BY_CODE[k.code].label} @ ${fmtClock(k.t)}`}
              style={{ left: `${(100 * k.t) / max}%`, background: EVENT_BY_CODE[k.code].color }}
              onClick={() => onSeek(k.t)}
            />
          ))}
        </div>
      </div>
      <div className="speeds" role="group" aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <button key={s} className={s === speed ? 'on' : ''} onClick={() => onSpeed(s)}>
            {s}×
          </button>
        ))}
      </div>
      <div className="timeline-hint muted">
        {focus ? 'Match time' : 'Match time — all filtered matches aligned at start'}
      </div>
    </div>
  );
}
