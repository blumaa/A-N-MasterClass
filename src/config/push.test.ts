import { describe, expect, it } from 'vitest';
import { readPushConfig } from './push';

const FULL = { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'mailto:ops@masterclass.test' };

describe('readPushConfig', () => {
  it('is off when nothing is set, and reads a full set', () => {
    expect(readPushConfig({})).toBeNull();
    expect(readPushConfig(FULL)).toEqual({ publicKey: 'pub', privateKey: 'priv', subject: 'mailto:ops@masterclass.test' });
  });

  it('refuses half a config', () => {
    expect(() => readPushConfig({ VAPID_PUBLIC_KEY: 'pub' })).toThrow(/VAPID_PRIVATE_KEY, VAPID_SUBJECT/);
  });

  it('needs a mailto: or https: subject (push services reject others)', () => {
    expect(() => readPushConfig({ ...FULL, VAPID_SUBJECT: 'ops@masterclass.test' })).toThrow(/VAPID_SUBJECT/);
    expect(readPushConfig({ ...FULL, VAPID_SUBJECT: 'https://masterclass.test' })?.subject).toBe('https://masterclass.test');
  });
});
