import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { createFakeFileStore } from '@/lib/storage/fileStore';
import { communityCommand, type CommunityCommand, type StepGate } from './commands';

const NOW = new Date('2026-11-10T12:00:00Z');
const open: StepGate = async () => true;
const shut: StepGate = async () => false;
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (profileId: string | null, space = 'alexander'): Promise<Viewer> =>
  (await resolveViewer(repo, space, profileId))!;
const run = async (who: string | null, cmd: CommunityCommand, gate: StepGate = open, space = 'alexander') =>
  communityCommand(repo, createFakeFileStore(), await as(who, space), cmd, NOW, gate);
const createdId = (r: Awaited<ReturnType<typeof run>>): string => {
  if (!r.ok || !r.id) throw new Error(`expected created id, got ${JSON.stringify(r)}`);
  return r.id;
};
const studentPost = async () =>
  createdId(await run(SEED_IDS.student, { op: 'createPost', channelId: SEED_IDS.general, body: 'hello' }));
const types = () => repo.db.notifications.map((n) => [n.recipientId, n.type]);

describe('posts', () => {
  it('members post in public channels; mentions notify directory members only', async () => {
    const r = await run(SEED_IDS.student, {
      op: 'createPost',
      channelId: SEED_IDS.general,
      body: `hi @[Alexander](${SEED_IDS.alexanderOwner}) @[Sam](${SEED_IDS.assistant})`,
    });
    expect(r.ok).toBe(true);
    expect(types()).toEqual([[SEED_IDS.alexanderOwner, 'mention']]);
  });

  it('refuses members in read-only channels, signed-out viewers, other spaces', async () => {
    const cmd: CommunityCommand = { op: 'createPost', channelId: SEED_IDS.announcements, body: 'x' };
    expect(await run(SEED_IDS.student, cmd)).toEqual({ ok: false, error: 'forbidden' });
    expect(await run(null, { ...cmd, channelId: SEED_IDS.general })).toEqual({ ok: false, error: 'forbidden' });
    expect(await run(SEED_IDS.natashaOwner, { ...cmd, channelId: SEED_IDS.general }, open, 'natasha')).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect((await run(SEED_IDS.alexanderOwner, cmd)).ok).toBe(true);
  });

  it('turns a blank body into invalid', async () => {
    expect(await run(SEED_IDS.student, { op: 'createPost', channelId: SEED_IDS.general, body: '  ' })).toMatchObject({
      ok: false,
      error: 'invalid',
    });
  });

  it('author or moderator deletes; only moderators hide and pin', async () => {
    const id = await studentPost();
    expect(await run(SEED_IDS.student, { op: 'pinPost', postId: id, pinned: true })).toEqual({ ok: false, error: 'forbidden' });
    expect((await run(SEED_IDS.alexanderOwner, { op: 'pinPost', postId: id, pinned: true })).ok).toBe(true);
    expect((await run(SEED_IDS.alexanderOwner, { op: 'hidePost', postId: id, hidden: true })).ok).toBe(true);
    expect(repo.db.posts.find((p) => p.id === id)).toMatchObject({ pinned: true, hiddenAt: NOW });
    expect(await run(SEED_IDS.student, { op: 'deletePost', postId: id })).toEqual({ ok: false, error: 'not_found' });
    expect((await run(SEED_IDS.alexanderOwner, { op: 'deletePost', postId: id })).ok).toBe(true);
  });
});

describe('channel moderators', () => {
  it('hide, pin, delete posts and hide comments in their channel only', async () => {
    await repo.setChannelModerator(SEED_IDS.general, SEED_IDS.student, true);
    const own = createdId(await run(SEED_IDS.alexanderOwner, { op: 'createPost', channelId: SEED_IDS.general, body: 'a' }));
    const away = createdId(await run(SEED_IDS.alexanderOwner, { op: 'createPost', channelId: SEED_IDS.announcements, body: 'b' }));
    const comment = createdId(
      await run(SEED_IDS.alexanderOwner, { op: 'createComment', target: { type: 'post', id: own }, parentId: null, body: 'c' }),
    );
    expect((await run(SEED_IDS.student, { op: 'hideComment', commentId: comment, hidden: true })).ok).toBe(true);
    expect((await run(SEED_IDS.student, { op: 'pinPost', postId: own, pinned: true })).ok).toBe(true);
    expect((await run(SEED_IDS.student, { op: 'hidePost', postId: own, hidden: true })).ok).toBe(true);
    // Still reaches the hidden post.
    expect((await run(SEED_IDS.student, { op: 'deletePost', postId: own })).ok).toBe(true);
    expect(await run(SEED_IDS.student, { op: 'hidePost', postId: away, hidden: true })).toEqual({ ok: false, error: 'forbidden' });
    expect(await run(SEED_IDS.student, { op: 'deletePost', postId: away })).toEqual({ ok: false, error: 'forbidden' });
  });
});

describe('posts: groups, privacy, chat', () => {
  const vipChannel = async () => {
    const group = await repo.createAccessGroup({ communityId: SEED_IDS.community, title: 'VIP' });
    return (
      await repo.createChannel({
        communityId: SEED_IDS.community,
        accessGroupId: group.id,
        title: 'VIP',
        kind: 'feed',
        privacy: 'public',
        readOnly: false,
      })
    ).id;
  };

  it('refuses members in channels of groups they do not hold; staff post anywhere', async () => {
    const channelId = await vipChannel();
    expect(await run(SEED_IDS.student, { op: 'createPost', channelId, body: 'x' })).toEqual({ ok: false, error: 'forbidden' });
    const id = createdId(await run(SEED_IDS.alexanderOwner, { op: 'createPost', channelId, body: 'vip' }));
    expect(await run(SEED_IDS.student, { op: 'react', target: { type: 'post', id }, emoji: '🔥', on: true })).toEqual({
      ok: false,
      error: 'forbidden',
    });
  });

  it('refuses posts in chat channels', async () => {
    expect(await run(SEED_IDS.alexanderOwner, { op: 'createPost', channelId: SEED_IDS.lounge, body: 'x' })).toMatchObject({
      ok: false,
      error: 'invalid',
    });
  });
});

describe('comments', () => {
  it('commenting notifies the post author; replying notifies the parent author first', async () => {
    const postId = await studentPost();
    const top = createdId(
      await run(SEED_IDS.alexanderOwner, { op: 'createComment', target: { type: 'post', id: postId }, parentId: null, body: 'hi' }),
    );
    expect(types()).toEqual([[SEED_IDS.student, 'comment']]);
    repo.db.notifications = [];
    await repo.setCommunityStaff(SEED_IDS.community, SEED_IDS.assistant, true);
    await run(SEED_IDS.assistant, { op: 'createComment', target: { type: 'post', id: postId }, parentId: top, body: 'yo' });
    expect(types()).toEqual([
      [SEED_IDS.alexanderOwner, 'reply'],
      [SEED_IDS.student, 'comment'],
    ]);
  });

  it('refuses a reply to a reply (one level, G12)', async () => {
    const postId = await studentPost();
    const target = { type: 'post' as const, id: postId };
    const top = createdId(await run(SEED_IDS.student, { op: 'createComment', target, parentId: null, body: 'a' }));
    const reply = createdId(await run(SEED_IDS.student, { op: 'createComment', target, parentId: top, body: 'b' }));
    expect(await run(SEED_IDS.student, { op: 'createComment', target, parentId: reply, body: 'c' })).toMatchObject({
      error: 'invalid',
    });
  });

  it('step comments need an open step and notify comment moderators', async () => {
    const cmd: CommunityCommand = { op: 'createComment', target: { type: 'step', id: 'step-intro' }, parentId: null, body: 'q' };
    expect(await run(SEED_IDS.student, cmd, shut)).toEqual({ ok: false, error: 'forbidden' });
    expect((await run(SEED_IDS.student, cmd)).ok).toBe(true);
    expect(types()).toEqual([
      [SEED_IDS.alexanderOwner, 'step_comment'],
      [SEED_IDS.assistant, 'step_comment'],
    ]);
    expect(repo.db.notifications[0]).toMatchObject({ stepId: 'step-intro', postId: null });
  });

  it('author or moderator deletes; moderators hide', async () => {
    const postId = await studentPost();
    const id = createdId(
      await run(SEED_IDS.alexanderOwner, { op: 'createComment', target: { type: 'post', id: postId }, parentId: null, body: 'x' }),
    );
    expect(await run(SEED_IDS.student, { op: 'deleteComment', commentId: id })).toEqual({ ok: false, error: 'forbidden' });
    expect(await run(SEED_IDS.student, { op: 'hideComment', commentId: id, hidden: true })).toEqual({ ok: false, error: 'forbidden' });
    expect((await run(SEED_IDS.alexanderOwner, { op: 'hideComment', commentId: id, hidden: true })).ok).toBe(true);
    expect((await run(SEED_IDS.alexanderOwner, { op: 'deleteComment', commentId: id })).ok).toBe(true);
    expect(repo.db.comments).toEqual([]);
  });
});

describe('reactions', () => {
  it('toggles, validates emoji, notifies the author on the first reaction only', async () => {
    const postId = await studentPost();
    const react = (emoji: string, on: boolean) =>
      run(SEED_IDS.alexanderOwner, { op: 'react', target: { type: 'post', id: postId }, emoji, on });
    expect(await react('💩', true)).toMatchObject({ error: 'invalid' });
    await react('🔥', true);
    await react('👍', true);
    await react('👍', false);
    expect(repo.db.reactions.map((r) => r.emoji)).toEqual(['🔥']);
    expect(types()).toEqual([[SEED_IDS.student, 'reaction']]);
  });

  it('refuses reacting without access', async () => {
    const postId = await studentPost();
    expect(await run(null, { op: 'react', target: { type: 'post', id: postId }, emoji: '🔥', on: true })).toEqual({
      ok: false,
      error: 'forbidden',
    });
  });
});

describe('moderation review (lock, approval, log)', () => {
  const log = () => repo.db.moderationLog.map((l) => [l.actorId, l.action, l.targetType]);

  it('moderators lock and unlock; locked posts take no comments, even from moderators', async () => {
    const id = await studentPost();
    expect(await run(SEED_IDS.student, { op: 'lockPost', postId: id, locked: true })).toEqual({ ok: false, error: 'forbidden' });
    expect((await run(SEED_IDS.alexanderOwner, { op: 'lockPost', postId: id, locked: true })).ok).toBe(true);
    expect(repo.db.posts.find((p) => p.id === id)?.lockedAt).toEqual(NOW);
    const comment: CommunityCommand = { op: 'createComment', target: { type: 'post', id }, parentId: null, body: 'hi' };
    expect(await run(SEED_IDS.student, comment)).toMatchObject({ ok: false, error: 'invalid', message: 'This post is locked.' });
    expect(await run(SEED_IDS.alexanderOwner, comment)).toMatchObject({ ok: false, error: 'invalid' });
    expect((await run(SEED_IDS.alexanderOwner, { op: 'lockPost', postId: id, locked: false })).ok).toBe(true);
    expect((await run(SEED_IDS.student, comment)).ok).toBe(true);
    expect(log()).toEqual([
      [SEED_IDS.alexanderOwner, 'lock', 'post'],
      [SEED_IDS.alexanderOwner, 'unlock', 'post'],
    ]);
  });

  it('logs hide and unhide of posts and comments', async () => {
    const id = await studentPost();
    const comment = createdId(await run(SEED_IDS.student, { op: 'createComment', target: { type: 'post', id }, parentId: null, body: 'c' }));
    await run(SEED_IDS.alexanderOwner, { op: 'hideComment', commentId: comment, hidden: true });
    await run(SEED_IDS.alexanderOwner, { op: 'hidePost', postId: id, hidden: true });
    await run(SEED_IDS.alexanderOwner, { op: 'hidePost', postId: id, hidden: false });
    await run(SEED_IDS.alexanderOwner, { op: 'pinPost', postId: id, pinned: true });
    expect(log()).toEqual([
      [SEED_IDS.alexanderOwner, 'hide', 'comment'],
      [SEED_IDS.alexanderOwner, 'hide', 'post'],
      [SEED_IDS.alexanderOwner, 'unhide', 'post'],
    ]);
  });

  it('approval members post pending, without mention notifications; moderators approve or reject', async () => {
    await repo.setPostApproval(SEED_IDS.community, SEED_IDS.student, true);
    const id = createdId(
      await run(SEED_IDS.student, { op: 'createPost', channelId: SEED_IDS.general, body: `hi @[A](${SEED_IDS.alexanderOwner})` }),
    );
    expect(repo.db.posts.find((p) => p.id === id)?.status).toBe('pending');
    expect(types()).toEqual([]);
    const comment: CommunityCommand = { op: 'createComment', target: { type: 'post', id }, parentId: null, body: 'x' };
    expect(await run(SEED_IDS.student, comment)).toMatchObject({ ok: false, error: 'invalid' });
    expect(await run(SEED_IDS.student, { op: 'reviewPost', postId: id, decision: 'approve' })).toEqual({ ok: false, error: 'forbidden' });
    expect((await run(SEED_IDS.alexanderOwner, { op: 'reviewPost', postId: id, decision: 'reject' })).ok).toBe(true);
    expect(repo.db.posts.find((p) => p.id === id)?.status).toBe('rejected');
    expect((await run(SEED_IDS.alexanderOwner, { op: 'reviewPost', postId: id, decision: 'approve' })).ok).toBe(true);
    expect(repo.db.posts.find((p) => p.id === id)?.status).toBe('published');
    expect(await run(SEED_IDS.alexanderOwner, { op: 'reviewPost', postId: id, decision: 'approve' })).toMatchObject({ error: 'invalid' });
    expect(log()).toEqual([
      [SEED_IDS.alexanderOwner, 'reject', 'post'],
      [SEED_IDS.alexanderOwner, 'approve', 'post'],
    ]);
    expect(types()).toEqual([]);
  });

  it('others cannot reach a pending post', async () => {
    const id = createdId(await run(SEED_IDS.alexanderOwner, { op: 'createPost', channelId: SEED_IDS.general, body: 'p' }));
    await repo.updatePost(id, { status: 'pending' });
    expect(await run(SEED_IDS.student, { op: 'react', target: { type: 'post', id }, emoji: '🔥', on: true })).toEqual({
      ok: false,
      error: 'not_found',
    });
  });
});
