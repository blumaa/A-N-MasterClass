import { describe, expect, it } from 'vitest';
import { LIVE_EVENT, liveTopic, TYPING_EVENTS, typingTopic } from './topics';

const ID = '0d1f6b8e-3c1a-4c2e-9b7a-1f2e3d4c5b6a';

// Same strings as public.live_* in supabase/migrations/20261112110000_live_topics.sql + 20261116000000_live_membership.sql.
describe('liveTopic', () => {
  it('names one topic per thing a page shows', () => {
    expect(liveTopic.community(ID)).toBe(`community:${ID}`);
    expect(liveTopic.channel(ID)).toBe(`channel:${ID}`);
    expect(liveTopic.post(ID)).toBe(`post:${ID}`);
    expect(liveTopic.dm(ID)).toBe(`dm:${ID}`);
    expect(liveTopic.inbox(ID)).toBe(`inbox:${ID}`);
  });

  it('uses one event name, a stale hint', () => {
    expect(LIVE_EVENT).toBe('stale');
  });
});

// Same strings as public.can_join_live / can_send_live in 20261112130000_typing_topics.sql.
describe('typingTopic', () => {
  it('keeps typing apart from the data topics', () => {
    expect(typingTopic.channel(ID)).toBe(`typing-channel:${ID}`);
    expect(typingTopic.dm(ID)).toBe(`typing-dm:${ID}`);
  });

  it('has a start and a stop event, never the stale one', () => {
    expect(TYPING_EVENTS).toEqual({ start: 'typing', stop: 'typing_stop' });
  });
});
