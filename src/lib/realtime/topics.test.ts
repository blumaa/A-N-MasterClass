import { describe, expect, it } from 'vitest';
import { LIVE_EVENT, liveTopic } from './topics';

const ID = '0d1f6b8e-3c1a-4c2e-9b7a-1f2e3d4c5b6a';

// Same strings as public.live_* in supabase/migrations/20261112110000_live_topics.sql.
describe('liveTopic', () => {
  it('names one topic per thing a page shows', () => {
    expect(liveTopic.channel(ID)).toBe(`channel:${ID}`);
    expect(liveTopic.post(ID)).toBe(`post:${ID}`);
    expect(liveTopic.dm(ID)).toBe(`dm:${ID}`);
    expect(liveTopic.inbox(ID)).toBe(`inbox:${ID}`);
  });

  it('uses one event name, a stale hint', () => {
    expect(LIVE_EVENT).toBe('stale');
  });
});
