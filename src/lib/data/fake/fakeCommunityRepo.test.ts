import { beforeEach, describe, expect, it } from 'vitest';
import { ConstraintError } from '../errors';
import type { NewChannel } from '../repo';
import type { Comment, Post } from '../types';
import { createFakeRepo, type FakeRepo } from './fakeRepo';
import { SEED_IDS, seedDb } from './seed';

const NOW = new Date('2026-11-10T12:00:00Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);
let repo: FakeRepo;
let communityId: string;
let groupId: string;

beforeEach(async () => {
  repo = createFakeRepo(seedDb(NOW));
  communityId = (await repo.createProduct({ spaceId: SEED_IDS.alexander, kind: 'community', slug: 'circle', title: 'Circle' })).id;
  groupId = (await repo.accessGroups(communityId))[0]!.id;
});

const newChannel = (title = 'General', extra: Partial<NewChannel> = {}) =>
  repo.createChannel({ communityId, accessGroupId: groupId, title, kind: 'feed', privacy: 'public', readOnly: false, ...extra });
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
    await expect(newChannel('X', { communityId: SEED_IDS.program })).rejects.toThrow(ConstraintError);
    const a = await newChannel('A');
    const b = await newChannel('B');
    expect((await repo.channels(communityId)).map((c) => c.title)).toEqual(['A', 'B']);
    await repo.move('channels', b.id, 'up');
    expect((await repo.channels(communityId)).map((c) => c.id)).toEqual([b.id, a.id]);
  });

  it('needs an access group of the same community', async () => {
    const [seedGroup] = await repo.accessGroups(SEED_IDS.community);
    await expect(newChannel('X', { accessGroupId: seedGroup!.id })).rejects.toThrow(/group/);
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

  it('delete cascades to messages and private members', async () => {
    const ch = await newChannel('Chat', { kind: 'chat', privacy: 'private' });
    await repo.createMessage({ channelId: ch.id, threadId: null, authorId: SEED_IDS.student, body: 'hi', createdAt: NOW });
    await repo.setChannelMember(ch.id, SEED_IDS.student, true);
    await repo.deleteChannel(ch.id);
    expect(repo.db.messages.filter((m) => m.channelId === ch.id)).toEqual([]);
    expect(repo.db.channelMembers.filter((m) => m.channelId === ch.id)).toEqual([]);
  });
});

describe('access groups', () => {
  it('lists the default first, then by title; one default per community', async () => {
    await repo.createAccessGroup({ communityId, title: 'Zeta' });
    await repo.createAccessGroup({ communityId, title: 'Alpha' });
    expect((await repo.accessGroups(communityId)).map((g) => g.title)).toEqual(['Members', 'Alpha', 'Zeta']);
    await expect(repo.createAccessGroup({ communityId, title: 'Two', isDefault: true })).rejects.toThrow(/default/);
    await expect(repo.createAccessGroup({ communityId: SEED_IDS.program, title: 'X' })).rejects.toThrow(/community/);
    await expect(repo.createAccessGroup({ communityId, title: ' ' })).rejects.toThrow(/title/);
  });

  it('updates toggles; refuses deleting the default or a group in use', async () => {
    const vip = await repo.createAccessGroup({ communityId, title: 'VIP' });
    expect(vip).toMatchObject({ isDefault: false, directory: true, dms: true });
    expect(await repo.updateAccessGroup(vip.id, { dms: false, title: 'VIPs' })).toMatchObject({ dms: false, title: 'VIPs' });
    await expect(repo.deleteAccessGroup(groupId)).rejects.toThrow(/default/);
    const ch = await newChannel('VIP room', { accessGroupId: vip.id });
    await expect(repo.deleteAccessGroup(vip.id)).rejects.toThrow(/in use/);
    await repo.deleteChannel(ch.id);
    const g = await repo.createGrant({ productId: communityId, profileId: SEED_IDS.student, source: 'manual', accessGroupId: vip.id });
    await expect(repo.deleteAccessGroup(vip.id)).rejects.toThrow(/in use/);
    repo.db.grants = repo.db.grants.filter((x) => x.id !== g.id);
    await repo.deleteAccessGroup(vip.id);
    expect(await repo.accessGroup(vip.id)).toBeNull();
  });
});

describe('channel members', () => {
  it('adds once and removes', async () => {
    const ch = await newChannel('Inner', { privacy: 'private' });
    await repo.setChannelMember(ch.id, SEED_IDS.student, true);
    await repo.setChannelMember(ch.id, SEED_IDS.student, true);
    expect(await repo.channelMembers(ch.id)).toEqual([SEED_IDS.student]);
    await repo.setChannelMember(ch.id, SEED_IDS.student, false);
    expect(await repo.channelMembers(ch.id)).toEqual([]);
  });
});

describe('messages', () => {
  const say = (where: { channelId?: string; threadId?: string }, body: string, at = NOW) =>
    repo.createMessage({ channelId: where.channelId ?? null, threadId: where.threadId ?? null, authorId: SEED_IDS.student, body, createdAt: at });

  it('returns the latest n, oldest first', async () => {
    const ch = await newChannel('Chat', { kind: 'chat' });
    await say({ channelId: ch.id }, 'one', NOW);
    await say({ channelId: ch.id }, 'two', later(1000));
    await say({ channelId: ch.id }, 'three', later(2000));
    expect((await repo.messages({ channelId: ch.id }, 2)).map((m) => m.body)).toEqual(['two', 'three']);
  });

  it('needs exactly one home, a chat channel, and a 1..4000 body', async () => {
    const chat = await newChannel('Chat', { kind: 'chat' });
    const feed = await newChannel('Feed');
    const thread = await repo.createDmThread(communityId, SEED_IDS.student, SEED_IDS.alexanderOwner);
    await expect(say({}, 'x')).rejects.toThrow(ConstraintError);
    await expect(say({ channelId: chat.id, threadId: thread.id }, 'x')).rejects.toThrow(ConstraintError);
    await expect(say({ channelId: feed.id }, 'x')).rejects.toThrow(/chat/);
    await expect(say({ channelId: chat.id }, ' ')).rejects.toThrow(/body/);
    await expect(say({ channelId: chat.id }, 'x'.repeat(4001))).rejects.toThrow(/body/);
    const m = await say({ threadId: thread.id }, 'hey');
    expect(await repo.message(m.id)).toEqual(m);
    await repo.deleteMessage(m.id);
    expect(await repo.message(m.id)).toBeNull();
  });
});

describe('DMs', () => {
  it('stores one ordered thread per pair and community', async () => {
    const t = await repo.createDmThread(communityId, SEED_IDS.student, SEED_IDS.alexanderOwner);
    expect(t.aId < t.bId).toBe(true);
    await expect(repo.createDmThread(communityId, SEED_IDS.alexanderOwner, SEED_IDS.student)).rejects.toThrow(ConstraintError);
    await expect(repo.createDmThread(communityId, SEED_IDS.student, SEED_IDS.student)).rejects.toThrow(ConstraintError);
    expect(await repo.dmThreadBetween(communityId, SEED_IDS.alexanderOwner, SEED_IDS.student)).toEqual(t);
    expect(await repo.dmThreads(communityId, SEED_IDS.student)).toEqual([t]);
    expect(await repo.dmThreads(SEED_IDS.community, SEED_IDS.student)).toEqual([]);
    expect(await repo.dmThread(t.id)).toEqual(t);
  });

  it('tracks reads per participant (upsert)', async () => {
    const t = await repo.createDmThread(communityId, SEED_IDS.student, SEED_IDS.alexanderOwner);
    await repo.markDmRead(t.id, SEED_IDS.student, NOW);
    await repo.markDmRead(t.id, SEED_IDS.student, later(5));
    expect(await repo.dmReads(SEED_IDS.student, [t.id])).toEqual([{ threadId: t.id, profileId: SEED_IDS.student, readAt: later(5) }]);
  });

  it('blocks either way; settings default until saved', async () => {
    const row = { communityId, blockerId: SEED_IDS.student, blockedId: SEED_IDS.alexanderOwner };
    await repo.setBlock(row, true);
    await repo.setBlock(row, true);
    expect(await repo.blocks(communityId, SEED_IDS.alexanderOwner)).toEqual([row]);
    await repo.setBlock(row, false);
    expect(await repo.blocks(communityId, SEED_IDS.student)).toEqual([]);
    expect(await repo.communitySettings(communityId)).toEqual({ communityId, dmsEnabled: true, founderDms: true });
    await repo.saveCommunitySettings({ communityId, dmsEnabled: false, founderDms: true });
    expect((await repo.communitySettings(communityId)).dmsEnabled).toBe(false);
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
