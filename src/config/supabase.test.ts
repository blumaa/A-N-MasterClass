import { describe, expect, it } from 'vitest';
import { readSupabasePublic, readSupabaseSecret } from './supabase';

const URL = 'https://abc.supabase.co';

describe('readSupabasePublic', () => {
  it('reads url and publishable key', () => {
    expect(
      readSupabasePublic({ NEXT_PUBLIC_SUPABASE_URL: URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }),
    ).toEqual({ url: URL, publishableKey: 'sb_publishable_x' });
  });

  it('refuses a missing or non-https url and a missing key', () => {
    expect(() => readSupabasePublic({ NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'k' })).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() =>
      readSupabasePublic({ NEXT_PUBLIC_SUPABASE_URL: 'http://abc.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'k' }),
    ).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(() => readSupabasePublic({ NEXT_PUBLIC_SUPABASE_URL: URL })).toThrow(/PUBLISHABLE_KEY/);
  });
});

describe('readSupabaseSecret', () => {
  it('reads the secret key', () => {
    expect(readSupabaseSecret({ SUPABASE_SECRET_KEY: 'sb_secret_x' })).toBe('sb_secret_x');
  });

  it('refuses a missing key and a publishable key in its place', () => {
    expect(() => readSupabaseSecret({})).toThrow(/SUPABASE_SECRET_KEY/);
    expect(() => readSupabaseSecret({ SUPABASE_SECRET_KEY: 'sb_publishable_x' })).toThrow(/SUPABASE_SECRET_KEY/);
  });
});
