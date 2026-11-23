export function fmtClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-02-10' -> 'Feb 10' */
export function fmtDate(d: string): string {
  const [, m, day] = d.split('-');
  return `${MONTHS[Number(m) - 1]} ${Number(day)}`;
}

/** unix seconds -> 'HH:MM' UTC */
export function fmtUtc(unix: number): string {
  const d = new Date(unix * 1000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

export function shortId(id: string): string {
  return id.length > 8 ? id.slice(0, 8) : id;
}

export function pct(n: number, d: number): string {
  return d ? `${Math.round((100 * n) / d)}%` : '–';
}
