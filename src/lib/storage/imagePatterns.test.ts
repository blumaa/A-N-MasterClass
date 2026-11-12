import { describe, expect, it } from 'vitest';
import { siteImagePatterns } from './imagePatterns';

describe('siteImagePatterns', () => {
  it('allows only the public site bucket of the Supabase project and the fake origin', () => {
    expect(siteImagePatterns('https://abc.supabase.co')).toEqual([
      { protocol: 'https', hostname: 'files.example.test', port: '', pathname: '/storage/v1/object/public/site/**', search: '' },
      { protocol: 'https', hostname: 'abc.supabase.co', port: '', pathname: '/storage/v1/object/public/site/**', search: '' },
    ]);
  });

  it('skips Supabase when the URL is not set', () => {
    expect(siteImagePatterns(undefined)).toHaveLength(1);
  });
});
