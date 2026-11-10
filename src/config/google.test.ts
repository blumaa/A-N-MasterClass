import { describe, expect, it } from 'vitest';
import { googleRedirectUri, readGoogleConfig } from './google';

const SECRET = 'x'.repeat(32);

describe('readGoogleConfig', () => {
  it('is off when nothing is set, and reads a full set', () => {
    expect(readGoogleConfig({})).toBeNull();
    expect(readGoogleConfig({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's', OAUTH_STATE_SECRET: SECRET })).toEqual({
      clientId: 'id',
      clientSecret: 's',
      stateSecret: SECRET,
    });
  });

  it('refuses half a config or a short state secret', () => {
    expect(() => readGoogleConfig({ GOOGLE_CLIENT_ID: 'id' })).toThrow(/GOOGLE_CLIENT_SECRET, OAUTH_STATE_SECRET/);
    expect(() => readGoogleConfig({ GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's', OAUTH_STATE_SECRET: 'short' })).toThrow(/32/);
  });

  it('builds the platform redirect URI', () => {
    expect(googleRedirectUri('https://masterclass.test')).toBe('https://masterclass.test/api/google/callback');
  });
});
