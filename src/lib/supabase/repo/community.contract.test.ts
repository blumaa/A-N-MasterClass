// Community Supabase repo against the linked project, as the service client (RLS is covered by the
// SQL suites). Everything lives in one is_test space + auth users that afterAll deletes.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConstraintError } from '@/lib/data/errors';
import type { NewChannel } from '@/lib/data/repo';
import { DEFAULT_COMMUNITY_SETTINGS } from '@/lib/data/types';
import { bodyRangeMessage, COMMENT_MAX, POST_MAX } from '@/lib/data/limits';
import { createCommunityRepo, type CommunityRepo } from './community';
import { createCoreRepo, type CoreRepo } from './core';
import { createContractSpace, contractEnabled, type ContractSpace } from './testing/contractSpace';

describe.skipIf(!contractEnabled)('community repo (Supabase contract)', () => {
  let fx: ContractSpace;
  let repo: CommunityRepo;
  let core: CoreRepo;
  let spaceId: string;
  let communityId: string;
  let defaultGroupId: string;
  let author: string;
  let other: string;
  let slugN = 0;

  const feed = (over: Partial<NewChannel> = {}): NewChannel => ({
    communityId,
    accessGroupId: defaultGroupId,
    title: 'General',
    kind: 'feed',
    privacy: 'public',
    readOnly: false,
    ...over,
  });
  const newPost = (channelId: string, body = 'hello', at = new Date()) =>
    repo.createPost({ channelId, authorId: author, body, createdAt: at });
  const newComment = (postId: string, over: Partial<Parameters<CommunityRepo['createComment']>[0]> = {}) =>
    repo.createComment({
      spaceId,
      targetType: 'post',
      targetId: postId,
      parentId: null,
      authorId: author,
      body: 'c',
      createdAt: new Date(),
      ...over,
    });
  async function newCommunity() {
    slugN += 1;
    return core.createProduct({ spaceId, kind: 'community', slug: `comm-${slugN}`, title: `Comm ${slugN}` });
  }

  beforeAll(async () => {
    fx = await createContractSpace('community');
    spaceId = fx.spaceId;
    repo = createCommunityRepo({ db: async () => fx.admin, admin: () => fx.admin });
    core = createCoreRepo({ db: async () => fx.admin, admin: () => fx.admin });
    author = await fx.newUser('author');
    other = await fx.newUser('other');
    for (const id of [author, other]) await core.ensureSpaceProfile({ spaceId, profileId: id, displayName: id.slice(0, 4) });
    communityId = (await newCommunity()).id;
    defaultGroupId = (await repo.accessGroups(communityId))[0]!.id;
  });

  afterAll(async () => {
    if (fx) await fx.cleanup();
  });

  describe('access groups', () => {
    it('a new community has its default group; default sorts first, then by title', async () => {
      const c = await newCommunity();
      const z = await repo.createAccessGroup({ communityId: c.id, title: 'Zed' });
      const a = await repo.createAccessGroup({ communityId: c.id, title: 'Alpha' });
      const groups = await repo.accessGroups(c.id);
      expect(groups.map((g) => g.title)).toEqual(['Members', 'Alpha', 'Zed']);
      expect(groups[0]).toMatchObject({ isDefault: true, directory: true, dms: true, challenges: true, meetups: true, leaderboard: true });
      expect(a).toMatchObject({ isDefault: false, communityId: c.id, leaderboard: true });
      expect((await repo.accessGroup(z.id))?.title).toBe('Zed');
      expect(await repo.accessGroup(randomUUID())).toBeNull();
    });

    it('refuses blank title, non-community product, second default', async () => {
      const prog = await core.createProduct({ spaceId, kind: 'program', slug: 'ag-prog', title: 'P' });
      await expect(repo.createAccessGroup({ communityId, title: '  ' })).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.createAccessGroup({ communityId: prog.id, title: 'X' })).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.createAccessGroup({ communityId, title: 'D', isDefault: true })).rejects.toBeInstanceOf(ConstraintError);
    });

    it('updates title and feature toggles; empty patch returns the row', async () => {
      const g = await repo.createAccessGroup({ communityId, title: 'Upd' });
      expect(await repo.updateAccessGroup(g.id, { title: 'Upd2', dms: false, leaderboard: false })).toMatchObject({
        title: 'Upd2',
        dms: false,
        leaderboard: false,
        directory: true,
      });
      expect((await repo.updateAccessGroup(g.id, {})).title).toBe('Upd2');
      await expect(repo.updateAccessGroup(g.id, { title: ' ' })).rejects.toBeInstanceOf(ConstraintError);
    });

    it('deletes a free group; refuses the default and a group used by a channel', async () => {
      const free = await repo.createAccessGroup({ communityId, title: 'Free' });
      await repo.deleteAccessGroup(free.id);
      expect(await repo.accessGroup(free.id)).toBeNull();
      await expect(repo.deleteAccessGroup(defaultGroupId)).rejects.toBeInstanceOf(ConstraintError);
      const used = await repo.createAccessGroup({ communityId, title: 'Used' });
      await repo.createChannel(feed({ accessGroupId: used.id, title: 'In used' }));
      await expect(repo.deleteAccessGroup(used.id)).rejects.toBeInstanceOf(ConstraintError);
    });
  });

  describe('channels', () => {
    it('creates at the next position, lists in order, updates, deletes', async () => {
      const c = await newCommunity();
      const g = (await repo.accessGroups(c.id))[0]!.id;
      const mk = (title: string) => repo.createChannel(feed({ communityId: c.id, accessGroupId: g, title }));
      const a = await mk('A');
      const b = await mk('B');
      expect([a.position, b.position]).toEqual([0, 1]);
      expect(a).toMatchObject({ kind: 'feed', privacy: 'public', readOnly: false, accessGroupId: g });
      expect((await repo.channels(c.id)).map((x) => x.id)).toEqual([a.id, b.id]);
      expect((await repo.channel(b.id))?.title).toBe('B');
      expect(await repo.channel(randomUUID())).toBeNull();

      const up = await repo.updateChannel(a.id, { title: 'A2', privacy: 'private', readOnly: true });
      expect(up).toMatchObject({ title: 'A2', privacy: 'private', readOnly: true, kind: 'feed', position: 0 });
      expect((await repo.updateChannel(a.id, {})).title).toBe('A2');

      await repo.deleteChannel(a.id);
      expect(await repo.channel(a.id)).toBeNull();
    });

    it('refuses blank title, non-community product, group of another community', async () => {
      const prog = await core.createProduct({ spaceId, kind: 'program', slug: 'ch-prog', title: 'P' });
      const otherCommunity = await newCommunity();
      const foreignGroup = (await repo.accessGroups(otherCommunity.id))[0]!.id;
      await expect(repo.createChannel(feed({ title: ' ' }))).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.createChannel(feed({ communityId: prog.id }))).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.createChannel(feed({ accessGroupId: foreignGroup }))).rejects.toBeInstanceOf(ConstraintError);
    });

    it('deleting a channel cascades to posts, comments, reactions and notifications', async () => {
      const ch = await repo.createChannel(feed({ title: 'Cascade' }));
      const p = await newPost(ch.id);
      const c1 = await newComment(p.id);
      await repo.setReaction({ targetType: 'post', targetId: p.id, profileId: other, emoji: '👍', createdAt: new Date() }, true);
      await repo.setReaction({ targetType: 'comment', targetId: c1.id, profileId: other, emoji: '🔥', createdAt: new Date() }, true);
      await repo.addNotifications([
        { spaceId, recipientId: author, actorId: other, type: 'comment', postId: p.id, stepId: null, createdAt: new Date() },
      ]);
      await repo.deleteChannel(ch.id);
      expect(await repo.post(p.id)).toBeNull();
      expect(await repo.comment(c1.id)).toBeNull();
      expect(await repo.reactions('post', [p.id])).toEqual([]);
      expect(await repo.reactions('comment', [c1.id])).toEqual([]);
      expect((await repo.notifications(spaceId, author, 100)).filter((n) => n.postId === p.id)).toEqual([]);
    });

    it('channel members toggle idempotently', async () => {
      const ch = await repo.createChannel(feed({ title: 'Private', privacy: 'private' }));
      await repo.setChannelMember(ch.id, author, true);
      await repo.setChannelMember(ch.id, author, true);
      await repo.setChannelMember(ch.id, other, true);
      expect((await repo.channelMembers(ch.id)).toSorted()).toEqual([author, other].toSorted());
      await repo.setChannelMember(ch.id, author, false);
      await repo.setChannelMember(ch.id, author, false);
      expect(await repo.channelMembers(ch.id)).toEqual([other]);
    });
  });

  describe('settings and staff', () => {
    it('returns defaults without a row, upserts, round-trips point values', async () => {
      const c = await newCommunity();
      expect(await repo.communitySettings(c.id)).toEqual({ communityId: c.id, ...DEFAULT_COMMUNITY_SETTINGS, pointValues: {} });
      const row = {
        communityId: c.id,
        dmsEnabled: false,
        founderDms: false,
        pointsEnabled: false,
        leaderboard: 'staff' as const,
        pointValues: { comment: 5, dm: 0 },
      };
      await repo.saveCommunitySettings(row);
      expect(await repo.communitySettings(c.id)).toEqual(row);
      await repo.saveCommunitySettings({ ...row, leaderboard: 'off', pointValues: {} });
      expect(await repo.communitySettings(c.id)).toEqual({ ...row, leaderboard: 'off', pointValues: {} });
    });

    it('refuses out-of-range point values', async () => {
      const c = await newCommunity();
      await expect(
        repo.saveCommunitySettings({ communityId: c.id, ...DEFAULT_COMMUNITY_SETTINGS, pointValues: { comment: 1001 } }),
      ).rejects.toBeInstanceOf(ConstraintError);
    });

    it('ticks staff idempotently; refuses a profile that is not staff of the space', async () => {
      const c = await newCommunity();
      const ins = await fx.admin.from('space_members').insert({ space_id: spaceId, profile_id: author, role: 'assistant' });
      if (ins.error && ins.error.code !== '23505') throw ins.error;
      await repo.setCommunityStaff(c.id, author, true);
      await repo.setCommunityStaff(c.id, author, true);
      expect(await repo.communityStaff(c.id)).toEqual([author]);
      await expect(repo.setCommunityStaff(c.id, other, true)).rejects.toBeInstanceOf(ConstraintError);
      await repo.setCommunityStaff(c.id, author, false);
      expect(await repo.communityStaff(c.id)).toEqual([]);
    });
  });

  describe('posts', () => {
    it('lists pinned first then newest first; defaults pinned false, hidden null', async () => {
      const ch = await repo.createChannel(feed({ title: 'Order' }));
      const old = await newPost(ch.id, 'old', new Date('2026-01-01T00:00:00Z'));
      const mid = await newPost(ch.id, 'mid', new Date('2026-02-01T00:00:00Z'));
      const recent = await newPost(ch.id, 'new', new Date('2026-03-01T00:00:00Z'));
      expect(recent).toMatchObject({ pinned: false, hiddenAt: null, authorId: author, body: 'new' });
      expect(recent.createdAt).toEqual(new Date('2026-03-01T00:00:00Z'));
      await repo.updatePost(old.id, { pinned: true });
      expect((await repo.posts(ch.id)).map((p) => p.id)).toEqual([old.id, recent.id, mid.id]);
      expect((await repo.post(mid.id))?.body).toBe('mid');
      expect(await repo.post(randomUUID())).toBeNull();
    });

    it('hides and unhides; empty patch returns the row', async () => {
      const ch = await repo.createChannel(feed({ title: 'Hide' }));
      const p = await newPost(ch.id);
      const at = new Date('2026-05-05T00:00:00Z');
      expect((await repo.updatePost(p.id, { hiddenAt: at })).hiddenAt).toEqual(at);
      expect((await repo.updatePost(p.id, {})).hiddenAt).toEqual(at);
      expect((await repo.updatePost(p.id, { hiddenAt: null })).hiddenAt).toBeNull();
    });

    it('checks body length and chat-channel refusal', async () => {
      const ch = await repo.createChannel(feed({ title: 'Len' }));
      await expect(newPost(ch.id, '   ')).rejects.toBeInstanceOf(ConstraintError);
      await expect(newPost(ch.id, 'x'.repeat(POST_MAX + 1))).rejects.toThrow(bodyRangeMessage(POST_MAX));
      expect((await newPost(ch.id, 'x'.repeat(POST_MAX))).body).toHaveLength(POST_MAX);
      const chat = await repo.createChannel(feed({ title: 'Chat', kind: 'chat' }));
      await expect(newPost(chat.id)).rejects.toBeInstanceOf(ConstraintError);
    });

    it('deletePost cascades to comments (with replies), reactions, notifications', async () => {
      const ch = await repo.createChannel(feed({ title: 'DelPost' }));
      const p = await newPost(ch.id);
      const top = await newComment(p.id);
      const reply = await newComment(p.id, { parentId: top.id });
      await repo.setReaction({ targetType: 'post', targetId: p.id, profileId: other, emoji: '❤️', createdAt: new Date() }, true);
      await repo.setReaction({ targetType: 'comment', targetId: reply.id, profileId: other, emoji: '🙏', createdAt: new Date() }, true);
      await repo.addNotifications([
        { spaceId, recipientId: author, actorId: other, type: 'comment', postId: p.id, stepId: null, createdAt: new Date() },
      ]);
      await repo.deletePost(p.id);
      expect(await repo.comments('post', [p.id])).toEqual([]);
      expect(await repo.reactions('post', [p.id])).toEqual([]);
      expect(await repo.reactions('comment', [reply.id])).toEqual([]);
      expect((await repo.notifications(spaceId, author, 100)).filter((n) => n.postId === p.id)).toEqual([]);
    });
  });

  describe('comments', () => {
    it('lists oldest first for several targets; empty target list is empty', async () => {
      const ch = await repo.createChannel(feed({ title: 'Cm' }));
      const p1 = await newPost(ch.id);
      const p2 = await newPost(ch.id);
      const late = await newComment(p1.id, { createdAt: new Date('2026-03-01T00:00:00Z') });
      const early = await newComment(p2.id, { createdAt: new Date('2026-01-01T00:00:00Z') });
      expect(early).toMatchObject({ parentId: null, hiddenAt: null, spaceId, targetType: 'post' });
      expect((await repo.comments('post', [p1.id, p2.id])).map((c) => c.id)).toEqual([early.id, late.id]);
      expect((await repo.comments('post', [p1.id])).map((c) => c.id)).toEqual([late.id]);
      expect(await repo.comments('step', [p1.id])).toEqual([]);
      expect(await repo.comments('post', [])).toEqual([]);
      expect((await repo.comment(late.id))?.id).toBe(late.id);
      expect(await repo.comment(randomUUID())).toBeNull();
    });

    it('allows one reply level on the same target; refuses other shapes', async () => {
      const ch = await repo.createChannel(feed({ title: 'Reply' }));
      const p = await newPost(ch.id);
      const q = await newPost(ch.id);
      const top = await newComment(p.id);
      const reply = await newComment(p.id, { parentId: top.id });
      expect(reply.parentId).toBe(top.id);
      await expect(newComment(p.id, { parentId: reply.id })).rejects.toBeInstanceOf(ConstraintError);
      await expect(newComment(q.id, { parentId: top.id })).rejects.toBeInstanceOf(ConstraintError);
      await expect(newComment(p.id, { parentId: randomUUID() })).rejects.toBeInstanceOf(ConstraintError);
    });

    it('checks body length', async () => {
      const ch = await repo.createChannel(feed({ title: 'CLen' }));
      const p = await newPost(ch.id);
      await expect(newComment(p.id, { body: ' ' })).rejects.toBeInstanceOf(ConstraintError);
      await expect(newComment(p.id, { body: 'x'.repeat(COMMENT_MAX + 1) })).rejects.toThrow(bodyRangeMessage(COMMENT_MAX));
      expect((await newComment(p.id, { body: 'x'.repeat(COMMENT_MAX) })).body).toHaveLength(COMMENT_MAX);
    });

    it('hides; deleting a comment removes replies and reactions', async () => {
      const ch = await repo.createChannel(feed({ title: 'CDel' }));
      const p = await newPost(ch.id);
      const top = await newComment(p.id);
      const reply = await newComment(p.id, { parentId: top.id });
      const at = new Date('2026-06-06T00:00:00Z');
      expect((await repo.updateComment(top.id, { hiddenAt: at })).hiddenAt).toEqual(at);
      expect((await repo.updateComment(top.id, {})).hiddenAt).toEqual(at);
      await repo.setReaction({ targetType: 'comment', targetId: reply.id, profileId: other, emoji: '😂', createdAt: new Date() }, true);
      await repo.deleteComment(top.id);
      expect(await repo.comment(top.id)).toBeNull();
      expect(await repo.comment(reply.id)).toBeNull();
      expect(await repo.reactions('comment', [reply.id])).toEqual([]);
    });

    it('comments on a program step (lesson comments)', async () => {
      const prog = await core.createProduct({ spaceId, kind: 'program', slug: 'step-cm', title: 'P' });
      const m = await core.createModule({ programId: prog.id, title: 'M' });
      const s = await core.createStep({ moduleId: m.id, title: 'S' });
      const c = await newComment(s.id, { targetType: 'step' });
      expect((await repo.comments('step', [s.id])).map((x) => x.id)).toEqual([c.id]);
    });
  });

  describe('reactions', () => {
    it('setReaction is idempotent both ways and unique per emoji', async () => {
      const ch = await repo.createChannel(feed({ title: 'React' }));
      const p = await newPost(ch.id);
      const like = { targetType: 'post' as const, targetId: p.id, profileId: other, emoji: '👍' as const, createdAt: new Date() };
      await repo.setReaction(like, true);
      await repo.setReaction(like, true);
      await repo.setReaction({ ...like, emoji: '🔥' }, true);
      await repo.setReaction({ ...like, profileId: author }, true);
      expect(await repo.reactions('post', [p.id])).toHaveLength(3);
      expect(await repo.reactions('post', [])).toEqual([]);
      expect(await repo.reactions('comment', [p.id])).toEqual([]);
      await repo.setReaction(like, false);
      await repo.setReaction(like, false);
      const left = await repo.reactions('post', [p.id]);
      expect(left.map((r) => `${r.profileId}:${r.emoji}`).toSorted()).toEqual([`${other}:🔥`, `${author}:👍`].toSorted());
      expect(left[0]!.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('notifications', () => {
    it('lists newest first with a limit, counts unread, marks read per recipient', async () => {
      const c = await newCommunity();
      const ch = await repo.createChannel(feed({ communityId: c.id, accessGroupId: (await repo.accessGroups(c.id))[0]!.id, title: 'N' }));
      const p = await newPost(ch.id);
      const mk = (recipientId: string, actorId: string, at: string) => ({
        spaceId,
        recipientId,
        actorId,
        type: 'comment' as const,
        postId: p.id,
        stepId: null,
        createdAt: new Date(at),
      });
      await repo.addNotifications([]);
      await repo.addNotifications([
        mk(author, other, '2026-01-01T00:00:00Z'),
        mk(author, other, '2026-03-01T00:00:00Z'),
        mk(author, other, '2026-02-01T00:00:00Z'),
        mk(other, author, '2026-02-01T00:00:00Z'),
      ]);
      const mine = (await repo.notifications(spaceId, author, 100)).filter((n) => n.postId === p.id);
      expect(mine.map((n) => n.createdAt.toISOString())).toEqual([
        '2026-03-01T00:00:00.000Z',
        '2026-02-01T00:00:00.000Z',
        '2026-01-01T00:00:00.000Z',
      ]);
      expect(mine[0]).toMatchObject({ readAt: null, stepId: null, type: 'comment', recipientId: author });
      expect(await repo.notifications(spaceId, author, 2)).toHaveLength(2);

      const before = await repo.unreadNotificationCount(spaceId, author);
      const otherBefore = await repo.unreadNotificationCount(spaceId, other);
      expect(before).toBeGreaterThanOrEqual(3);
      const now = new Date('2026-07-07T00:00:00Z');
      await repo.markNotificationsRead(spaceId, author, now);
      expect(await repo.unreadNotificationCount(spaceId, author)).toBe(0);
      expect(await repo.unreadNotificationCount(spaceId, other)).toBe(otherBefore);
      expect((await repo.notifications(spaceId, author, 1))[0]!.readAt).toBeInstanceOf(Date);
      expect(await repo.unreadNotificationCount(randomUUID(), author)).toBe(0);
    });

    it('refuses a self-notification', async () => {
      await expect(
        repo.addNotifications([
          { spaceId, recipientId: author, actorId: author, type: 'mention', postId: null, stepId: null, createdAt: new Date() },
        ]),
      ).rejects.toBeInstanceOf(ConstraintError);
    });
  });

  it('lets SQL triggers award points on comments (ledger written by DB, not the repo)', async () => {
    const ch = await repo.createChannel(feed({ title: 'Points' }));
    const p = await newPost(ch.id);
    const c = await newComment(p.id);
    const { data, error } = await fx.admin.from('points_ledger').select('reason').eq('source_key', c.id);
    if (error) throw error;
    expect(data).toEqual([{ reason: 'comment' }]);
  });
});
