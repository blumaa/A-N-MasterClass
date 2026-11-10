import { describe, expect, it } from 'vitest';
import type { Comment, Reaction } from '@/lib/data/types';
import { buildThread, reactionCounts } from './present';

const NOW = new Date('2026-11-10T12:00:00Z');
const comment = (id: string, extra: Partial<Comment> = {}): Comment => ({
  id,
  spaceId: 's',
  targetType: 'post',
  targetId: 'p',
  parentId: null,
  authorId: 'u1',
  body: id,
  createdAt: NOW,
  hiddenAt: null,
  ...extra,
});
const reaction = (targetId: string, profileId: string, emoji: Reaction['emoji']): Reaction => ({
  targetType: 'comment',
  targetId,
  profileId,
  emoji,
  createdAt: NOW,
});
const names = new Map([['u1', 'Robin']]);

describe('reactionCounts', () => {
  it('counts per emoji in palette order and marks mine', () => {
    const rows = [reaction('c', 'u2', '🔥'), reaction('c', 'u1', '👍'), reaction('c', 'u2', '👍'), reaction('x', 'u1', '😂')];
    expect(reactionCounts(rows, 'c', 'u1')).toEqual([
      { emoji: '👍', count: 2, mine: true },
      { emoji: '🔥', count: 1, mine: false },
    ]);
  });
});

describe('buildThread', () => {
  const rows = [
    comment('a'),
    comment('b', { authorId: 'u2', hiddenAt: NOW }),
    comment('a1', { parentId: 'a', authorId: 'u2' }),
    comment('b1', { parentId: 'b' }),
  ];

  it('nests replies, names authors, lets authors delete their own', () => {
    const thread = buildThread(rows, [], names, 'u1', false);
    expect(thread.map((n) => [n.id, n.replies.map((r) => r.id)])).toEqual([['a', ['a1']]]);
    expect(thread[0]?.author).toEqual({ id: 'u1', name: 'Robin' });
    expect(thread[0]?.canDelete).toBe(true);
    expect(thread[0]?.replies[0]).toMatchObject({ author: { name: 'Member' }, canDelete: false });
  });

  it('shows hidden comments and their replies to moderators, flagged', () => {
    const thread = buildThread(rows, [], names, 'u9', true);
    expect(thread.map((n) => [n.id, n.hidden, n.replies.map((r) => r.id)])).toEqual([
      ['a', false, ['a1']],
      ['b', true, ['b1']],
    ]);
    expect(thread.every((n) => n.canDelete)).toBe(true);
  });
});
