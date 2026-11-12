import { beforeEach, describe, expect, it } from 'vitest';
import { emptyDb } from '@/lib/data/fake/db';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import type { Offer } from '@/lib/data/types';
import { upsellFor } from './upsell';

const NOW = new Date('2026-11-12T12:00:00Z');

let repo: FakeRepo;
let offer: Offer;
let upsell: Offer;
let productId: string;

beforeEach(async () => {
  repo = createFakeRepo(emptyDb());
  repo.db.spaces.push({ id: 's1', slug: 'alexander', name: 'Alexander', status: 'live', locale: 'en', isTest: false });
  offer = await repo.createOffer({ spaceId: 's1', slug: 'full', title: 'Full', priceCents: 4900, currency: 'EUR' });
  upsell = await repo.createOffer({ spaceId: 's1', slug: 'vip', title: 'VIP', priceCents: 9900, currency: 'EUR' });
  await repo.updateOffer(upsell.id, { status: 'published', description: 'Live calls' });
  await repo.updateOffer(offer.id, { status: 'published', upsellOfferId: upsell.id });
  productId = (await repo.createProduct({ spaceId: 's1', kind: 'program', slug: 'v', title: 'V' })).id;
  await repo.setOfferItems(upsell.id, [{ productId, accessGroupId: null }]);
});

describe('upsellFor', () => {
  it('offers the published upsell of the bought offer', async () => {
    expect(await upsellFor(repo, 's1', 'full', null, NOW)).toEqual({
      slug: 'vip',
      title: 'VIP',
      description: 'Live calls',
      priceCents: 9900,
      currency: 'EUR',
    });
  });

  it('skips a draft upsell, an offer without one, or one the buyer already holds', async () => {
    expect(await upsellFor(repo, 's1', 'gone', null, NOW)).toBeNull();
    const buyer = await repo.createProfile('b@test.com');
    await repo.createGrant({ productId, profileId: buyer.id, source: 'manual' });
    expect(await upsellFor(repo, 's1', 'full', buyer.id, NOW)).toBeNull();
    await repo.updateOffer(upsell.id, { status: 'draft' });
    expect(await upsellFor(repo, 's1', 'full', null, NOW)).toBeNull();
    await repo.updateOffer(offer.id, { upsellOfferId: null });
    expect(await upsellFor(repo, 's1', 'full', null, NOW)).toBeNull();
  });
});
