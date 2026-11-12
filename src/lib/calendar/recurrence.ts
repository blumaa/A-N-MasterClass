// Meetup repeats (G14, Kajabi "Repeat"): occurrence n of a series, computed in O(1) from the
// first one, never stored. Dates step in the meetup's zone and keep its wall-clock time, so a
// 19:00 Berlin weekly stays 19:00 across DST. SQL mirror: public.meetup_occurrence_start.
import type { Meetup, MeetupOccurrence } from '@/lib/data/types';
import { utcToZonedInput, zonedToUtc } from '@/lib/format/zoned';

export type Schedule = Pick<Meetup, 'startsAt' | 'endsAt' | 'timeZone' | 'repeat'>;
export type Window = { startsAt: Date; endsAt: Date };

const DAY_MS = 86_400_000;
/** Search cap: a daily series for ~270 years. */
const MAX_OCCURRENCE = 100_000;

/** Civil date as days since 1970-01-01 (UTC calendar math, no zone). */
const dayOf = (iso: string) => Date.parse(`${iso}T00:00Z`) / DAY_MS;
const isoOf = (day: number) => new Date(day * DAY_MS).toISOString().slice(0, 10);
/** ISO weekday, 1 = Monday. */
const weekday = (day: number) => ((((day + 3) % 7) + 7) % 7) + 1;
/** [local date, local time] of an instant in a zone. */
const localParts = (d: Date, zone: string) => utcToZonedInput(d, zone).split('T') as [string, string];
const monthStart = (year: number, month: number) => Date.UTC(year, month, 1) / DAY_MS;

function weeklyDay(first: number, every: number, days: readonly number[], n: number): number {
  const own = weekday(first);
  const set = [...new Set([...days, own])].toSorted((a, b) => a - b);
  const k = set.indexOf(own) + n;
  const monday = first - (own - 1);
  return monday + Math.floor(k / set.length) * every * 7 + set[k % set.length]! - 1;
}

function monthlyDay(first: number, every: number, n: number): number {
  const d = new Date(first * DAY_MS);
  const own = weekday(first);
  const ordinal = Math.ceil(d.getUTCDate() / 7);
  const month = d.getUTCMonth() + n * every;
  const start = monthStart(d.getUTCFullYear(), month);
  if (ordinal === 5) {
    const last = monthStart(d.getUTCFullYear(), month + 1) - 1;
    return last - ((weekday(last) - own + 7) % 7);
  }
  return start + ((own - weekday(start) + 7) % 7) + (ordinal - 1) * 7;
}

/** Local date (days) of occurrence n, ignoring the series end. */
function localDay(s: Schedule, first: number, n: number): number {
  const r = s.repeat!;
  if (r.freq === 'daily') return first + n * r.every;
  if (r.freq === 'weekly') return weeklyDay(first, r.every, r.days, n);
  return monthlyDay(first, r.every, n);
}

/** Computed window of occurrence n, or null when the series has no such occurrence. */
export function occurrenceWindow(s: Schedule, n: number): Window | null {
  if (!Number.isInteger(n) || n < 0) return null;
  if (n === 0) return { startsAt: s.startsAt, endsAt: s.endsAt };
  const r = s.repeat;
  if (!r || n > MAX_OCCURRENCE || (r.count !== null && n >= r.count)) return null;
  const [date, time] = localParts(s.startsAt, s.timeZone);
  const day = localDay(s, dayOf(date), n);
  if (r.until !== null && day > dayOf(r.until)) return null;
  const startsAt = zonedToUtc(`${isoOf(day)}T${time}`, s.timeZone)!;
  return { startsAt, endsAt: new Date(startsAt.getTime() + (s.endsAt.getTime() - s.startsAt.getTime())) };
}

/** Smallest n in [lo, MAX_OCCURRENCE] where `test` holds (it must stay true after), else null. */
function firstWhere(lo: number, test: (n: number) => boolean): number | null {
  if (test(lo)) return lo;
  let bad = lo;
  let step = 1;
  while (bad + step <= MAX_OCCURRENCE && !test(bad + step)) {
    bad += step;
    step *= 2;
  }
  let good = Math.min(bad + step, MAX_OCCURRENCE);
  if (!test(good)) return null;
  while (good - bad > 1) {
    const mid = Math.floor((bad + good) / 2);
    if (test(mid)) good = mid;
    else bad = mid;
  }
  return good;
}

/** Last occurrence index; null = endless. */
export function lastOccurrence(s: Schedule): number | null {
  const r = s.repeat;
  if (!r) return 0;
  if (r.count !== null) return r.count - 1;
  if (r.until === null) return null;
  return firstWhere(0, (n) => occurrenceWindow(s, n + 1) === null);
}

/**
 * Bounded listing around `now`: up to `pastMax` ended occurrences (newest first) and up to
 * `upcomingMax` not yet ended (live first).
 */
export function nearOccurrences(s: Schedule, now: Date, pastMax: number, upcomingMax: number) {
  const last = lastOccurrence(s) ?? MAX_OCCURRENCE;
  const next = firstWhere(0, (n) => n > last || occurrenceWindow(s, n)!.endsAt > now) ?? last + 1;
  const upcoming: number[] = [];
  for (let n = next; n <= last && upcoming.length < upcomingMax; n++) upcoming.push(n);
  const past: number[] = [];
  for (let n = Math.min(next, last + 1) - 1; n >= 0 && past.length < pastMax; n--) past.push(n);
  return { past, upcoming };
}

const rotate = (weekdayIso: number, by: number) => ((((weekdayIso - 1 + by) % 7) + 7) % 7) + 1;

/**
 * "All events" time change made on occurrence n: the series moves by the same number of days and
 * takes the new wall-clock time and duration, so every occurrence moves alike (weekly days too).
 */
export function movedSeries(s: Schedule, n: number, to: Window): Pick<Meetup, 'startsAt' | 'endsAt' | 'repeat'> | null {
  const from = occurrenceWindow(s, n);
  if (!from) return null;
  const [toDate, toTime] = localParts(to.startsAt, s.timeZone);
  const shift = dayOf(toDate) - dayOf(localParts(from.startsAt, s.timeZone)[0]);
  const first = dayOf(localParts(s.startsAt, s.timeZone)[0]);
  const startsAt = zonedToUtc(`${isoOf(first + shift)}T${toTime}`, s.timeZone)!;
  const repeat = s.repeat && { ...s.repeat, days: s.repeat.days.map((d) => rotate(d, shift)).toSorted((a, b) => a - b) };
  return { startsAt, endsAt: new Date(startsAt.getTime() + to.endsAt.getTime() - to.startsAt.getTime()), repeat };
}

/** One occurrence as shown: series values with its "this event only" edit applied. */
export type Occurrence = Window & {
  n: number;
  title: string;
  description: string;
  /** The series replay belongs to occurrence 0; later ones only have their own. */
  replayVimeoId: string | null;
  cancelled: boolean;
};

export function occurrenceOf(
  m: Schedule & Pick<Meetup, 'title' | 'description' | 'replayVimeoId'>,
  n: number,
  edit: MeetupOccurrence | undefined,
): Occurrence | null {
  const w = occurrenceWindow(m, n);
  if (!w) return null;
  return {
    n,
    title: edit?.title ?? m.title,
    description: edit?.description ?? m.description,
    startsAt: edit?.startsAt ?? w.startsAt,
    endsAt: edit?.endsAt ?? w.endsAt,
    replayVimeoId: edit?.replayVimeoId ?? (n === 0 ? m.replayVimeoId : null),
    cancelled: edit?.cancelled ?? false,
  };
}

/** URL key of an occurrence: the meetup id for occurrence 0 (one-offs keep their links), else `id_n`. */
export const occurrenceKey = (id: string, n: number): string => (n === 0 ? id : `${id}_${n}`);

const KEY = /^(.+?)(?:_([1-9]\d{0,5}))?$/;
export function parseOccurrenceKey(key: string): { id: string; n: number } | null {
  const [, id, n] = KEY.exec(key) ?? [];
  if (!id || id.includes('_')) return null;
  return { id, n: n ? Number(n) : 0 };
}
