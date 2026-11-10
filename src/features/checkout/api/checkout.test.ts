import { beforeEach, describe, expect, it } from 'vitest';
import { emptyDb } from '@/lib/data/fake/db';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import type { Offer } from '@/lib/data/types';
import { createFakeProvider, type FakeProvider } from '@/lib/payments/fake';
import { checkoutOffer, completeCheckout, startCheckout, type CheckoutDeps, type CheckoutInput } from './checkout';

const NOW = new Date('2026-11-10T12:00:00Z');

let repo: FakeRepo;
let provider: FakeProvider;
let offer: Offer;
let ready: CheckoutDeps;

beforeEach(async () => {
  repo = createFakeRepo(emptyDb());
  repo.db.spaces.push({ id: 's1', slug: 'alexander', name: 'Alexander', status: 'live', locale: 'en' });
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
