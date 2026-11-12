import { describe, expect, it } from 'vitest';
import { createFakeProvider } from './fake';

describe('fake provider', () => {
  it('captures the created amount once and reports status changes', async () => {
    const p = createFakeProvider();
    const id = await p.createOrder({
      lines: [
        { name: 'Full', amountCents: 4900 },
        { name: 'Bump', amountCents: 1000 },
      ],
      discountCents: 490,
      currency: 'EUR',
      description: 'x',
      referenceId: 'o',
      requestId: 'r',
    });
    const first = await p.captureOrder(id, 'r1');
    expect(first).toMatchObject({ status: 'COMPLETED', amountCents: 5410, currency: 'EUR' });
    expect((await p.captureOrder(id, 'r2')).captureId).toBe(first.captureId);
    p.setCaptureStatus(first.captureId, 'REFUNDED');
    expect(await p.captureStatus(first.captureId)).toBe('REFUNDED');
  });

  it('refuses an unknown order and never verifies webhooks', async () => {
    const p = createFakeProvider();
    await expect(p.captureOrder('nope', 'r')).rejects.toThrow(/unknown order/);
    expect(await p.verifyWebhook(new Headers(), '{}')).toBe(false);
  });

  it('creates plans and subscriptions that start approved and can be cancelled', async () => {
    const p = createFakeProvider();
    const terms = {
      kind: 'subscription',
      priceCents: 1500,
      currency: 'EUR',
      billingInterval: 'month',
      trialDays: null,
      installments: null,
    } as const;
    const planId = await p.createPlan({ name: 'Monthly', terms, requestId: 'r' });
    expect(planId).toMatch(/^FAKE-PLAN-/);
    const subId = await p.createSubscription({ planId, customId: 'offer-1', requestId: 'r2' });
    expect(await p.subscriptionStatus(subId)).toBe('APPROVED');
    p.setSubscriptionStatus(subId, 'ACTIVE');
    expect(await p.subscriptionStatus(subId)).toBe('ACTIVE');
    await p.cancelSubscription(subId, 'member cancelled');
    expect(await p.subscriptionStatus(subId)).toBe('CANCELLED');
  });

  it('refuses an unknown plan or subscription', async () => {
    const p = createFakeProvider();
    await expect(p.createSubscription({ planId: 'nope', customId: 'o', requestId: 'r' })).rejects.toThrow(/unknown plan/);
    await expect(p.subscriptionStatus('nope')).rejects.toThrow(/unknown subscription/);
    await expect(p.cancelSubscription('nope', 'x')).rejects.toThrow(/unknown subscription/);
  });
});
