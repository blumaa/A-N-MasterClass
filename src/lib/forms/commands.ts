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
