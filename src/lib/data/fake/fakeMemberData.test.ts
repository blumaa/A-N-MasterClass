import { beforeEach, describe, expect, it } from 'vitest';
import { createFakeRepo, type FakeRepo } from './fakeRepo';
import type { Db } from './db';
import { SEED_IDS, seedDb } from './seed';

const { alexander, natasha, student, alexanderOwner, general, program } = SEED_IDS;

let db: Db;
let repo: FakeRepo;
beforeEach(() => {
  db = seedDb(new Date('2026-11-12T12:00:00Z'));
  repo = createFakeRepo(db);
});

const addPost = async () => {
  const post = await repo.createPost({ channelId: general, authorId: student, body: 'mine', createdAt: new Date() });
  db.postPhotos.push({ id: 'ph-1', postId: post.id, path: `photo/${post.id}.png`, thumbPath: null, position: 0 });
  return post;
};

describe('memberSpaceData', () => {
  it('covers this space only', async () => {
    await addPost();
    await repo.setStepComplete(student, 'step-intro', true);
    const data = await repo.memberSpaceData(alexander, student);
    expect(data.account).toEqual({ email: 'student@example.test' });
    expect(data.profile).toMatchObject({ display_name: 'Robin (student)' });
    expect(data.posts).toHaveLength(1);
    expect(data.progress).toHaveLength(1);
    const other = await repo.memberSpaceData(natasha, student);
    expect(other.posts).toHaveLength(0);
    expect(other.progress).toHaveLength(0);
  });
});

describe('memberSpaceData: person-linked tables', () => {
  const { assistant, community, lounge, podcast } = SEED_IDS;
  const at = new Date('2026-11-12T10:00:00Z');

  const seedRows = () => {
    db.moderationLog.push(
      { id: 'ml-1', communityId: community, channelId: general, actorId: student, action: 'hide', targetType: 'post', targetId: 'p-1', createdAt: at },
      { id: 'ml-2', communityId: community, channelId: general, actorId: assistant, action: 'lock', targetType: 'post', targetId: 'p-2', createdAt: at },
      { id: 'ml-3', communityId: community, channelId: general, actorId: null, action: 'hide', targetType: 'post', targetId: 'p-3', createdAt: at },
    );
    db.postApprovalMembers.push({ communityId: community, profileId: student }, { communityId: community, profileId: assistant });
    db.pushMutes.push(
      { spaceId: alexander, profileId: student, type: 'reaction' },
      { spaceId: natasha, profileId: student, type: 'comment' },
      { spaceId: alexander, profileId: assistant, type: 'mention' },
    );
    db.channelMembers.push({ channelId: lounge, profileId: student }, { channelId: lounge, profileId: assistant });
    db.channelModerators.push({ channelId: general, profileId: student });
    db.communityStaff.push({ communityId: community, profileId: student });
    db.dmThreads.push({ id: 'dm-1', communityId: community, aId: assistant, bId: student });
    db.dmReads.push({ threadId: 'dm-1', profileId: student, readAt: at }, { threadId: 'dm-1', profileId: assistant, readAt: at });
    db.blocks.push({ communityId: community, blockerId: student, blockedId: assistant }, { communityId: community, blockerId: assistant, blockedId: student });
    db.reports.push(
      { id: 'r-1', communityId: community, channelId: general, targetType: 'post', targetId: 'p-1', reason: 'spam', status: 'open', createdAt: at, resolvedBy: null, resolvedAt: null, reporterId: student },
      { id: 'r-2', communityId: community, channelId: general, targetType: 'post', targetId: 'p-2', reason: 'other', status: 'open', createdAt: at, resolvedBy: null, resolvedAt: null, reporterId: assistant },
    );
    db.podcastFeeds.push({ productId: podcast, profileId: student, token: 'secret-token', createdAt: at });
    db.pushSubscriptions.push({ spaceId: alexander, profileId: student, endpoint: 'https://push.example/1', p256dh: 'k', auth: 'a', userAgent: 'UA' });
    db.claimTokens.push({ tokenHash: 'h', spaceId: alexander, profileId: student, expiresAt: at, usedAt: null });
    db.notifications.push({ id: 'n-1', spaceId: alexander, recipientId: assistant, actorId: student, type: 'reaction', postId: 'p-2', stepId: null, communityId: null, createdAt: at, readAt: null });
  };

  it('exports moderation log rows where the member is the actor', async () => {
    seedRows();
    const data = await repo.memberSpaceData(alexander, student);
    expect(data.moderation_log).toEqual([{ action: 'hide', target_type: 'post', target_id: 'p-1', created_at: at }]);
  });

  it('exports approval status and push mutes of this space', async () => {
    seedRows();
    const data = await repo.memberSpaceData(alexander, student);
    expect(data.post_approval_members).toEqual([{ community: 'Rope Community' }]);
    expect(data.push_mutes).toEqual([{ type: 'reaction' }]);
  });

  it('exports the rest of the member rows, never other members', async () => {
    seedRows();
    const data = await repo.memberSpaceData(alexander, student);
    expect(data.channel_members).toEqual([{ channel: 'Lounge' }]);
    expect(data.channel_moderators).toEqual([{ channel: 'General' }]);
    expect(data.community_staff).toEqual([{ community: 'Rope Community' }]);
    expect(data.dm_threads).toEqual([{ id: 'dm-1', community: 'Rope Community' }]);
    expect(data.dm_reads).toEqual([{ thread_id: 'dm-1', read_at: at }]);
    expect(data.blocks).toEqual([{ community: 'Rope Community', blocked: 'Sam (assistant)' }]);
    expect(data.reports).toEqual([{ target_type: 'post', target_id: 'p-1', reason: 'spam', status: 'open', created_at: at }]);
    expect(data.podcast_feeds).toEqual([{ podcast: expect.any(String), created_at: at }]);
    expect(JSON.stringify(data.podcast_feeds)).not.toContain('secret-token');
    expect(data.push_subscriptions).toEqual([{ endpoint: 'https://push.example/1', user_agent: 'UA' }]);
    expect(data.claim_tokens).toEqual([{ expires_at: at, used_at: null }]);
    expect(data.notifications_sent).toEqual([{ type: 'reaction', post_id: 'p-2', step_id: null, created_at: at }]);
  });

  it('is empty in another space', async () => {
    seedRows();
    const data = await repo.memberSpaceData(natasha, student);
    for (const key of ['moderation_log', 'post_approval_members', 'channel_members', 'dm_threads', 'blocks', 'reports', 'podcast_feeds', 'push_subscriptions']) {
      expect(data[key], key).toEqual([]);
    }
    expect(data.push_mutes).toEqual([{ type: 'comment' }]);
  });
});

describe('eraseMemberSpace', () => {
  it('refuses the owner', async () => {
    await expect(repo.eraseMemberSpace(alexander, alexanderOwner)).rejects.toThrow('owner cannot leave the space');
  });

  it('removes the member from one space, keeps orders without the profile', async () => {
    await addPost();
    db.orders.push({
      id: 'order-x', spaceId: alexander, offerId: 'offer-x', profileId: student, email: 'student@example.test',
      provider: 'fake', providerOrderId: 'x', captureId: null, status: 'paid', amountCents: 100, couponId: null,
      discountCents: 0, bumpOfferId: null, bumpCents: 0, currency: 'EUR', livemode: false, waiverVersion: 'v1',
      waiverAcceptedAt: new Date(), marketingConsent: false, createdAt: new Date(), paidAt: new Date(),
    });
    const erased = await repo.eraseMemberSpace(alexander, student);
    expect(erased).toEqual({ lastSpace: false });
    expect(db.spaceProfiles.some((p) => p.spaceId === alexander && p.profileId === student)).toBe(false);
    expect(db.posts.some((p) => p.authorId === student)).toBe(false);
    expect(db.grants.some((g) => g.productId === program && g.profileId === student)).toBe(false);
    expect(db.orders.find((o) => o.id === 'order-x')?.profileId).toBeNull();
    expect(db.spaceProfiles.some((p) => p.spaceId === natasha && p.profileId === student)).toBe(true);
  });

  it('reports the last space', async () => {
    await repo.eraseMemberSpace(alexander, student);
    expect((await repo.eraseMemberSpace(natasha, student)).lastSpace).toBe(true);
  });
});

describe('deleteAccount', () => {
  it('removes the profile', async () => {
    await repo.deleteAccount(student);
    expect(await repo.profile(student)).toBeNull();
  });
});
