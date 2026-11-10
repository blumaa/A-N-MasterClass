// Coaching slot engine (G19, Kajabi Scheduler model). Pure: availability in the coach's zone +
// busy times in, bookable UTC start instants out. Windows are minutes after local midnight; a
// date override replaces that day's weekly rules (null start = day blocked). Buffers pad both
// sides of a candidate before checking it against busy time.
import { utcToZonedInput, zonedToUtc } from '@/lib/format/zoned';

export type WeeklyRule = { weekday: number; startMinute: number; endMinute: number }; // weekday 0 = Sunday
export type DateOverride = { date: string; startMinute: number | null; endMinute: number | null }; // date YYYY-MM-DD
export type Busy = { start: Date; end: Date };

export type Schedule = {
  timeZone: string;
  rules: readonly WeeklyRule[];
  overrides: readonly DateOverride[];
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  windowDays: number;
};

export type SlotQuery = { durationMin: number; busy: readonly Busy[]; now: Date; stepMin?: number };

/** Kajabi's default availability: weekdays 9am to 5pm. */
export const DEFAULT_RULES: readonly WeeklyRule[] = [1, 2, 3, 4, 5].map((weekday) => ({
  weekday,
  startMinute: 9 * 60,
  endMinute: 17 * 60,
}));

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar dates from today (in the zone) for `count` days. */
function localDates(now: Date, timeZone: string, count: number): { date: string; weekday: number }[] {
  const [y, m, d] = utcToZonedInput(now, timeZone).slice(0, 10).split('-').map(Number) as [number, number, number];
  return Array.from({ length: count }, (_, i) => {
    const day = new Date(Date.UTC(y, m - 1, d + i));
    return { date: day.toISOString().slice(0, 10), weekday: day.getUTCDay() };
  });
}

function windowsFor(s: Schedule, date: string, weekday: number): { startMinute: number; endMinute: number }[] {
  const overrides = s.overrides.filter((o) => o.date === date);
  if (overrides.length === 0) return s.rules.filter((r) => r.weekday === weekday);
  return overrides.flatMap((o) => (o.startMinute === null || o.endMinute === null ? [] : [{ startMinute: o.startMinute, endMinute: o.endMinute }]));
}

export function availableSlots(s: Schedule, q: SlotQuery): Date[] {
  const step = q.stepMin ?? 30;
  const earliest = q.now.getTime() + s.minNoticeMin * MINUTE_MS;
  const latest = q.now.getTime() + s.windowDays * DAY_MS;
  const before = s.bufferBeforeMin * MINUTE_MS;
  const after = s.bufferAfterMin * MINUTE_MS;
  const length = q.durationMin * MINUTE_MS;
  const free = (start: number) =>
    q.busy.every((b) => !(start - before < b.end.getTime() && b.start.getTime() < start + length + after));

  const seen = new Set<number>();
  const out: Date[] = [];
  for (const { date, weekday } of localDates(q.now, s.timeZone, s.windowDays + 1)) {
    for (const w of windowsFor(s, date, weekday)) {
      for (let m = w.startMinute; m + q.durationMin <= w.endMinute; m += step) {
        const at = zonedToUtc(`${date}T${pad(Math.floor(m / 60))}:${pad(m % 60)}`, s.timeZone);
        const t = at?.getTime();
        if (t === undefined || seen.has(t) || t < earliest || t > latest || !free(t)) continue;
        seen.add(t);
        out.push(new Date(t));
      }
    }
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

/** True when `start` is one of the offered slots (same grid, notice, window and busy checks). */
export function isBookable(s: Schedule, q: SlotQuery & { start: Date }): boolean {
  return availableSlots(s, q).some((d) => d.getTime() === q.start.getTime());
}
