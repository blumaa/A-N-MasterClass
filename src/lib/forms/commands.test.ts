import { describe, expect, it } from 'vitest';
import { body, field, flag, parser, readInstant, readTimeZone } from './commands';
import { formReader } from './formReader';

const form = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.set(k, v);
  return f;
};
const reader = (entries: Record<string, string>) => formReader(form(entries));

describe('flag', () => {
  it('reads true / false', () => {
    expect(flag(reader({ on: 'true' }), 'on')).toBe(true);
    expect(flag(reader({ on: 'false' }), 'on')).toBe(false);
  });
  it('refuses anything else', () => {
    expect(() => flag(reader({ on: 'yes' }), 'on')).toThrow('Unknown on');
  });
});

describe('field', () => {
  it('skips absent fields', () => {
    expect(field(reader({}), 'title', () => 'x')).toEqual({});
  });
  it('reads present fields', () => {
    expect(field(reader({ title: 'A' }), 'title', () => 'read')).toEqual({ title: 'read' });
  });
});

describe('body', () => {
  it('refuses an empty body', () => {
    expect(() => body(reader({ body: ' ' }))).toThrow('Write something first.');
  });
});

describe('readTimeZone / readInstant', () => {
  it('refuses an unknown zone', () => {
    expect(() => readTimeZone(reader({ timeZone: 'Mars/Base' }))).toThrow('Pick a valid time zone.');
  });
  it('turns a local time in the zone into UTC', () => {
    const r = reader({ timeZone: 'Europe/Berlin', startsAt: '2026-07-01T10:00' });
    expect(readInstant(r, 'startsAt', 'start time')).toEqual(new Date('2026-07-01T08:00:00Z'));
  });
  it('names the field when the time is bad', () => {
    const r = reader({ timeZone: 'UTC', startsAt: 'nope' });
    expect(() => readInstant(r, 'startsAt', 'start time')).toThrow('Pick a valid start time.');
  });
});

describe('parser', () => {
  type C = { op: 'a'; n: string } | { op: 'b' };
  const parse = parser<C>({ a: (r) => ({ op: 'a', n: r.required('n') }), b: () => ({ op: 'b' }) });

  it('dispatches on op', () => {
    expect(parse(form({ op: 'a', n: '1' }))).toEqual({ ok: true, command: { op: 'a', n: '1' } });
  });
  it('turns form errors into messages', () => {
    expect(parse(form({ op: 'a' }))).toEqual({ ok: false, message: 'Missing n.' });
    expect(parse(form({ op: 'zzz' }))).toEqual({ ok: false, message: 'Unknown op: zzz.' });
  });
});
