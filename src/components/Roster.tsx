import { DEATH_CODES, EVENT_BY_CODE, JourneyRef, KILL_CODES } from '../data';
import { fmtClock, shortId } from '../format';
import { colorFor } from '../render';

/** Match view: who is in this match and how each journey is going at time t. */
export function Roster({ refs, t }: { refs: JourneyRef[]; t: number }) {
  const colorOf = colorFor(refs, true);
  const humans = refs.filter((r) => !r.j.bot);
  const bots = refs.filter((r) => r.j.bot);
  const botsAlive = bots.filter(({ j }) => !deathAt(j.ev, t)).length;

  return (
    <div className="roster">
      {humans.map(({ j }) => {
        const death = deathAt(j.ev, t);
        const end = j.track[j.track.length - 3];
        let kills = 0;
        let loot = 0;
        for (let i = 0; i < j.ev.length; i += 4) {
          if (j.ev[i + 1] > t) continue;
          if (KILL_CODES.includes(j.ev[i])) kills++;
          if (j.ev[i] === 5) loot++;
        }
        const status = death
          ? `${EVENT_BY_CODE[death.code].label.replace('Death · ', 'Died · ')} ${fmtClock(death.t)}`
          : t >= end && j.out === 'survived'
            ? `Survived · left ${fmtClock(end)}`
            : 'Alive';
        return (
          <div className="roster-row" key={j.id}>
            <span className="sw" style={{ background: colorOf(j) }} />
            <code>{shortId(j.id)}</code>
            <span className={death ? 'st dead' : 'st'}>{status}</span>
            <span className="muted">
              {kills}K · {loot} loot
            </span>
          </div>
        );
      })}
      {bots.length > 0 && (
        <div className="roster-row muted">
          <span className="sw bot" />
          {bots.length} bots · {botsAlive} alive
        </div>
      )}
    </div>
  );
}

function deathAt(ev: number[], t: number): { code: number; t: number } | null {
  for (let i = 0; i < ev.length; i += 4) if (DEATH_CODES.includes(ev[i]) && ev[i + 1] <= t) return { code: ev[i], t: ev[i + 1] };
  return null;
}
