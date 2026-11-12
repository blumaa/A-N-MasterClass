import { beforeEach, describe, expect, it } from 'vitest';
import type { NewCoupon, NewOrder } from '../repo';
import type { Offer } from '../types';
import { emptyDb } from './db';
import { createFakeRepo, type FakeRepo } from './fakeRepo';

const NOW = new Date('2026-11-10T12:00:00Z');

let repo: FakeRepo;
let full: Offer;

beforeEach(async () => {
  repo = createFakeRepo(emptyDb());
  repo.db.spaces.push(
    { id: 's1', slug: 'alexander', name: 'Alexander', status: 'live', locale: 'en', isTest: false },
    { id: 's2', slug: 'natasha', name: 'Natasha', status: 'live', locale: 'en', isTest: false },
  );
  full = await repo.createOffer({ spaceId: 's1', slug: 'full', title: 'Full', priceCents: 4900, currency: 'EUR' });
});

const coupon = (over: Partial<NewCoupon> = {}) =>
  repo.createCoupon({
    spaceId: 's1',
    code: 'SPRING',
    percentOff: 10,
    amountOffCents: null,
    currency: null,
    maxUses: null,
    oncePerCustomer: false,
    expiresAt: null,
    active: true,
    offerIds: [full.id],
    ...over,
  });

let seq = 0;
const order = (extra: Partial<NewOrder> = {}) =>
  repo.createOrder({
    spaceId: 's1',
    offerId: full.id,
    email: 'buyer@test',
    provider: 'fake',
    providerOrderId: `po-${++seq}`,
    amountCents: 4410,
    currency: 'EUR',
    livemode: false,
    waiverVersion: 'v1',
    waiverAcceptedAt: NOW,
    marketingConsent: false,
    createdAt: NOW,
    ...extra,
  });

describe('coupons', () => {
  it('stores the code uppercase, finds it by any case, orders by code, scopes by space', async () => {
    const b = await coupon({ code: 'beta' });
    const a = await coupon({ code: 'Alpha' });
    expect(b.code).toBe('BETA');
    expect((await repo.coupons('s1')).map((c) => c.code)).toEqual(['ALPHA', 'BETA']);
    expect(await repo.couponByCode('s1', 'alpha')).toEqual(a);
    expect(await repo.couponByCode('s2', 'alpha')).toBeNull();
    expect(await repo.coupon(a.id)).toEqual(a);
  });

  it('refuses a bad or taken code, a mixed or empty discount and a zero use limit', async () => {
    await coupon();
    await expect(coupon()).rejects.toThrow(/code taken/);
    await expect(coupon({ code: 'a b' })).rejects.toThrow(/code:/);
    await expect(coupon({ code: 'OK1', percentOff: 0 })).rejects.toThrow(/percent/);
    await expect(coupon({ code: 'OK2', percentOff: 101 })).rejects.toThrow(/percent/);
    await expect(coupon({ code: 'OK3', percentOff: null })).rejects.toThrow(/percent/);
    await expect(coupon({ code: 'OK4', percentOff: 10, amountOffCents: 500, currency: 'EUR' })).rejects.toThrow(/percent/);
    await expect(coupon({ code: 'OK5', percentOff: null, amountOffCents: 500 })).rejects.toThrow(/currency/);
    await expect(coupon({ code: 'OK6', currency: 'EUR' })).rejects.toThrow(/percent/);
    await expect(coupon({ code: 'OK7', maxUses: 0 })).rejects.toThrow(/max uses/);
    expect(await coupon({ code: 'OK8', percentOff: null, amountOffCents: 500, currency: 'EUR' })).toMatchObject({ amountOffCents: 500 });
  });

  it('links only offers of its own space and replaces the set on update', async () => {
    const foreign = await repo.createOffer({ spaceId: 's2', slug: 'x', title: 'X', priceCents: 100, currency: 'EUR' });
    await expect(coupon({ offerIds: [foreign.id] })).rejects.toThrow(/offer not in coupon space/);
    const c = await coupon({ offerIds: [] });
    const updated = await repo.updateCoupon(c.id, { offerIds: [full.id], code: 'summer', active: false });
    expect(updated).toMatchObject({ code: 'SUMMER', active: false, offerIds: [full.id] });
  });

  it('counts paid uses only, per email too', async () => {
    const c = await coupon();
    const paid = await order({ couponId: c.id, discountCents: 490 });
    await repo.updateOrder(paid.id, { status: 'paid' });
    await order({ couponId: c.id, discountCents: 490, email: 'other@test' });
    expect(await repo.couponUses(c.id, 'BUYER@test')).toEqual({ total: 1, byEmail: 1 });
    expect(await repo.couponUses(c.id, 'other@test')).toEqual({ total: 1, byEmail: 0 });
  });

  it('refuses delete once used by an order, else drops it', async () => {
    const used = await coupon();
    await order({ couponId: used.id, discountCents: 490 });
    await expect(repo.deleteCoupon(used.id)).rejects.toThrow(/coupon has orders/);
    const unused = await coupon({ code: 'FREE' });
    await repo.deleteCoupon(unused.id);
    expect(await repo.coupon(unused.id)).toBeNull();
  });

  it('hasActiveCoupon: active, unexpired, linked to the offer', async () => {
    expect(await repo.hasActiveCoupon(full.id, NOW)).toBe(false);
    const c = await coupon({ active: false });
    expect(await repo.hasActiveCoupon(full.id, NOW)).toBe(false);
    await repo.updateCoupon(c.id, { active: true, expiresAt: NOW });
    expect(await repo.hasActiveCoupon(full.id, NOW)).toBe(false);
    await repo.updateCoupon(c.id, { expiresAt: new Date(NOW.getTime() + 1) });
    expect(await repo.hasActiveCoupon(full.id, NOW)).toBe(true);
  });

  it('removes an offer from coupons when the offer is deleted', async () => {
    const c = await coupon();
    await repo.deleteOffer(full.id);
    expect((await repo.coupon(c.id))?.offerIds).toEqual([]);
  });
});

describe('order extras', () => {
  it('defaults to no coupon and no bump', async () => {
    expect(await order()).toMatchObject({ couponId: null, discountCents: 0, bumpOfferId: null, bumpCents: 0 });
  });

  it('refuses a discount without a coupon and a bump price without a bump offer', async () => {
    await expect(order({ discountCents: 1 })).rejects.toThrow(/discount needs a coupon/);
    await expect(order({ bumpCents: 1 })).rejects.toThrow(/bump/);
  });

  it('refuses a coupon or bump offer of another space', async () => {
    const foreign = await repo.createOffer({ spaceId: 's2', slug: 'x', title: 'X', priceCents: 100, currency: 'EUR' });
    await expect(order({ bumpOfferId: foreign.id, bumpCents: 100 })).rejects.toThrow(/space/);
  });

  it('keeps a bump offer that has orders', async () => {
    const bump = await repo.createOffer({ spaceId: 's1', slug: 'bump', title: 'Bump', priceCents: 900, currency: 'EUR' });
    await order({ bumpOfferId: bump.id, bumpCents: 900, amountCents: 5800 });
    await expect(repo.deleteOffer(bump.id)).rejects.toThrow(/offer has orders/);
  });
});

describe('offer bump and upsell links', () => {
  it('links offers of the same space, never itself, and clears links on delete', async () => {
    const bump = await repo.createOffer({ spaceId: 's1', slug: 'bump', title: 'Bump', priceCents: 900, currency: 'EUR' });
    const foreign = await repo.createOffer({ spaceId: 's2', slug: 'x', title: 'X', priceCents: 100, currency: 'EUR' });
    expect(full).toMatchObject({ bumpOfferId: null, upsellOfferId: null });
    await expect(repo.updateOffer(full.id, { bumpOfferId: full.id })).rejects.toThrow(/itself/);
    await expect(repo.updateOffer(full.id, { upsellOfferId: full.id })).rejects.toThrow(/itself/);
    await expect(repo.updateOffer(full.id, { bumpOfferId: foreign.id })).rejects.toThrow(/space/);
    await expect(repo.updateOffer(full.id, { upsellOfferId: 'nope' })).rejects.toThrow(/space/);
    await repo.updateOffer(full.id, { bumpOfferId: bump.id, upsellOfferId: bump.id });
    await repo.deleteOffer(bump.id);
    expect(await repo.offer(full.id)).toMatchObject({ bumpOfferId: null, upsellOfferId: null });
  });
});
