import { beforeEach, describe, expect, it } from 'vitest';
import { emptyDb } from '@/lib/data/fake/db';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import type { Offer } from '@/lib/data/types';
import { createFakeProvider, type FakeProvider } from '@/lib/payments/fake';
import { checkoutOffer, completeCheckout, previewCoupon, startCheckout, type CheckoutDeps, type CheckoutInput } from './checkout';

const NOW = new Date('2026-11-10T12:00:00Z');

let repo: FakeRepo;
let provider: FakeProvider;
let offer: Offer;
let ready: CheckoutDeps;

beforeEach(async () => {
  repo = createFakeRepo(emptyDb());
  repo.db.spaces.push({ id: 's1', slug: 'alexander', name: 'Alexander', status: 'live', locale: 'en', isTest: false });
  provider = createFakeProvider();
  ready = { env: 'sandbox', resolveProvider: async () => ({ kind: 'ready', provider, livemode: false, clientId: null }) };
  offer = await repo.createOffer({ spaceId: 's1', slug: 'full', title: 'Full', priceCents: 4900, currency: 'EUR' });
  await repo.updateOffer(offer.id, { status: 'published' });
  const p = await repo.createProduct({ spaceId: 's1', kind: 'program', slug: 'a', title: 'Shibari 101' });
  await repo.setOfferItems(offer.id, [{ productId: p.id, accessGroupId: null }]);
});

const notSetUp: CheckoutDeps = { env: 'live', resolveProvider: async () => ({ kind: 'not_set_up' }) };

const input = (extra: Partial<CheckoutInput> = {}): CheckoutInput => ({
  offerSlug: 'full',
  email: ' Buyer@Test.com ',
  waiverAccepted: true,
  marketingConsent: false,
  couponCode: '',
  withBump: false,
  ...extra,
});

describe('checkoutOffer', () => {
  it('returns a published offer with its product titles', async () => {
    expect(await checkoutOffer(repo, 's1', 'full')).toMatchObject({ title: 'Full', priceCents: 4900, products: ['Shibari 101'] });
  });

  it('hides drafts and other spaces', async () => {
    await repo.updateOffer(offer.id, { status: 'draft' });
    expect(await checkoutOffer(repo, 's1', 'full')).toBeNull();
    expect(await checkoutOffer(repo, 's2', 'full')).toBeNull();
  });
});

describe('startCheckout', () => {
  it('creates a provider order at the server-side price and stores the waiver', async () => {
    const result = await startCheckout(repo, ready, 's1', input(), NOW);
    expect(result).toEqual({ ok: true, kind: 'provider', providerOrderId: 'FAKE-ORDER-1' });
    expect(await repo.orderByProviderId('fake', 'FAKE-ORDER-1')).toMatchObject({
      email: 'buyer@test.com',
      amountCents: 4900,
      currency: 'EUR',
      status: 'created',
      livemode: false,
      waiverAcceptedAt: NOW,
    });
  });

  it('refuses a missing waiver, a bad email or an unknown offer', async () => {
    expect(await startCheckout(repo, ready, 's1', input({ waiverAccepted: false }), NOW)).toMatchObject({ ok: false, error: 'invalid' });
    expect(await startCheckout(repo, ready, 's1', input({ email: 'nope' }), NOW)).toMatchObject({ ok: false, error: 'invalid' });
    expect(await startCheckout(repo, ready, 's1', input({ offerSlug: 'gone' }), NOW)).toEqual({ ok: false, error: 'not_found' });
    expect(repo.db.orders).toEqual([]);
  });

  it('refuses when the space has no payment set up', async () => {
    const result = await startCheckout(repo, notSetUp, 's1', input(), NOW);
    expect(result).toMatchObject({ ok: false, error: 'invalid', message: expect.stringMatching(/payments/i) });
  });

  it('fulfils a free offer straight away without a provider', async () => {
    await repo.updateOffer(offer.id, { priceCents: 0 });
    const result = await startCheckout(repo, notSetUp, 's1', input(), NOW);
    expect(result).toMatchObject({ ok: true, kind: 'fulfilled', fulfilment: { status: 'paid', newAccount: true } });
    expect(repo.db.orders[0]).toMatchObject({ provider: 'free', livemode: true });
  });
});

describe('startCheckout with coupon and bump (G23)', () => {
  let bump: Offer;
  beforeEach(async () => {
    bump = await repo.createOffer({ spaceId: 's1', slug: 'extra', title: 'Extra', priceCents: 900, currency: 'EUR' });
    await repo.updateOffer(bump.id, { status: 'published' });
    await repo.updateOffer(offer.id, { bumpOfferId: bump.id });
    await repo.createCoupon({
      spaceId: 's1', code: 'TEN', percentOff: 10, amountOffCents: null, currency: null, maxUses: null,
      oncePerCustomer: false, expiresAt: null, active: true, offerIds: [offer.id],
    });
  });

  it('charges offer - discount + bump in one provider order and stores the extras', async () => {
    const result = await startCheckout(repo, ready, 's1', input({ couponCode: 'ten', withBump: true }), NOW);
    expect(result).toMatchObject({ ok: true, kind: 'provider' });
    expect(await provider.captureOrder('FAKE-ORDER-1', 'r1')).toMatchObject({ amountCents: 5310 });
    expect(repo.db.orders[0]).toMatchObject({
      amountCents: 5310,
      discountCents: 490,
      couponId: repo.db.coupons[0].id,
      bumpOfferId: bump.id,
      bumpCents: 900,
    });
  });

  it('previews a coupon discount without an email', async () => {
    expect(await previewCoupon(repo, 's1', 'full', ' ten ', NOW)).toEqual({ ok: true, code: 'TEN', discountCents: 490 });
    expect(await previewCoupon(repo, 's1', 'full', 'NOPE', NOW)).toMatchObject({ ok: false, message: expect.any(String) });
    expect(await previewCoupon(repo, 's1', 'gone', 'TEN', NOW)).toMatchObject({ ok: false });
  });

  it('refuses a bad coupon before any order exists', async () => {
    expect(await startCheckout(repo, ready, 's1', input({ couponCode: 'NOPE' }), NOW)).toMatchObject({ ok: false, error: 'invalid' });
    expect(repo.db.orders).toEqual([]);
  });

  it('fulfils a fully discounted order without a provider', async () => {
    await repo.updateCoupon(repo.db.coupons[0].id, { percentOff: 100 });
    const result = await startCheckout(repo, notSetUp, 's1', input({ couponCode: 'TEN' }), NOW);
    expect(result).toMatchObject({ ok: true, kind: 'fulfilled', fulfilment: { status: 'paid' } });
    expect(repo.db.orders[0]).toMatchObject({ provider: 'free', amountCents: 0, discountCents: 4900 });
  });
});

describe('startCheckout for a subscription (G5)', () => {
  beforeEach(async () => {
    await repo.updateOffer(offer.id, { kind: 'subscription', billingInterval: 'month', trialDays: 14 });
  });

  it('shows the billing terms', async () => {
    expect(await checkoutOffer(repo, 's1', 'full')).toMatchObject({
      kind: 'subscription',
      billingInterval: 'month',
      trialDays: 14,
      installments: null,
      bump: null,
    });
  });

  it('creates a pending provider subscription instead of an order', async () => {
    const result = await startCheckout(repo, ready, 's1', input(), NOW);
    expect(result).toMatchObject({ ok: true, kind: 'subscription', providerSubscriptionId: expect.any(String) });
    expect(repo.db.orders).toEqual([]);
    expect(repo.db.subscriptions[0]).toMatchObject({ email: 'buyer@test.com', status: 'pending', amountCents: 4900 });
  });

  it('refuses coupons and needs a provider', async () => {
    expect(await startCheckout(repo, ready, 's1', input({ couponCode: 'X' }), NOW)).toMatchObject({ ok: false, error: 'invalid' });
    expect(await startCheckout(repo, notSetUp, 's1', input(), NOW)).toMatchObject({ ok: false, error: 'invalid' });
    expect(repo.db.subscriptions).toEqual([]);
  });
});

describe('completeCheckout', () => {
  it('captures and fulfils the order once', async () => {
    await startCheckout(repo, ready, 's1', input(), NOW);
    const first = await completeCheckout(repo, provider, 's1', 'FAKE-ORDER-1', NOW);
    expect(first).toMatchObject({ ok: true, fulfilment: { status: 'paid', newAccount: true } });
    const again = await completeCheckout(repo, provider, 's1', 'FAKE-ORDER-1', NOW);
    expect(again).toMatchObject({ ok: true, fulfilment: { status: 'paid', newAccount: false, claimToken: null } });
  });

  it('refuses an unknown order or an order of another space', async () => {
    await startCheckout(repo, ready, 's1', input(), NOW);
    expect(await completeCheckout(repo, provider, 's2', 'FAKE-ORDER-1', NOW)).toEqual({ ok: false, error: 'not_found' });
    expect(await completeCheckout(repo, provider, 's1', 'nope', NOW)).toEqual({ ok: false, error: 'not_found' });
  });
});
