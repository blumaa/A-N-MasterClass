import { beforeEach, describe, expect, it } from 'vitest';
import { emptyDb } from '@/lib/data/fake/db';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { giveGrants } from './buyer';

const NOW = new Date('2026-11-10T12:00:00Z');

let repo: FakeRepo;
let offerId: string;
let productId: string;
let profileId: string;

beforeEach(async () => {
  repo = createFakeRepo(emptyDb());
  repo.db.spaces.push({ id: 's1', slug: 'alexander', name: 'Alexander', status: 'live', locale: 'en', isTest: false });
  const offer = await repo.createOffer({
    spaceId: 's1',
    slug: 'full',
    title: 'Full',
    priceCents: 4900,
    currency: 'EUR',
  });
  offerId = offer.id;
  productId = (await repo.createProduct({ spaceId: 's1', kind: 'program', slug: 'a', title: 'A' })).id;
  await repo.setOfferItems(offerId, [{ productId, accessGroupId: null }]);
  profileId = (await repo.createProfile('buyer@test.com')).id;
});

describe('giveGrants', () => {
  it('grants each offer product once, linked to the order or subscription', async () => {
    await giveGrants(repo, profileId, [offerId, offerId], { subscriptionId: 'sub-1' }, NOW);
    const grants = await repo.grantsForProduct(productId);
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ profileId, subscriptionId: 'sub-1', orderId: null, source: 'purchase' });
  });

  it('keeps a live grant instead of granting twice', async () => {
    await repo.createGrant({ productId, profileId, source: 'manual' });
    await giveGrants(repo, profileId, [offerId], { orderId: 'o-1' }, NOW);
    expect(await repo.grantsForProduct(productId)).toHaveLength(1);
  });

  it('revokes an expired grant that is still active, then grants again', async () => {
    const old = await repo.createGrant({ productId, profileId, source: 'purchase', subscriptionId: 'sub-0' });
    await repo.setGrantExpiry(old.id, new Date('2026-11-01T00:00:00Z'));
    await giveGrants(repo, profileId, [offerId], { orderId: 'o-1' }, NOW);
    const grants = await repo.grantsForProduct(productId);
    expect(grants.map((g) => [g.id === old.id, g.status, g.orderId])).toEqual([
      [true, 'revoked', null],
      [false, 'active', 'o-1'],
    ]);
  });

  it('a purchase replaces a live subscription grant with a permanent one', async () => {
    const sub = await repo.createGrant({ productId, profileId, source: 'purchase', subscriptionId: 'sub-0' });
    await giveGrants(repo, profileId, [offerId], { orderId: 'o-1' }, NOW);
    const grants = await repo.grantsForProduct(productId);
    expect(grants.map((g) => [g.id === sub.id, g.status, g.orderId])).toEqual([
      [true, 'revoked', null],
      [false, 'active', 'o-1'],
    ]);
  });

  it('a subscription keeps a held permanent grant', async () => {
    await giveGrants(repo, profileId, [offerId], { orderId: 'o-1' }, NOW);
    await giveGrants(repo, profileId, [offerId], { subscriptionId: 'sub-1' }, NOW);
    expect(await repo.grantsForProduct(productId)).toMatchObject([{ orderId: 'o-1', status: 'active' }]);
  });
});
