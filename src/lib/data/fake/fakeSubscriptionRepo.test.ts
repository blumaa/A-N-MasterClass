import { beforeEach, describe, expect, it } from 'vitest';
import { OFFER_HAS_SUBSCRIPTIONS, OFFER_TERMS, OFFER_TRIAL_DAYS, SUBSCRIPTION_ID_TAKEN } from '../errors';
import type { NewSubscription } from '../repo';
import type { Offer } from '../types';
import { emptyDb } from './db';
import { createFakeRepo, type FakeRepo } from './fakeRepo';

const NOW = new Date('2026-11-10T12:00:00Z');

let repo: FakeRepo;
let plan: Offer;

beforeEach(async () => {
  repo = createFakeRepo(emptyDb());
  repo.db.spaces.push({
    id: 's1',
    slug: 'alexander',
    name: 'Alexander',
    status: 'live',
    locale: 'en',
    isTest: false,
  });
  const o = await repo.createOffer({
    spaceId: 's1',
    slug: 'plan',
    title: 'Plan',
    priceCents: 5000,
    currency: 'EUR',
  });
  plan = await repo.updateOffer(o.id, {
    kind: 'payment_plan',
    billingInterval: 'month',
    installments: 3,
  });
});

const newSub = (over: Partial<NewSubscription> = {}): NewSubscription => ({
  spaceId: 's1',
  offerId: plan.id,
  email: 'buyer@test',
  kind: 'payment_plan',
  provider: 'fake',
  providerSubscriptionId: 'I-1',
  amountCents: 5000,
  currency: 'EUR',
  billingInterval: 'month',
  trialDays: null,
  installments: 3,
  livemode: false,
  waiverVersion: 'v1',
  waiverAcceptedAt: NOW,
  marketingConsent: false,
  ...over,
});

describe('offer price types', () => {
  it('refuses invalid recurring terms like offers_recurring_terms', async () => {
    await expect(repo.updateOffer(plan.id, { installments: 25 })).rejects.toThrow(OFFER_TERMS);
    await expect(repo.updateOffer(plan.id, { priceCents: 0 })).rejects.toThrow(OFFER_TERMS);
    await expect(
      repo.updateOffer(plan.id, {
        kind: 'subscription',
        installments: null,
        trialDays: 400,
      }),
    ).rejects.toThrow(OFFER_TRIAL_DAYS);
  });

  it('refuses deleting an offer with subscriptions', async () => {
    await repo.createSubscription(newSub());
    await expect(repo.deleteOffer(plan.id)).rejects.toThrow(OFFER_HAS_SUBSCRIPTIONS);
  });
});

describe('subscriptions', () => {
  it('creates pending with no buyer and finds by provider id', async () => {
    const s = await repo.createSubscription(newSub());
    expect(s).toMatchObject({
      status: 'pending',
      profileId: null,
      paymentsMade: 0,
      currentPeriodEnd: null,
    });
    expect((await repo.subscriptionByProviderId('fake', 'I-1'))?.id).toBe(s.id);
    expect(await repo.subscriptionByProviderId('paypal', 'I-1')).toBeNull();
    await expect(repo.createSubscription(newSub())).rejects.toThrow(SUBSCRIPTION_ID_TAKEN);
  });

  it('lists per space and per buyer, newest first', async () => {
    const a = await repo.createSubscription(newSub());
    const b = await repo.createSubscription(newSub({ providerSubscriptionId: 'I-2' }));
    await repo.updateSubscription(b.id, { profileId: 'p1', status: 'active' });
    expect((await repo.subscriptions('s1')).map((s) => s.id)).toEqual([b.id, a.id]);
    expect((await repo.subscriptionsForProfile('s1', 'p1')).map((s) => s.id)).toEqual([b.id]);
  });

  it('records a payment once per sale, clears past_due and completes the plan', async () => {
    const s = await repo.createSubscription(newSub());
    await repo.updateSubscription(s.id, {
      profileId: 'p1',
      status: 'past_due',
    });
    const pay = (saleId: string, paidAt: Date) =>
      repo.recordSubscriptionPayment({
        subscriptionId: s.id,
        saleId,
        amountCents: 5000,
        paidAt,
      });
    expect(await pay('S1', new Date('2026-01-31T00:00:00Z'))).toBe(true);
    expect(await pay('S1', new Date('2026-01-31T00:00:00Z'))).toBe(false);
    expect(await repo.subscription(s.id)).toMatchObject({
      status: 'active',
      paymentsMade: 1,
      currentPeriodEnd: new Date('2026-02-28T00:00:00Z'),
    });
    await pay('S2', new Date('2026-02-28T00:00:00Z'));
    await pay('S3', new Date('2026-03-28T00:00:00Z'));
    expect((await repo.subscription(s.id))?.status).toBe('completed');
    expect((await repo.subscriptionPayments(s.id)).map((p) => p.saleId)).toEqual(['S1', 'S2', 'S3']);
  });

  it('marks a refunded sale', async () => {
    const s = await repo.createSubscription(newSub());
    await repo.updateSubscription(s.id, { profileId: 'p1', status: 'active' });
    await repo.recordSubscriptionPayment({
      subscriptionId: s.id,
      saleId: 'S1',
      amountCents: 5000,
      paidAt: NOW,
    });
    expect((await repo.refundSubscriptionPayment('fake', 'S1'))?.status).toBe('refunded');
    expect(await repo.refundSubscriptionPayment('fake', 'nope')).toBeNull();
  });

  it('caches provider plans per terms', async () => {
    expect(await repo.providerPlan(plan.id, 'fake', false, 'k1')).toBeNull();
    await repo.saveProviderPlan({
      spaceId: 's1',
      offerId: plan.id,
      provider: 'fake',
      livemode: false,
      termsKey: 'k1',
      planId: 'P-1',
    });
    expect(await repo.providerPlan(plan.id, 'fake', false, 'k1')).toBe('P-1');
    expect(await repo.providerPlan(plan.id, 'fake', true, 'k1')).toBeNull();
  });
});

describe('grants of a subscription', () => {
  it('lists them and sets their expiry', async () => {
    repo.db.products.push({
      id: 'prod',
      spaceId: 's1',
    } as (typeof repo.db.products)[number]);
    const s = await repo.createSubscription(newSub());
    const g = await repo.createGrant({
      productId: 'prod',
      profileId: 'p1',
      source: 'purchase',
      subscriptionId: s.id,
    });
    await repo.setGrantExpiry(g.id, NOW);
    expect(await repo.grantsForSubscription(s.id)).toEqual([expect.objectContaining({ id: g.id, expiresAt: NOW })]);
  });
});
