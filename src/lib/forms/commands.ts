// Form -> command helpers shared by every feature: a parser over an `op` table plus small typed
// readers. Booleans arrive as 'true' / 'false'; times as datetime-local values in `timeZone`.
import { isTimeZone, zonedToUtc } from '@/lib/format/zoned';
import { FormError, formReader, parseForm, type FormReader as Reader } from './formReader';

export type Parsed<C> = { ok: true; command: C } | { ok: false; message: string };

const BOOLEANS = ['true', 'false'] as const;

export const flag = (r: Reader, name: string): boolean => r.oneOf(name, BOOLEANS) === 'true';

/** Patch field: absent = untouched, present = read(). */
export const field = <K extends string, T>(r: Reader, name: K, read: () => T): Partial<Record<K, T>> =>
  r.raw(name) === undefined ? {} : ({ [name]: read() } as Partial<Record<K, T>>);

export function body(r: Reader): string {
  const v = r.raw('body');
  if (!v) throw new FormError('Write something first.');
  return v;
}

export function readTimeZone(r: Reader): string {
  const zone = r.required('timeZone');
  if (!isTimeZone(zone)) throw new FormError('Pick a valid time zone.');
  return zone;
}

/** Non-negative whole number (minutes, days, counts). Ranges are the DB's job. */
export function readWhole(r: Reader, name: string, label: string): number {
  const v = r.raw(name) ?? '';
  if (!/^\d+$/.test(v)) throw new FormError(`Enter a whole number for ${label}.`);
  return Number(v);
}

const CLOCK = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `<input type="time">` value as minutes after midnight; '24:00' = end of day. */
export function readClock(r: Reader, name: string, label: string): number {
  const v = r.raw(name) ?? '';
  if (v === '24:00') return 1440;
  const m = CLOCK.exec(v);
  if (!m) throw new FormError(`Pick a valid ${label}.`);
  return Number(m[1]) * 60 + Number(m[2]);
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?Z$/;

/** UTC instant the server rendered into the form (e.g. an offered slot). */
export function readIso(r: Reader, name: string, label: string): Date {
  const v = r.raw(name) ?? '';
  const at = ISO_INSTANT.test(v) ? new Date(v) : null;
  if (!at || Number.isNaN(at.getTime())) throw new FormError(`Pick a valid ${label}.`);
  return at;
}

/** datetime-local value `name`, typed in the form's `timeZone`, as a UTC instant. */
export function readInstant(r: Reader, name: string, label: string): Date {
  const at = zonedToUtc(r.raw(name) ?? '', readTimeZone(r));
  if (!at) throw new FormError(`Pick a valid ${label}.`);
  return at;
}

export function parser<C extends { op: string }>(table: Record<C['op'], (r: Reader) => C>) {
  const ops = Object.keys(table) as C['op'][];
  return (form: FormData): Parsed<C> => {
    const r = formReader(form);
    const parsed = parseForm(() => table[r.oneOf('op', ops)](r));
    return parsed.ok ? { ok: true, command: parsed.value } : parsed;
  };
}
