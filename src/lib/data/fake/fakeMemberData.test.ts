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
