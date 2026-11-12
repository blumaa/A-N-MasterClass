import { beforeEach, describe, expect, it } from 'vitest';
import { emptyDb } from '@/lib/data/fake/db';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import type { Offer, Order } from '@/lib/data/types';
import { createFakeProvider, type FakeProvider } from '@/lib/payments/fake';
import type { Capture } from '@/lib/payments/provider';
import { applyProviderEvent, fulfilOrder } from './fulfil';

const NOW = new Date('2026-11-10T12:00:00Z');

let repo: FakeRepo;
let offer: Offer;
let productIds: string[];

beforeEach(async () => {
  repo = createFakeRepo(emptyDb());
  repo.db.spaces.push({ id: 's1', slug: 'alexander', name: 'Alexander', status: 'live', locale: 'en', isTest: false });
  offer = await repo.createOffer({ spaceId: 's1', slug: 'full', title: 'Full', priceCents: 4900, currency: 'EUR' });
  const a = await repo.createProduct({ spaceId: 's1', kind: 'program', slug: 'a', title: 'A' });
  const b = await repo.createProduct({ spaceId: 's1', kind: 'community', slug: 'b', title: 'B' });
  productIds = [a.id, b.id];
  await repo.setOfferItems(offer.id, productIds.map((productId) => ({ productId, accessGroupId: null })));
});

const newOrder = (extra: Partial<Order> = {}) =>
  repo.createOrder({
    spaceId: 's1',
    offerId: offer.id,
    email: 'buyer@test.com',
    provider: 'fake',
    providerOrderId: 'PO-1',
    amountCents: 4900,
    currency: 'EUR',
    livemode: false,
    waiverVersion: 'v1',
    waiverAcceptedAt: NOW,
    marketingConsent: false,
    createdAt: NOW,
    ...extra,
  });

const capture = (extra: Partial<Capture> = {}): Capture => ({ captureId: 'CAP-1', status: 'COMPLETED', amountCents: 4900, currency: 'EUR', ...extra });

describe('fulfilOrder', () => {
  it('creates the buyer account, grants every offer product and marks the order paid', async () => {
    const order = await newOrder();
    const result = await fulfilOrder(repo, order, capture(), NOW);
    expect(result).toMatchObject({ status: 'paid', orderId: order.id, newAccount: true });
    if (result.status !== 'paid') throw new Error('expected paid');
    expect(result.claimToken).toEqual(expect.any(String));
    const profile = await repo.profileByEmail('buyer@test.com');
    expect(profile?.id).toBe(result.profileId);
    expect((await repo.grantsForOrder(order.id)).map((g) => g.productId).toSorted()).toEqual(productIds.toSorted());
    expect(await repo.order(order.id)).toMatchObject({ status: 'paid', captureId: 'CAP-1', profileId: result.profileId, paidAt: NOW });
    expect(await repo.spaceProfiles('s1')).toEqual([{ spaceId: 's1', profileId: result.profileId, displayName: 'buyer' }]);
    expect(repo.db.claimTokens).toHaveLength(1);
    expect(repo.db.claimTokens[0].tokenHash).not.toBe(result.claimToken);
  });

  it('adds the purchase to an existing account without a claim link', async () => {
    const existing = await repo.createProfile('buyer@test.com');
    const result = await fulfilOrder(repo, await newOrder(), capture(), NOW);
    expect(result).toMatchObject({ status: 'paid', profileId: existing.id, newAccount: false, claimToken: null });
    expect(repo.db.claimTokens).toHaveLength(0);
  });

  it('grants the bump offer products too, a shared product once (G23)', async () => {
    const bump = await repo.createOffer({ spaceId: 's1', slug: 'extra', title: 'Extra', priceCents: 900, currency: 'EUR' });
    const c = await repo.createProduct({ spaceId: 's1', kind: 'program', slug: 'c', title: 'C' });
    await repo.setOfferItems(bump.id, [productIds[0], c.id].map((productId) => ({ productId, accessGroupId: null })));
    const order = await newOrder({ bumpOfferId: bump.id, bumpCents: 900, amountCents: 5800 });
    await fulfilOrder(repo, order, capture({ amountCents: 5800 }), NOW);
    expect((await repo.grantsForOrder(order.id)).map((g) => g.productId).toSorted()).toEqual([...productIds, c.id].toSorted());
  });

  it('skips products the buyer already has', async () => {
    const existing = await repo.createProfile('buyer@test.com');
    await repo.createGrant({ productId: productIds[0], profileId: existing.id, source: 'manual' });
    const order = await newOrder();
    await fulfilOrder(repo, order, capture(), NOW);
    expect((await repo.grantsForOrder(order.id)).map((g) => g.productId)).toEqual([productIds[1]]);
  });

  it('grants the offer\'s access group even when the buyer already has the default one', async () => {
    const existing = await repo.createProfile('buyer@test.com');
    await repo.createGrant({ productId: productIds[1], profileId: existing.id, source: 'manual' });
    const vip = await repo.createAccessGroup({ communityId: productIds[1], title: 'VIP' });
    await repo.setOfferItems(offer.id, [{ productId: productIds[1], accessGroupId: vip.id }]);
    const order = await newOrder();
    await fulfilOrder(repo, order, capture(), NOW);
    expect((await repo.grantsForOrder(order.id)).map((g) => g.accessGroupId)).toEqual([vip.id]);
  });

  it('is idempotent: a second fulfilment changes nothing', async () => {
    const order = await newOrder();
    await fulfilOrder(repo, order, capture(), NOW);
    const again = await fulfilOrder(repo, (await repo.order(order.id))!, capture(), NOW);
    expect(again).toMatchObject({ status: 'paid', newAccount: false, claimToken: null });
    expect(await repo.grantsForOrder(order.id)).toHaveLength(2);
  });

  it('records a pending capture without granting access', async () => {
    const order = await newOrder();
    expect(await fulfilOrder(repo, order, capture({ status: 'PENDING' }), NOW)).toEqual({ status: 'pending', orderId: order.id });
    expect(await repo.order(order.id)).toMatchObject({ status: 'created', captureId: 'CAP-1' });
    expect(await repo.grantsForOrder(order.id)).toEqual([]);
  });

  it('refuses a capture whose amount or currency differs from the order', async () => {
    const order = await newOrder();
    await expect(fulfilOrder(repo, order, capture({ amountCents: 100 }), NOW)).rejects.toThrow(/amount/);
    await expect(fulfilOrder(repo, order, capture({ currency: 'USD' }), NOW)).rejects.toThrow(/amount/);
    await expect(fulfilOrder(repo, order, capture({ status: 'DECLINED' }), NOW)).rejects.toThrow(/DECLINED/);
    expect(await repo.grantsForOrder(order.id)).toEqual([]);
  });

  it('fulfils a free order without a capture', async () => {
    const order = await newOrder({ provider: 'free', amountCents: 0 });
    expect(await fulfilOrder(repo, order, null, NOW)).toMatchObject({ status: 'paid' });
    expect(await repo.order(order.id)).toMatchObject({ status: 'paid', captureId: null });
  });

  it('stores marketing consent from checkout on the contact', async () => {
    await fulfilOrder(repo, await newOrder({ marketingConsent: true }), capture(), NOW);
    expect(await repo.contacts('s1')).toEqual([
      expect.objectContaining({ email: 'buyer@test.com', marketingConsent: true, consentSource: 'checkout', consentAt: NOW }),
    ]);
  });
});

describe('applyProviderEvent', () => {
  let provider: FakeProvider;
  beforeEach(() => {
    provider = createFakeProvider();
  });

  const paidOrder = async () => {
    const providerOrderId = await provider.createOrder({ lines: [{ name: "x", amountCents: 4900 }], discountCents: 0, currency: 'EUR', description: 'x', referenceId: 'o', requestId: 'r' });
    const order = await newOrder({ providerOrderId });
    const cap = await provider.captureOrder(providerOrderId, 'r');
    await fulfilOrder(repo, order, cap, NOW);
    return { order, cap };
  };

  it('fulfils on a completed-capture webhook (buyer closed the tab)', async () => {
    const order = await newOrder();
    const result = await applyProviderEvent(repo, provider, 's1', { kind: 'capture.completed', providerOrderId: 'PO-1', capture: capture() }, NOW);
    expect(result).toBe('fulfilled');
    expect((await repo.order(order.id))?.status).toBe('paid');
  });

  it('revokes the order grants on a full refund, keeps them on a partial one', async () => {
    const { order, cap } = await paidOrder();
    provider.setCaptureStatus(cap.captureId, 'PARTIALLY_REFUNDED');
    expect(await applyProviderEvent(repo, provider, 's1', { kind: 'capture.changed', captureId: cap.captureId }, NOW)).toBe('partially_refunded');
    expect((await repo.grantsForOrder(order.id)).every((g) => g.status === 'active')).toBe(true);
    provider.setCaptureStatus(cap.captureId, 'REFUNDED');
    expect(await applyProviderEvent(repo, provider, 's1', { kind: 'capture.changed', captureId: cap.captureId }, NOW)).toBe('refunded');
    expect((await repo.order(order.id))?.status).toBe('refunded');
    expect((await repo.grantsForOrder(order.id)).every((g) => g.status === 'revoked')).toBe(true);
  });

  it('ignores orders of other spaces, unknown orders and ignored events', async () => {
    const { cap } = await paidOrder();
    expect(await applyProviderEvent(repo, provider, 's2', { kind: 'capture.changed', captureId: cap.captureId }, NOW)).toBe('unknown_order');
    expect(await applyProviderEvent(repo, provider, 's1', { kind: 'capture.changed', captureId: 'nope' }, NOW)).toBe('unknown_order');
    expect(await applyProviderEvent(repo, provider, 's1', { kind: 'ignored' }, NOW)).toBe('ignored');
  });
});
