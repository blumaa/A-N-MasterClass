// Wall-clock time in an IANA zone <-> UTC instant, for <input type="datetime-local"> values
// ("YYYY-MM-DDTHH:mm"). Uses Intl only; times stored UTC plus the zone name (G19).
const LOCAL = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

/** Known IANA zone name (Intl throws RangeError for unknown ones). */
export function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

function parts(d: Date, timeZone: string): Record<string, number> {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
  return Object.fromEntries(fmt.formatToParts(d).filter((p) => p.type !== 'literal').map((p) => [p.type, Number(p.value)]));
}

/** Zone offset (ms, local minus UTC) at an instant. */
function offsetAt(instant: number, timeZone: string): number {
  const p = parts(new Date(instant), timeZone);
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!) - Math.floor(instant / MINUTE_MS) * MINUTE_MS;
}

/**
 * UTC instant for a wall-clock time in `timeZone`; null if malformed or the zone is unknown.
 * A repeated hour (fall-back) gives the earlier instant; a skipped one (spring-forward) is moved
 * forward by the gap, like most calendar apps.
 */
export function zonedToUtc(local: string, timeZone: string): Date | null {
  const m = LOCAL.exec(local);
  if (!m) return null;
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number];
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const check = new Date(wall);
  if (check.getUTCMonth() !== mo - 1 || check.getUTCDate() !== d || h > 23 || mi > 59) return null;
  if (!isTimeZone(timeZone)) return null;
  // Offsets a day before and after the wall time cover both sides of a transition.
  const before = offsetAt(wall - DAY_MS, timeZone);
  const after = offsetAt(wall + DAY_MS, timeZone);
  const candidates = [wall - before, wall - after].filter((t) => offsetAt(t, timeZone) === wall - t);
  return new Date(candidates.length > 0 ? Math.min(...candidates) : wall - before);
}

/** datetime-local value of an instant in `timeZone`. */
export function utcToZonedInput(d: Date, timeZone: string): string {
  const p = parts(d, timeZone);
  const pad = (n: number | undefined) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}
