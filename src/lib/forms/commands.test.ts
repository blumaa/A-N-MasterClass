import { describe, expect, it } from 'vitest';
import { body, field, flag, titleAndSlug, parser, productPatch, readClock, readDuration, readInstant, readIso, readWhole, readTimeZone } from './commands';
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

describe('titleAndSlug', () => {
  it('derives a missing slug from the title', () => {
    expect(titleAndSlug(reader({ title: 'Rope Talk', slug: '' }))).toEqual({ title: 'Rope Talk', slug: 'rope-talk' });
    expect(titleAndSlug(reader({ title: 'Rope Talk', slug: 'rt' }))).toEqual({ title: 'Rope Talk', slug: 'rt' });
  });
});

describe('productPatch', () => {
  it('reads present fields only, blank subtitle as none', () => {
    expect(productPatch(reader({ subtitle: '', status: 'published' }))).toEqual({ subtitle: null, status: 'published' });
    expect(() => productPatch(reader({ status: 'gone' }))).toThrow();
  });
});

describe('readDuration', () => {
  it('reads h:mm:ss, m:ss or blank', () => {
    expect(readDuration(reader({ d: '1:02:03' }), 'd')).toBe(3723);
    expect(readDuration(reader({ d: '42:05' }), 'd')).toBe(2525);
    expect(readDuration(reader({ d: '' }), 'd')).toBeNull();
    expect(() => readDuration(reader({ d: '1:75' }), 'd')).toThrow('Enter the length as h:mm:ss or m:ss.');
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

describe('readWhole', () => {
  it('reads a whole number', () => {
    expect(readWhole(reader({ n: '15' }), 'n', 'buffer')).toBe(15);
    expect(readWhole(reader({ n: '0' }), 'n', 'buffer')).toBe(0);
  });
  it('refuses fractions, signs and text', () => {
    for (const n of ['1.5', '-1', 'ten', '']) expect(() => readWhole(reader({ n }), 'n', 'buffer')).toThrow('Enter a whole number for buffer.');
  });
});

describe('readClock', () => {
  it('reads HH:MM as minutes after midnight, 24:00 as end of day', () => {
    expect(readClock(reader({ t: '09:30' }), 't', 'start')).toBe(570);
    expect(readClock(reader({ t: '24:00' }), 't', 'end')).toBe(1440);
  });
  it('refuses anything else', () => {
    for (const t of ['9', '25:00', '10:60', '24:30']) expect(() => readClock(reader({ t }), 't', 'start')).toThrow('Pick a valid start.');
  });
});

describe('readIso', () => {
  it('reads an ISO instant', () => {
    expect(readIso(reader({ at: '2026-11-11T08:00:00.000Z' }), 'at', 'time')).toEqual(new Date('2026-11-11T08:00:00Z'));
  });
  it('refuses a missing or broken instant', () => {
    expect(() => readIso(reader({ at: 'soon' }), 'at', 'time')).toThrow('Pick a valid time.');
    expect(() => readIso(reader({}), 'at', 'time')).toThrow('Pick a valid time.');
  });
});
