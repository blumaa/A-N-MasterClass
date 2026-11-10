import { describe, expect, it } from 'vitest';
import { readPaymentsEnv } from './payments';

describe('readPaymentsEnv', () => {
  it('defaults to sandbox and reads live', () => {
    expect(readPaymentsEnv({})).toBe('sandbox');
    expect(readPaymentsEnv({ PAYMENTS_ENV: 'live' })).toBe('live');
  });

  it('refuses unknown values', () => {
    expect(() => readPaymentsEnv({ PAYMENTS_ENV: 'prod' })).toThrow(/PAYMENTS_ENV/);
  });
});
