import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { communityPage, directory, myCommunities, postPage } from './feed';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (profileId: string | null, space = 'alexander'): Promise<Viewer> =>
  (await resolveViewer(repo, space, profileId))!;

const post = (channelId: string, authorId: string, body: string, minutesAgo = 0) =>
  repo.createPost({ channelId, authorId, body, createdAt: new Date(NOW.getTime() - minutesAgo * 60_000) });

describe('communityPage', () => {
  it('returns null for an unknown slug or a program slug', async () => {
    expect(await communityPage(repo, await as(SEED_IDS.student), 'nope', null, NOW)).toBeNull();
    expect(await communityPage(repo, await as(SEED_IDS.student), 'shibari-101', null, NOW)).toBeNull();
  });

  it('is locked for viewers without access', async () => {
    const page = await communityPage(repo, await as(null), 'community', null, NOW);
    expect(page?.kind).toBe('locked');
    expect(page?.community.title).toBe('Rope Community');
  });

  it('hides a draft from members entirely', async () => {
    await repo.updateProduct(SEED_IDS.community, { status: 'draft' });
    expect(await communityPage(repo, await as(SEED_IDS.student), 'community', null, NOW)).toBeNull();
  });

  it('opens the first channel by default, with posts, counts and reactions', async () => {
    const p = await post(SEED_IDS.general, SEED_IDS.student, 'hello', 5);
    await repo.createComment({
      spaceId: SEED_IDS.alexander,
      targetType: 'post',
      targetId: p.id,
      parentId: null,
      authorId: SEED_IDS.alexanderOwner,
      body: 'hi',
      createdAt: NOW,
    });
    await repo.setReaction({ targetType: 'post', targetId: p.id, profileId: SEED_IDS.student, emoji: '🔥', createdAt: NOW }, true);
    const page = await communityPage(repo, await as(SEED_IDS.student), 'community', null, NOW);
    if (page?.kind !== 'open') throw new Error('expected open');
    expect(page.channels.map((c) => c.title)).toEqual(['General', 'Announcements', 'Lounge']);
    expect(page.channel.id).toBe(SEED_IDS.general);
    expect(page.rules.post).toBe(true);
    expect(page.posts).toEqual([
      expect.objectContaining({
        body: 'hello',
        author: { id: SEED_IDS.student, name: 'Robin (student)' },
        commentCount: 1,
        reactions: [{ emoji: '🔥', count: 1, mine: true }],
        canDelete: true,
      }),
    ]);
  });

  it('refuses posting in a read-only channel for members; owner may', async () => {
    const student = await communityPage(repo, await as(SEED_IDS.student), 'community', SEED_IDS.announcements, NOW);
    const owner = await communityPage(repo, await as(SEED_IDS.alexanderOwner), 'community', SEED_IDS.announcements, NOW);
    if (student?.kind !== 'open' || owner?.kind !== 'open') throw new Error('expected open');
    expect(student.rules.post).toBe(false);
    expect(student.posts.map((p) => [p.pinned, p.canDelete])).toEqual([[true, false]]);
    expect(owner.rules.post).toBe(true);
    expect(owner.posts[0]?.canDelete).toBe(true);
  });

  it('returns null for a channel of another community', async () => {
    expect(await communityPage(repo, await as(SEED_IDS.student), 'community', 'chan-x', NOW)).toBeNull();
  });

  it('hidden posts leave the feed for everyone (moderators use the Hidden tab)', async () => {
    const p = await post(SEED_IDS.general, SEED_IDS.student, 'spam');
    await repo.updatePost(p.id, { hiddenAt: NOW });
    const student = await communityPage(repo, await as(SEED_IDS.student), 'community', null, NOW);
    const owner = await communityPage(repo, await as(SEED_IDS.alexanderOwner), 'community', null, NOW);
    if (student?.kind !== 'open' || owner?.kind !== 'open') throw new Error('expected open');
    expect(student.posts).toEqual([]);
    expect(owner.posts).toEqual([]);
  });

  it('pending and rejected posts show to their author only, flagged; locked posts stay', async () => {
    const pending = await post(SEED_IDS.general, SEED_IDS.student, 'wait');
    const locked = await post(SEED_IDS.general, SEED_IDS.alexanderOwner, 'shut', 1);
    await repo.updatePost(pending.id, { status: 'pending' });
    await repo.updatePost(locked.id, { lockedAt: NOW });
    const student = await communityPage(repo, await as(SEED_IDS.student), 'community', null, NOW);
    const owner = await communityPage(repo, await as(SEED_IDS.alexanderOwner), 'community', null, NOW);
    if (student?.kind !== 'open' || owner?.kind !== 'open') throw new Error('expected open');
    expect(student.posts.map((x) => [x.body, x.status, x.locked])).toEqual([
      ['wait', 'pending', false],
      ['shut', 'published', true],
    ]);
    expect(owner.posts.map((x) => x.body)).toEqual(['shut']);
    expect(await postPage(repo, await as(SEED_IDS.alexanderOwner), 'community', pending.id, NOW)).not.toBeNull();
    expect((await postPage(repo, await as(SEED_IDS.student), 'community', pending.id, NOW))?.open).toBe(false);
    expect((await postPage(repo, await as(SEED_IDS.student), 'community', locked.id, NOW))?.open).toBe(false);
    await repo.updatePost(locked.id, { lockedAt: null });
    expect((await postPage(repo, await as(SEED_IDS.student), 'community', locked.id, NOW))?.open).toBe(true);
  });

  it('channel moderators delete in their channel; items flag the viewer\'s own', async () => {
    const p = await post(SEED_IDS.general, SEED_IDS.alexanderOwner, 'spam');
    await post(SEED_IDS.general, SEED_IDS.student, 'mine', 1);
    await repo.updatePost(p.id, { hiddenAt: NOW });
    await repo.setChannelModerator(SEED_IDS.general, SEED_IDS.student, true);
    const page = await communityPage(repo, await as(SEED_IDS.student), 'community', SEED_IDS.general, NOW);
    if (page?.kind !== 'open') throw new Error('expected open');
    expect(page.rules).toMatchObject({ moderatePosts: true, moderateComments: true });
    expect(page.posts.map((x) => [x.body, x.hidden, x.canDelete, x.mine])).toEqual([['mine', false, true, true]]);
    const postView = await postPage(repo, await as(SEED_IDS.student), 'community', p.id, NOW);
    expect(postView?.post.hidden).toBe(true);
  });
});

describe('communityPage: groups, privacy and chat', () => {
  const vipChannel = async () => {
    const vip = await repo.createAccessGroup({ communityId: SEED_IDS.community, title: 'VIP' });
    return repo.createChannel({
      communityId: SEED_IDS.community,
      accessGroupId: vip.id,
      title: 'Backstage',
      kind: 'feed',
      privacy: 'public',
      readOnly: false,
    });
  };

  it('lists only channels of the member\'s groups; staff see all', async () => {
    await vipChannel();
    const student = await communityPage(repo, await as(SEED_IDS.student), 'community', null, NOW);
    const owner = await communityPage(repo, await as(SEED_IDS.alexanderOwner), 'community', null, NOW);
    if (student?.kind !== 'open' || owner?.kind !== 'open') throw new Error('expected open');
    expect(student.channels.map((c) => c.title)).not.toContain('Backstage');
    expect(owner.channels.map((c) => c.title)).toContain('Backstage');
  });

  it('returns null for a channel the member cannot read', async () => {
    const backstage = await vipChannel();
    expect(await communityPage(repo, await as(SEED_IDS.student), 'community', backstage.id, NOW)).toBeNull();
  });

  it('opens a chat channel with its messages, oldest first; author or moderator deletes', async () => {
    await repo.createMessage({
      channelId: SEED_IDS.lounge,
      threadId: null,
      authorId: SEED_IDS.student,
      body: 'hi!',
      createdAt: NOW,
    });
    const student = await communityPage(repo, await as(SEED_IDS.student), 'community', SEED_IDS.lounge, NOW);
    const owner = await communityPage(repo, await as(SEED_IDS.alexanderOwner), 'community', SEED_IDS.lounge, NOW);
    if (student?.kind !== 'open' || owner?.kind !== 'open') throw new Error('expected open');
    expect(student.posts).toEqual([]);
    expect(student.rules.post).toBe(true);
    expect(student.messages.map((m) => [m.body, m.author.name, m.canDelete])).toEqual([
      ['Hello everyone, say hi here.', 'Alexander', false],
      ['hi!', 'Robin (student)', true],
    ]);
    expect(owner.messages.map((m) => m.canDelete)).toEqual([true, true]);
  });
});

describe('postPage', () => {
  it('returns the post with its thread for members', async () => {
    const p = await post(SEED_IDS.general, SEED_IDS.student, 'hello');
    const c = await repo.createComment({
      spaceId: SEED_IDS.alexander,
      targetType: 'post',
      targetId: p.id,
      parentId: null,
      authorId: SEED_IDS.alexanderOwner,
      body: 'welcome',
      createdAt: NOW,
    });
    const page = await postPage(repo, await as(SEED_IDS.student), 'community', p.id, NOW);
    expect(page?.post.body).toBe('hello');
    expect(page?.channel.id).toBe(SEED_IDS.general);
    expect(page?.comments.map((n) => n.id)).toEqual([c.id]);
  });

  it('lists only channels the viewer reads (nav must not leak private titles)', async () => {
    const p = await post(SEED_IDS.general, SEED_IDS.student, 'hello');
    await repo.createChannel({
      communityId: SEED_IDS.community,
      accessGroupId: SEED_IDS.members,
      title: 'Secret',
      kind: 'chat',
      privacy: 'private',
      readOnly: false,
    });
    const titles = (await postPage(repo, await as(SEED_IDS.student), 'community', p.id, NOW))?.channels.map((c) => c.title);
    expect(titles).not.toContain('Secret');
    expect(titles).toContain('General');
  });

  it('returns null without access, for a post of another community, or a hidden post for members', async () => {
    const p = await post(SEED_IDS.general, SEED_IDS.student, 'hello');
    expect(await postPage(repo, await as(null), 'community', p.id, NOW)).toBeNull();
    expect(await postPage(repo, await as(SEED_IDS.student), 'community', 'post-x', NOW)).toBeNull();
    await repo.updatePost(p.id, { hiddenAt: NOW });
    expect(await postPage(repo, await as(SEED_IDS.student), 'community', p.id, NOW)).toBeNull();
    expect(await postPage(repo, await as(SEED_IDS.alexanderOwner), 'community', p.id, NOW)).not.toBeNull();
  });

  it('returns null for a post in a channel the member cannot read', async () => {
    const vip = await repo.createAccessGroup({ communityId: SEED_IDS.community, title: 'VIP' });
    const backstage = await repo.createChannel({
      communityId: SEED_IDS.community,
      accessGroupId: vip.id,
      title: 'Backstage',
      kind: 'feed',
      privacy: 'public',
      readOnly: false,
    });
    const p = await post(backstage.id, SEED_IDS.alexanderOwner, 'vip only');
    expect(await postPage(repo, await as(SEED_IDS.student), 'community', p.id, NOW)).toBeNull();
  });
});

describe('directory', () => {
  it('lists active members plus reaching staff, sorted by name', async () => {
    const community = (await repo.product(SEED_IDS.community))!;
    expect(await directory(repo, community, NOW)).toEqual([
      { id: SEED_IDS.alexanderOwner, name: 'Alexander', staff: true },
      { id: SEED_IDS.student, name: 'Robin (student)', staff: false },
    ]);
    await repo.setCommunityStaff(community.id, SEED_IDS.assistant, true);
    await repo.revokeGrant('grant-student-community');
    expect((await directory(repo, community, NOW)).map((m) => m.id)).toEqual([SEED_IDS.alexanderOwner, SEED_IDS.assistant]);
  });
});

describe('myCommunities', () => {
  it('lists communities the viewer can read', async () => {
    expect((await myCommunities(repo, await as(SEED_IDS.student), NOW)).map((c) => c.slug)).toEqual(['community']);
    expect(await myCommunities(repo, await as(null), NOW)).toEqual([]);
    expect(await myCommunities(repo, await as(SEED_IDS.student, 'natasha'), NOW)).toEqual([]);
  });
});
