import { beforeEach, describe, expect, it } from 'vitest';
import { emptyDb } from '@/lib/data/fake/db';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import type { Coupon, Offer } from '@/lib/data/types';
import { checkoutBump, couponDiscount, priceCheckout } from './pricing';

const NOW = new Date('2026-11-12T12:00:00Z');

let repo: FakeRepo;
let offer: Offer;
let bump: Offer;

const coupon = (extra: Partial<Coupon> = {}): Coupon => ({
  id: 'c1',
  spaceId: 's1',
  code: 'TEN',
  percentOff: 10,
  amountOffCents: null,
  currency: null,
  maxUses: null,
  oncePerCustomer: false,
  expiresAt: null,
  active: true,
  offerIds: [offer.id],
  createdAt: NOW,
  ...extra,
});

beforeEach(async () => {
  repo = createFakeRepo(emptyDb());
  repo.db.spaces.push({ id: 's1', slug: 'alexander', name: 'Alexander', status: 'live', locale: 'en', isTest: false });
  offer = await repo.createOffer({ spaceId: 's1', slug: 'full', title: 'Full', priceCents: 4900, currency: 'EUR' });
  bump = await repo.createOffer({ spaceId: 's1', slug: 'extra', title: 'Extra', priceCents: 900, currency: 'EUR' });
  await repo.updateOffer(bump.id, { status: 'published' });
  offer = await repo.updateOffer(offer.id, { status: 'published', bumpOfferId: bump.id });
});

describe('couponDiscount', () => {
  it('takes a rounded percent of the offer price', () => {
    expect(couponDiscount(coupon({ percentOff: 15 }), offer, NOW)).toEqual({ ok: true, cents: 735 });
    expect(couponDiscount(coupon({ percentOff: 33 }), { ...offer, priceCents: 999 }, NOW)).toEqual({ ok: true, cents: 330 });
  });

  it('takes a fixed amount, at most the offer price', () => {
    const amount = coupon({ percentOff: null, amountOffCents: 1000, currency: 'EUR' });
    expect(couponDiscount(amount, offer, NOW)).toEqual({ ok: true, cents: 1000 });
    expect(couponDiscount({ ...amount, amountOffCents: 9000 }, offer, NOW)).toEqual({ ok: true, cents: 4900 });
  });

  it('refuses an inactive, expired, foreign-offer or other-currency coupon', () => {
    expect(couponDiscount(coupon({ active: false }), offer, NOW)).toMatchObject({ ok: false, message: expect.stringMatching(/not valid/) });
    expect(couponDiscount(coupon({ expiresAt: NOW }), offer, NOW)).toMatchObject({ ok: false, message: expect.stringMatching(/expired/) });
    expect(couponDiscount(coupon({ offerIds: [] }), offer, NOW)).toMatchObject({ ok: false, message: expect.stringMatching(/does not apply/) });
    const usd = coupon({ percentOff: null, amountOffCents: 100, currency: 'USD' });
    expect(couponDiscount(usd, offer, NOW)).toMatchObject({ ok: false, message: expect.stringMatching(/does not apply/) });
  });
});

describe('checkoutBump', () => {
  it('returns the published same-currency bump offer', async () => {
    expect(await checkoutBump(repo, offer)).toMatchObject({ id: bump.id, title: 'Extra', priceCents: 900 });
  });

  it('hides a draft or other-currency bump', async () => {
    await repo.updateOffer(bump.id, { status: 'draft' });
    expect(await checkoutBump(repo, offer)).toBeNull();
    await repo.updateOffer(bump.id, { status: 'published', currency: 'USD' });
    expect(await checkoutBump(repo, offer)).toBeNull();
    expect(await checkoutBump(repo, { ...offer, bumpOfferId: null })).toBeNull();
  });

  it('has no bump on a subscription or payment plan, and never offers one as a bump', async () => {
    expect(await checkoutBump(repo, { ...offer, kind: 'subscription' })).toBeNull();
    await repo.updateOffer(bump.id, { kind: 'subscription', billingInterval: 'month' });
    expect(await checkoutBump(repo, offer)).toBeNull();
  });
});

describe('priceCheckout', () => {
  const ask = async (extra: { couponCode?: string; withBump?: boolean; email?: string | null } = {}) =>
    priceCheckout(repo, 's1', { ...offer, bump: await checkoutBump(repo, offer) }, { couponCode: extra.couponCode ?? '', withBump: extra.withBump ?? false }, extra.email ?? null, NOW);

  it('is the offer price with no coupon and no bump', async () => {
    expect(await ask()).toEqual({ ok: true, quote: { lines: [{ name: 'Full', amountCents: 4900 }], discountCents: 0, totalCents: 4900, couponId: null, bump: null } });
  });

  it('adds the bump as a second line and applies the coupon to the offer only', async () => {
    await repo.createCoupon({ ...coupon(), code: 'TEN' });
    const result = await ask({ couponCode: ' ten ', withBump: true });
    expect(result).toMatchObject({
      ok: true,
      quote: {
        lines: [
          { name: 'Full', amountCents: 4900 },
          { name: 'Extra', amountCents: 900 },
        ],
        discountCents: 490,
        totalCents: 5310,
        bump: { id: bump.id, priceCents: 900 },
      },
    });
  });

  it('refuses an unknown code and ignores a bump the offer does not have', async () => {
    expect(await ask({ couponCode: 'NOPE' })).toMatchObject({ ok: false, message: expect.stringMatching(/not valid/) });
    await repo.updateOffer(offer.id, { bumpOfferId: null });
    offer = (await repo.offer(offer.id))!;
    expect(await ask({ withBump: true })).toMatchObject({ ok: true, quote: { totalCents: 4900, bump: null } });
  });

  it('refuses any coupon on a subscription or payment plan', async () => {
    await repo.createCoupon({ ...coupon(), code: 'TEN' });
    offer = { ...offer, kind: 'subscription' };
    expect(await ask({ couponCode: 'TEN' })).toMatchObject({ ok: false, message: expect.stringMatching(/subscriptions/) });
  });

  it('refuses a coupon past its limit or already used by this buyer', async () => {
    const c = await repo.createCoupon({ ...coupon(), code: 'ONCE', maxUses: 2, oncePerCustomer: true });
    const paid = async (email: string) => {
      const o = await repo.createOrder({
        spaceId: 's1', offerId: offer.id, email, provider: 'fake', providerOrderId: `p-${email}`, amountCents: 4410, currency: 'EUR',
        livemode: false, waiverVersion: 'v1', waiverAcceptedAt: NOW, marketingConsent: false, createdAt: NOW, couponId: c.id, discountCents: 490,
      });
      await repo.updateOrder(o.id, { status: 'paid', profileId: 'p', paidAt: NOW });
    };
    await paid('a@test.com');
    expect(await ask({ couponCode: 'ONCE', email: 'A@test.com' })).toMatchObject({ ok: false, message: expect.stringMatching(/already used/) });
    expect(await ask({ couponCode: 'ONCE', email: 'b@test.com' })).toMatchObject({ ok: true });
    await paid('b@test.com');
    expect(await ask({ couponCode: 'ONCE', email: 'c@test.com' })).toMatchObject({ ok: false, message: expect.stringMatching(/limit/) });
  });
});
