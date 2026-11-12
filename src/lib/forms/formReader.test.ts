import { describe, expect, it } from 'vitest';
import { FormError, formReader, optional, parseForm } from './formReader';

const form = (fields: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.set(k, v);
  return f;
};

describe('formReader', () => {
  it('trims, requires and restricts values', () => {
    const r = formReader(form({ a: ' x ', kind: 'b' }));
    expect(r.raw('a')).toBe('x');
    expect(r.raw('nope')).toBeUndefined();
    expect(() => r.required('nope')).toThrow('Missing nope.');
    expect(r.oneOf('kind', ['a', 'b'])).toBe('b');
    expect(() => r.oneOf('kind', ['a'])).toThrow('Unknown kind: b.');
  });

  it('all: every non-blank string value of a repeated field', () => {
    const f = new FormData();
    f.append('photo', ' a ');
    f.append('photo', '');
    f.append('photo', 'b');
    expect(formReader(f).all('photo')).toEqual(['a', 'b']);
    expect(formReader(f).all('nope')).toEqual([]);
  });

  it('optional: absent untouched, blank null', () => {
    const r = formReader(form({ blank: '', set: 'v' }));
    expect(optional(r, 'gone', String)).toEqual({});
    expect(optional(r, 'blank', String)).toEqual({ blank: null });
    expect(optional(r, 'set', (v) => v.toUpperCase())).toEqual({ set: 'V' });
  });

  it('parseForm turns FormError into a message and rethrows others', () => {
    expect(parseForm(() => 1)).toEqual({ ok: true, value: 1 });
    expect(parseForm(() => { throw new FormError('bad'); })).toEqual({ ok: false, message: 'bad' });
    expect(() => parseForm(() => { throw new TypeError('bug'); })).toThrow(TypeError);
  });
});
