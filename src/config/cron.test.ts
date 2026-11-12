import { describe, expect, it } from 'vitest';
import { isCronCall, readCronSecret } from './cron';

const SECRET = 'a'.repeat(32);

describe('readCronSecret', () => {
  it('is off when unset or empty', () => {
    expect(readCronSecret({})).toBeNull();
    expect(readCronSecret({ CRON_SECRET: '  ' })).toBeNull();
  });

  it('reads a long secret and refuses a short one', () => {
    expect(readCronSecret({ CRON_SECRET: SECRET })).toBe(SECRET);
    expect(() => readCronSecret({ CRON_SECRET: 'short' })).toThrow(/CRON_SECRET/);
  });
});

describe('isCronCall', () => {
  it('accepts only the bearer secret', () => {
    expect(isCronCall(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isCronCall(`Bearer ${'b'.repeat(32)}`, SECRET)).toBe(false);
    expect(isCronCall(SECRET, SECRET)).toBe(false);
    expect(isCronCall(null, SECRET)).toBe(false);
  });

  it('refuses every call when no secret is set', () => {
    expect(isCronCall('Bearer ', null)).toBe(false);
    expect(isCronCall(null, null)).toBe(false);
  });
});
