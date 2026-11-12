import { afterEach, describe, expect, it, vi } from 'vitest';
import { typingConfig } from './typingConfig';

const people = [{ id: 'p2', name: 'Bo' }];
afterEach(() => vi.unstubAllEnvs());

describe('typingConfig', () => {
  it('is on for a signed-in viewer on Supabase data', () => {
    vi.stubEnv('DATA_SOURCE', 'supabase');
    expect(typingConfig('typing-dm:t1', 'p1', people)).toEqual({ topic: 'typing-dm:t1', me: 'p1', people });
  });

  it('is off in fake mode (no Realtime)', () => {
    vi.stubEnv('DATA_SOURCE', 'fake');
    expect(typingConfig('typing-dm:t1', 'p1', people)).toBeNull();
  });

  it('is off for a signed-out visitor', () => {
    vi.stubEnv('DATA_SOURCE', 'supabase');
    expect(typingConfig('typing-dm:t1', null, people)).toBeNull();
  });
});
