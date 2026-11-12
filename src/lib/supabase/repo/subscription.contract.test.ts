// Subscription Supabase repo against the linked project (G5). Service client: RLS is covered by
// supabase/tests/220-subscriptions.test.sql; this checks queries, mapping, the RPC and constraint mapping.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OFFER_HAS_SUBSCRIPTIONS, OFFER_TERMS, SUBSCRIPTION_ID_TAKEN } from '@/lib/data/errors';
import type { NewSubscription } from '@/lib/data/repo';
import type { Offer } from '@/lib/data/types';
import { createCommerceRepo, type CommerceRepo } from './commerce';
import { createCoreRepo } from './core';
import { createSubscriptionRepo, type SubscriptionRepo } from './subscription';
import { contractEnabled, createContractSpace, type ContractSpace } from './testing/contractSpace';

const T0 = new Date('2026-01-31T00:00:00Z');

describe.skipIf(!contractEnabled)('subscription repo (Supabase contract)', () => {
  let fx: ContractSpace;
  let repo: SubscriptionRepo;
  let commerce: CommerceRepo;
  let core: ReturnType<typeof createCoreRepo>;
  let plan: Offer;

  const newSub = (over: Partial<NewSubscription> = {}): NewSubscription => ({
    spaceId: fx.spaceId,
    offerId: plan.id,
    email: fx.email('buyer'),
    kind: 'payment_plan',
    provider: 'fake',
    providerSubscriptionId: `${fx.slug}-I-1`,
    amountCents: 5000,
    currency: 'EUR',
    billingInterval: 'month',
    trialDays: null,
    installments: 2,
    livemode: false,
    waiverVersion: 'v1',
    waiverAcceptedAt: T0,
    marketingConsent: false,
    ...over,
  });

  beforeAll(async () => {
    fx = await createContractSpace('subscription');
    const ctx = { db: async () => fx.admin, admin: () => fx.admin };
    repo = createSubscriptionRepo(ctx);
    commerce = createCommerceRepo(ctx);
    core = createCoreRepo(ctx);
    const o = await commerce.createOffer({
      spaceId: fx.spaceId,
      slug: 'plan',
      title: 'Plan',
      priceCents: 5000,
      currency: 'EUR',
    });
    plan = await commerce.updateOffer(o.id, {
      kind: 'payment_plan',
      billingInterval: 'month',
      installments: 2,
    });
  });
  afterAll(async () => {
    await fx?.cleanup();
  });

  it('maps offer price types and their constraint errors', async () => {
    expect(plan).toMatchObject({
      kind: 'payment_plan',
      billingInterval: 'month',
      trialDays: null,
      installments: 2,
    });
    await expect(commerce.updateOffer(plan.id, { installments: 25 })).rejects.toThrow(OFFER_TERMS);
  });

  it('creates, finds, updates, records payments once and completes the plan', async () => {
    const s = await repo.createSubscription(newSub());
    expect(s).toMatchObject({
      status: 'pending',
      profileId: null,
      paymentsMade: 0,
      currentPeriodEnd: null,
      installments: 2,
    });
    await expect(repo.createSubscription(newSub())).rejects.toThrow(SUBSCRIPTION_ID_TAKEN);
    expect((await repo.subscriptionByProviderId('fake', s.providerSubscriptionId))?.id).toBe(s.id);

    const buyer = await fx.newUser('buyer');
    await repo.updateSubscription(s.id, {
      profileId: buyer,
      status: 'past_due',
    });
    expect(
      await repo.recordSubscriptionPayment({
        subscriptionId: s.id,
        saleId: `${fx.slug}-S1`,
        amountCents: 5000,
        paidAt: T0,
      }),
    ).toBe(true);
    expect(
      await repo.recordSubscriptionPayment({
        subscriptionId: s.id,
        saleId: `${fx.slug}-S1`,
        amountCents: 5000,
        paidAt: T0,
      }),
    ).toBe(false);
    expect(await repo.subscription(s.id)).toMatchObject({
      status: 'active',
      paymentsMade: 1,
      currentPeriodEnd: new Date('2026-02-28T00:00:00Z'),
    });
    await repo.recordSubscriptionPayment({
      subscriptionId: s.id,
      saleId: `${fx.slug}-S2`,
      amountCents: 5000,
      paidAt: new Date('2026-02-28T00:00:00Z'),
    });
    expect((await repo.subscription(s.id))?.status).toBe('completed');
    expect((await repo.subscriptionsForProfile(fx.spaceId, buyer)).map((x) => x.id)).toEqual([s.id]);
    expect((await repo.subscriptions(fx.spaceId)).map((x) => x.id)).toEqual([s.id]);

    expect((await repo.refundSubscriptionPayment('fake', `${fx.slug}-S1`))?.status).toBe('refunded');
    expect(await repo.refundSubscriptionPayment('fake', `${fx.slug}-none`)).toBeNull();
    expect((await repo.subscriptionPayments(s.id)).map((p) => [p.saleId, p.status])).toEqual([
      [`${fx.slug}-S1`, 'refunded'],
      [`${fx.slug}-S2`, 'paid'],
    ]);

    const product = await core.createProduct({
      spaceId: fx.spaceId,
      kind: 'program',
      slug: 'sub-p',
      title: 'P',
    });
    const g = await core.createGrant({
      productId: product.id,
      profileId: buyer,
      source: 'purchase',
      subscriptionId: s.id,
    });
    await core.setGrantExpiry(g.id, T0);
    expect(await core.grantsForSubscription(s.id)).toEqual([
      expect.objectContaining({
        id: g.id,
        subscriptionId: s.id,
        expiresAt: T0,
      }),
    ]);

    await expect(commerce.deleteOffer(plan.id)).rejects.toThrow(OFFER_HAS_SUBSCRIPTIONS);
  });

  it('caches provider plans per offer, env and terms', async () => {
    expect(await repo.providerPlan(plan.id, 'fake', false, 'k1')).toBeNull();
    const row = {
      spaceId: fx.spaceId,
      offerId: plan.id,
      provider: 'fake' as const,
      livemode: false,
      termsKey: 'k1',
      planId: 'P-1',
    };
    await repo.saveProviderPlan(row);
    await repo.saveProviderPlan({ ...row, planId: 'P-2' });
    expect(await repo.providerPlan(plan.id, 'fake', false, 'k1')).toBe('P-2');
    expect(await repo.providerPlan(plan.id, 'fake', true, 'k1')).toBeNull();
  });
});
