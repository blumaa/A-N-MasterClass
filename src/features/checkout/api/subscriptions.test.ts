import { beforeEach, describe, expect, it } from 'vitest';
import { emptyDb } from '@/lib/data/fake/db';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import type { Offer } from '@/lib/data/types';
import { createFakeProvider, type FakeProvider } from '@/lib/payments/fake';
import {
  activateSubscription,
  applySubscriptionEvent,
  cancelOwnSubscription,
  startSubscription,
  type RecurringOffer,
} from './subscriptions';

const NOW = new Date('2026-11-10T12:00:00Z');
const LATER = new Date('2026-11-20T12:00:00Z');

let repo: FakeRepo;
let provider: FakeProvider;
let monthly: Offer;
let plan: Offer;
let productId: string;

const recurring = (o: Offer): RecurringOffer => ({
  id: o.id,
  title: o.title,
  priceCents: o.priceCents,
  currency: o.currency,
  kind: o.kind,
  billingInterval: o.billingInterval,
  trialDays: o.trialDays,
  installments: o.installments,
});

const buyer = { email: 'buyer@test.com', marketingConsent: true };

async function start(o: Offer = monthly): Promise<string> {
  return startSubscription(repo, provider, false, 's1', recurring(o), buyer, NOW);
}

async function startActive(o: Offer = monthly) {
  const id = await start(o);
  await activateSubscription(repo, provider, 's1', id, NOW);
  return (await repo.subscriptionByProviderId('fake', id))!;
}

beforeEach(async () => {
  repo = createFakeRepo(emptyDb());
  repo.db.spaces.push({ id: 's1', slug: 'alexander', name: 'Alexander', status: 'live', locale: 'en', isTest: false });
  provider = createFakeProvider();
  const p = await repo.createProduct({ spaceId: 's1', kind: 'program', slug: 'a', title: 'Shibari 101' });
  productId = p.id;
  monthly = await repo.createOffer({ spaceId: 's1', slug: 'monthly', title: 'Monthly', priceCents: 1500, currency: 'EUR' });
  monthly = await repo.updateOffer(monthly.id, { kind: 'subscription', billingInterval: 'month', trialDays: 7 });
  plan = await repo.createOffer({ spaceId: 's1', slug: 'plan', title: 'Plan', priceCents: 5000, currency: 'EUR' });
  plan = await repo.updateOffer(plan.id, { kind: 'payment_plan', billingInterval: 'month', installments: 3 });
  await repo.setOfferItems(monthly.id, [{ productId, accessGroupId: null }]);
  await repo.setOfferItems(plan.id, [{ productId, accessGroupId: null }]);
});

describe('startSubscription', () => {
  it('creates a provider plan once per terms and a pending subscription with the offer terms', async () => {
    const first = await start();
    const second = await start();
    expect(repo.db.providerPlans).toHaveLength(1);
    expect(first).not.toBe(second);
    expect(await repo.subscriptionByProviderId('fake', first)).toMatchObject({
      spaceId: 's1',
      offerId: monthly.id,
      email: 'buyer@test.com',
      kind: 'subscription',
      status: 'pending',
      amountCents: 1500,
      billingInterval: 'month',
      trialDays: 7,
      installments: null,
      livemode: false,
      marketingConsent: true,
      waiverAcceptedAt: NOW,
    });
  });

  it('makes a new plan when the billed terms change', async () => {
    await start();
    await repo.updateOffer(monthly.id, { priceCents: 2000 });
    monthly = (await repo.offer(monthly.id))!;
    await start();
    expect(repo.db.providerPlans).toHaveLength(2);
  });
});

describe('activateSubscription', () => {
  it('gives the buyer access linked to the subscription and starts the trial period', async () => {
    const id = await start();
    const result = await activateSubscription(repo, provider, 's1', id, NOW);
    expect(result).toMatchObject({ status: 'active', newAccount: true });
    const sub = (await repo.subscriptionByProviderId('fake', id))!;
    expect(sub).toMatchObject({ status: 'active', currentPeriodEnd: new Date('2026-11-17T12:00:00Z') });
    expect(sub.profileId).toBe(result && result.status === 'active' ? result.profileId : null);
    const grants = await repo.grantsForSubscription(sub.id);
    expect(grants).toMatchObject([{ productId, status: 'active', expiresAt: null, subscriptionId: sub.id }]);
  });

  it('is idempotent and waits while the buyer has not approved', async () => {
    const id = await start();
    provider.setSubscriptionStatus(id, 'APPROVAL_PENDING');
    expect(await activateSubscription(repo, provider, 's1', id, NOW)).toMatchObject({ status: 'pending' });
    provider.setSubscriptionStatus(id, 'ACTIVE');
    await activateSubscription(repo, provider, 's1', id, NOW);
    expect(await activateSubscription(repo, provider, 's1', id, NOW)).toMatchObject({
      status: 'active',
      newAccount: false,
      claimToken: null,
    });
    expect(repo.db.grants).toHaveLength(1);
  });

  it('starts a plan without trial at one interval', async () => {
    const sub = await startActive(plan);
    expect(sub.currentPeriodEnd).toEqual(new Date('2026-12-10T12:00:00Z'));
  });

  it('ignores another space', async () => {
    const id = await start();
    expect(await activateSubscription(repo, provider, 's2', id, NOW)).toBeNull();
  });
});

describe('applySubscriptionEvent', () => {
  it('records each paid sale once and refuses a wrong amount', async () => {
    const sub = await startActive(plan);
    const paid = {
      kind: 'subscription.paid' as const,
      subscriptionId: sub.providerSubscriptionId,
      saleId: 'SALE-1',
      amountCents: 5000,
      currency: 'EUR',
      paidAt: NOW,
    };
    expect(await applySubscriptionEvent(repo, provider, 's1', paid, NOW)).toBe('recorded');
    expect(await applySubscriptionEvent(repo, provider, 's1', paid, NOW)).toBe('duplicate');
    await expect(
      applySubscriptionEvent(repo, provider, 's1', { ...paid, saleId: 'SALE-2', amountCents: 1 }, NOW),
    ).rejects.toThrow(/amount/);
    expect((await repo.subscription(sub.id))?.paymentsMade).toBe(1);
  });

  it('activates a pending subscription on its first payment', async () => {
    const id = await start(plan);
    const event = {
      kind: 'subscription.paid' as const,
      subscriptionId: id,
      saleId: 'SALE-1',
      amountCents: 5000,
      currency: 'EUR',
      paidAt: NOW,
    };
    expect(await applySubscriptionEvent(repo, provider, 's1', event, NOW)).toBe('recorded');
    expect((await repo.subscriptionByProviderId('fake', id))?.status).toBe('active');
    expect(repo.db.grants).toHaveLength(1);
  });

  it('marks a failed payment past due and keeps access', async () => {
    const sub = await startActive();
    const event = { kind: 'subscription.payment_failed' as const, subscriptionId: sub.providerSubscriptionId };
    expect(await applySubscriptionEvent(repo, provider, 's1', event, NOW)).toBe('past_due');
    expect((await repo.grantsForSubscription(sub.id))[0]).toMatchObject({ status: 'active', expiresAt: null });
  });

  it('cancelled in PayPal: access until the end of the paid period', async () => {
    const sub = await startActive();
    provider.setSubscriptionStatus(sub.providerSubscriptionId, 'CANCELLED');
    const event = { kind: 'subscription.changed' as const, subscriptionId: sub.providerSubscriptionId };
    expect(await applySubscriptionEvent(repo, provider, 's1', event, NOW)).toBe('cancelled');
    expect(await repo.subscription(sub.id)).toMatchObject({ status: 'cancelled', endedAt: sub.currentPeriodEnd });
    expect((await repo.grantsForSubscription(sub.id))[0]).toMatchObject({
      status: 'active',
      expiresAt: sub.currentPeriodEnd,
    });
  });

  it('suspended after failed retries: cancelled in PayPal and access removed now', async () => {
    const sub = await startActive();
    provider.setSubscriptionStatus(sub.providerSubscriptionId, 'SUSPENDED');
    const event = { kind: 'subscription.changed' as const, subscriptionId: sub.providerSubscriptionId };
    expect(await applySubscriptionEvent(repo, provider, 's1', event, LATER)).toBe('cancelled');
    expect(await provider.subscriptionStatus(sub.providerSubscriptionId)).toBe('CANCELLED');
    expect(await repo.subscription(sub.id)).toMatchObject({ status: 'cancelled', endedAt: LATER });
    expect((await repo.grantsForSubscription(sub.id))[0].status).toBe('revoked');
  });

  it('expired payment plan: completed, access kept', async () => {
    const sub = await startActive(plan);
    provider.setSubscriptionStatus(sub.providerSubscriptionId, 'EXPIRED');
    const event = { kind: 'subscription.changed' as const, subscriptionId: sub.providerSubscriptionId };
    expect(await applySubscriptionEvent(repo, provider, 's1', event, NOW)).toBe('completed');
    expect((await repo.grantsForSubscription(sub.id))[0]).toMatchObject({ status: 'active', expiresAt: null });
  });

  it('activates on the provider activated event', async () => {
    const id = await start();
    provider.setSubscriptionStatus(id, 'ACTIVE');
    const event = { kind: 'subscription.changed' as const, subscriptionId: id };
    expect(await applySubscriptionEvent(repo, provider, 's1', event, NOW)).toBe('active');
  });

  it('marks a refunded sale and ignores unknown subscriptions', async () => {
    const sub = await startActive(plan);
    await repo.recordSubscriptionPayment({ subscriptionId: sub.id, saleId: 'SALE-1', amountCents: 5000, paidAt: NOW });
    expect(await applySubscriptionEvent(repo, provider, 's1', { kind: 'sale.refunded', saleId: 'SALE-1' }, NOW)).toBe(
      'refunded',
    );
    expect(await applySubscriptionEvent(repo, provider, 's2', { kind: 'sale.refunded', saleId: 'SALE-1' }, NOW)).toBe(
      'unknown_sale',
    );
    const event = { kind: 'subscription.payment_failed' as const, subscriptionId: sub.providerSubscriptionId };
    expect(await applySubscriptionEvent(repo, provider, 's2', event, NOW)).toBe('unknown_subscription');
  });
});

describe('cancelOwnSubscription', () => {
  it('cancels in the provider and keeps access until the period ends', async () => {
    const sub = await startActive();
    expect(await cancelOwnSubscription(repo, provider, 's1', sub.profileId!, sub.id, NOW)).toBe('cancelled');
    expect(await provider.subscriptionStatus(sub.providerSubscriptionId)).toBe('CANCELLED');
    expect(await repo.subscription(sub.id)).toMatchObject({ status: 'cancelled', endedAt: sub.currentPeriodEnd });
  });

  it('refuses another buyer, another space and payment plans', async () => {
    const sub = await startActive();
    const own = await startActive(plan);
    expect(await cancelOwnSubscription(repo, provider, 's1', 'someone', sub.id, NOW)).toBe('not_found');
    expect(await cancelOwnSubscription(repo, provider, 's2', sub.profileId!, sub.id, NOW)).toBe('not_found');
    expect(await cancelOwnSubscription(repo, provider, 's1', own.profileId!, own.id, NOW)).toBe('not_cancellable');
    expect(await provider.subscriptionStatus(own.providerSubscriptionId)).toBe('APPROVED');
  });
});
