import { describe, expect, it } from 'vitest';
import { buildNotifications } from './notify';

const base = { spaceId: 's', actorId: 'me', postId: 'p', stepId: null, createdAt: new Date('2026-11-10T12:00:00Z') };

describe('buildNotifications', () => {
  it('drops the actor, dedupes with the first type winning, filters by canReceive', () => {
    const rows = buildNotifications(
      base,
      [
        { recipientId: 'a', type: 'reply' },
        { recipientId: 'a', type: 'comment' },
        { recipientId: 'me', type: 'mention' },
        { recipientId: 'b', type: 'mention' },
        { recipientId: 'gone', type: 'mention' },
      ],
      (id) => id !== 'gone',
    );
    expect(rows).toEqual([
      { ...base, recipientId: 'a', type: 'reply' },
      { ...base, recipientId: 'b', type: 'mention' },
    ]);
  });
});
