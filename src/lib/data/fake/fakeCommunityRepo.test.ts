import { beforeEach, describe, expect, it } from 'vitest';
import { ConstraintError } from '../errors';
import type { Comment, Post } from '../types';
import { createFakeRepo, type FakeRepo } from './fakeRepo';
import { SEED_IDS, seedDb } from './seed';

const NOW = new Date('2026-11-10T12:00:00Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);
let repo: FakeRepo;
let communityId: string;

beforeEach(async () => {
  repo = createFakeRepo(seedDb(NOW));
  communityId = (await repo.createProduct({ spaceId: SEED_IDS.alexander, kind: 'community', slug: 'circle', title: 'Circle' })).id;
});

const newChannel = (title = 'General') => repo.createChannel({ communityId, title, visibility: 'public' });
const newPost = (channelId: string, body = 'Hello', createdAt = NOW): Promise<Post> =>
  repo.createPost({ channelId, authorId: SEED_IDS.student, body, createdAt });
const newComment = (targetId: string, extra: Partial<Comment> = {}): Promise<Comment> =>
  repo.createComment({
    spaceId: SEED_IDS.alexander,
    targetType: 'post',
    targetId,
    parentId: null,
    authorId: SEED_IDS.student,
    body: 'Nice',
    createdAt: NOW,
    ...extra,
  });

describe('channels', () => {
  it('belong to community products only, ordered by position, movable', async () => {
    await expect(repo.createChannel({ communityId: SEED_IDS.program, title: 'X', visibility: 'public' })).rejects.toThrow(ConstraintError);
    const a = await newChannel('A');
    const b = await newChannel('B');
    expect((await repo.channels(communityId)).map((c) => c.title)).toEqual(['A', 'B']);
    await repo.move('channels', b.id, 'up');
    expect((await repo.channels(communityId)).map((c) => c.id)).toEqual([b.id, a.id]);
  });

  it('refuses a blank title', async () => {
    await expect(newChannel('  ')).rejects.toThrow(ConstraintError);
  });

  it('delete cascades to posts, comments and reactions', async () => {
    const ch = await newChannel();
    const post = await newPost(ch.id);
    const comment = await newComment(post.id);
    await repo.setReaction({ targetType: 'comment', targetId: comment.id, profileId: SEED_IDS.student, emoji: '👍', createdAt: NOW }, true);
    await repo.deleteChannel(ch.id);
    expect(repo.db.posts.filter((p) => p.id === post.id)).toEqual([]);
    expect(repo.db.comments).toEqual([]);
    expect(repo.db.reactions).toEqual([]);
  });
});

describe('community staff', () => {
  it('ticks staff of the same space only', async () => {
    await repo.setCommunityStaff(communityId, SEED_IDS.assistant, true);
    await repo.setCommunityStaff(communityId, SEED_IDS.assistant, true);
    expect(await repo.communityStaff(communityId)).toEqual([SEED_IDS.assistant]);
    await expect(repo.setCommunityStaff(communityId, SEED_IDS.student, true)).rejects.toThrow(ConstraintError);
    await expect(repo.setCommunityStaff(communityId, SEED_IDS.natashaOwner, true)).rejects.toThrow(ConstraintError);
    await repo.setCommunityStaff(communityId, SEED_IDS.assistant, false);
    expect(await repo.communityStaff(communityId)).toEqual([]);
  });
});

describe('posts', () => {
  it('lists pinned first, then newest first', async () => {
    const ch = await newChannel();
    const old = await newPost(ch.id, 'old', NOW);
    const mid = await newPost(ch.id, 'mid', later(1000));
    const latest = await newPost(ch.id, 'new', later(2000));
    await repo.updatePost(old.id, { pinned: true });
    expect((await repo.posts(ch.id)).map((p) => p.id)).toEqual([old.id, latest.id, mid.id]);
  });

  it('refuses empty or oversized bodies', async () => {
    const ch = await newChannel();
    await expect(newPost(ch.id, '')).rejects.toThrow(ConstraintError);
    await expect(newPost(ch.id, 'x'.repeat(10_001))).rejects.toThrow(ConstraintError);
  });

  it('delete cascades to comments, reactions and notifications', async () => {
    const ch = await newChannel();
    const post = await newPost(ch.id);
    await newComment(post.id);
    await repo.setReaction({ targetType: 'post', targetId: post.id, profileId: SEED_IDS.student, emoji: '❤️', createdAt: NOW }, true);
    await repo.addNotifications([
      { spaceId: SEED_IDS.alexander, recipientId: SEED_IDS.alexanderOwner, actorId: SEED_IDS.student, type: 'mention', postId: post.id, stepId: null, createdAt: NOW },
    ]);
    await repo.deletePost(post.id);
    expect(repo.db.comments).toEqual([]);
    expect(repo.db.reactions).toEqual([]);
    expect(repo.db.notifications).toEqual([]);
  });
});

describe('comments', () => {
  it('allow one reply level on the same target', async () => {
    const ch = await newChannel();
    const post = await newPost(ch.id);
    const other = await newPost(ch.id);
    const top = await newComment(post.id);
    const reply = await newComment(post.id, { parentId: top.id, createdAt: later(1) });
    await expect(newComment(post.id, { parentId: reply.id })).rejects.toThrow(ConstraintError);
    await expect(newComment(other.id, { parentId: top.id })).rejects.toThrow(ConstraintError);
    await expect(newComment(post.id, { body: ' ' })).rejects.toThrow(ConstraintError);
    expect((await repo.comments('post', [post.id])).map((c) => c.id)).toEqual([top.id, reply.id]);
  });

  it('delete cascades to replies and their reactions', async () => {
    const ch = await newChannel();
    const post = await newPost(ch.id);
    const top = await newComment(post.id);
    const reply = await newComment(post.id, { parentId: top.id });
    await repo.setReaction({ targetType: 'comment', targetId: reply.id, profileId: SEED_IDS.student, emoji: '👍', createdAt: NOW }, true);
    await repo.deleteComment(top.id);
    expect(repo.db.comments).toEqual([]);
    expect(repo.db.reactions).toEqual([]);
  });

  it('step comments go when the step goes', async () => {
    await newComment('step-intro', { targetType: 'step' });
    await repo.deleteStep('step-intro');
    expect(repo.db.comments).toEqual([]);
  });
});

describe('reactions', () => {
  it('toggle idempotently per (target, profile, emoji)', async () => {
    const row = { targetType: 'post' as const, targetId: 'p1', profileId: SEED_IDS.student, emoji: '🔥' as const, createdAt: NOW };
    await repo.setReaction(row, true);
    await repo.setReaction(row, true);
    expect(await repo.reactions('post', ['p1'])).toHaveLength(1);
    await repo.setReaction(row, false);
    expect(await repo.reactions('post', ['p1'])).toEqual([]);
  });
});

describe('notifications', () => {
  it('lists newest first per recipient and space, counts and marks read', async () => {
    const base = { spaceId: SEED_IDS.alexander, recipientId: SEED_IDS.student, actorId: SEED_IDS.alexanderOwner, postId: 'p1', stepId: null };
    await repo.addNotifications([
      { ...base, type: 'comment', createdAt: NOW },
      { ...base, type: 'reaction', createdAt: later(1000) },
      { ...base, recipientId: SEED_IDS.assistant, type: 'mention', createdAt: NOW },
      { ...base, spaceId: SEED_IDS.natasha, type: 'mention', createdAt: NOW },
    ]);
    expect((await repo.notifications(SEED_IDS.alexander, SEED_IDS.student, 10)).map((n) => n.type)).toEqual(['reaction', 'comment']);
    expect(await repo.notifications(SEED_IDS.alexander, SEED_IDS.student, 1)).toHaveLength(1);
    expect(await repo.unreadNotificationCount(SEED_IDS.alexander, SEED_IDS.student)).toBe(2);
    await repo.markNotificationsRead(SEED_IDS.alexander, SEED_IDS.student, later(5000));
    expect(await repo.unreadNotificationCount(SEED_IDS.alexander, SEED_IDS.student)).toBe(0);
    expect(await repo.unreadNotificationCount(SEED_IDS.natasha, SEED_IDS.student)).toBe(1);
  });
});

describe('members', () => {
  it('lists the staff of one space', async () => {
    expect((await repo.members(SEED_IDS.alexander)).map((m) => m.profileId).sort()).toEqual([SEED_IDS.alexanderOwner, SEED_IDS.assistant].sort());
  });
});
