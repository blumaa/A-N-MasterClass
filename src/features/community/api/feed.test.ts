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
    expect(page.channels.map((c) => c.title)).toEqual(['General', 'Announcements']);
    expect(page.channel.id).toBe(SEED_IDS.general);
    expect(page.canPost).toBe(true);
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
    expect(student.canPost).toBe(false);
    expect(student.posts.map((p) => [p.pinned, p.canDelete])).toEqual([[true, false]]);
    expect(owner.canPost).toBe(true);
    expect(owner.posts[0]?.canDelete).toBe(true);
  });

  it('returns null for a channel of another community', async () => {
    expect(await communityPage(repo, await as(SEED_IDS.student), 'community', 'chan-x', NOW)).toBeNull();
  });

  it('shows hidden posts to moderators only, flagged', async () => {
    const p = await post(SEED_IDS.general, SEED_IDS.student, 'spam');
    await repo.updatePost(p.id, { hiddenAt: NOW });
    const student = await communityPage(repo, await as(SEED_IDS.student), 'community', null, NOW);
    const owner = await communityPage(repo, await as(SEED_IDS.alexanderOwner), 'community', null, NOW);
    if (student?.kind !== 'open' || owner?.kind !== 'open') throw new Error('expected open');
    expect(student.posts).toEqual([]);
    expect(owner.posts.map((x) => x.hidden)).toEqual([true]);
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

  it('returns null without access, for a post of another community, or a hidden post for members', async () => {
    const p = await post(SEED_IDS.general, SEED_IDS.student, 'hello');
    expect(await postPage(repo, await as(null), 'community', p.id, NOW)).toBeNull();
    expect(await postPage(repo, await as(SEED_IDS.student), 'community', 'post-x', NOW)).toBeNull();
    await repo.updatePost(p.id, { hiddenAt: NOW });
    expect(await postPage(repo, await as(SEED_IDS.student), 'community', p.id, NOW)).toBeNull();
    expect(await postPage(repo, await as(SEED_IDS.alexanderOwner), 'community', p.id, NOW)).not.toBeNull();
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
