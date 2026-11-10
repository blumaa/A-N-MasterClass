import { describe, expect, it } from 'vitest';
import { devAuthAllowed, readDataSource } from './dataSource';

describe('readDataSource', () => {
  it('reads fake and supabase', () => {
    expect(readDataSource({ DATA_SOURCE: 'fake' })).toBe('fake');
    expect(readDataSource({ DATA_SOURCE: 'supabase' })).toBe('supabase');
  });

  it('refuses missing or unknown values', () => {
    expect(() => readDataSource({})).toThrow(/DATA_SOURCE/);
    expect(() => readDataSource({ DATA_SOURCE: 'mongo' })).toThrow(/DATA_SOURCE/);
  });
});

describe('devAuthAllowed', () => {
  it('only with fake data outside production', () => {
    expect(devAuthAllowed({ DATA_SOURCE: 'fake', NODE_ENV: 'development' })).toBe(true);
    expect(devAuthAllowed({ DATA_SOURCE: 'fake', NODE_ENV: 'production' })).toBe(false);
    expect(devAuthAllowed({ DATA_SOURCE: 'supabase', NODE_ENV: 'development' })).toBe(false);
  });
});
