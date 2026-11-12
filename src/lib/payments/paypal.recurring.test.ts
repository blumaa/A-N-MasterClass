// PayPal Subscriptions v1 + Catalog Products v1 adapter calls and recurring webhook events (G5).
// https://developer.paypal.com/docs/api/subscriptions/v1/
// https://developer.paypal.com/api/rest/webhooks/event-names/
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RecurringTerms } from '@/lib/commerce/recurring';
import { createPayPalProvider } from './paypal';

type Call = { url: string; init: RequestInit };

let calls: Call[];
let replies: Response[];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const fakeFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
  calls.push({ url: String(url), init: init ?? {} });
  const reply = replies.shift();
  if (!reply) throw new Error(`unexpected fetch ${String(url)}`);
  return reply;
});

const provider = () =>
  createPayPalProvider(
    { clientId: 'cid', secret: 'sec', env: 'sandbox', webhookId: 'WH-1' },
    fakeFetch as typeof fetch,
  );

const token = () => json({ access_token: 'tok', expires_in: 32400 });
const header = (c: Call, name: string) => new Headers(c.init.headers).get(name);
const body = (c: Call) => JSON.parse(String(c.init.body));

const monthly: RecurringTerms = {
  kind: 'subscription',
  priceCents: 1500,
  currency: 'EUR',
  billingInterval: 'month',
  trialDays: 7,
  installments: null,
};

beforeEach(() => {
  calls = [];
  replies = [];
  fakeFetch.mockClear();
});

describe('PayPal recurring adapter', () => {
  it('creates a catalog product, then a plan with a free trial cycle and an endless regular cycle', async () => {
    replies.push(token(), json({ id: 'PROD-1' }, 201), json({ id: 'P-1', status: 'ACTIVE' }, 201));
    expect(await provider().createPlan({ name: 'Monthly', terms: monthly, requestId: 'req-1' })).toBe('P-1');
    const [, product, plan] = calls;
    expect(product.url).toBe('https://api-m.sandbox.paypal.com/v1/catalogs/products');
    expect(body(product)).toEqual({ name: 'Monthly', type: 'DIGITAL' });
    expect(header(product, 'PayPal-Request-Id')).toBe('req-1-product');
    expect(plan.url).toBe('https://api-m.sandbox.paypal.com/v1/billing/plans');
    expect(header(plan, 'PayPal-Request-Id')).toBe('req-1-plan');
    expect(body(plan)).toEqual({
      product_id: 'PROD-1',
      name: 'Monthly',
      status: 'ACTIVE',
      billing_cycles: [
        { frequency: { interval_unit: 'DAY', interval_count: 7 }, tenure_type: 'TRIAL', sequence: 1, total_cycles: 1 },
        {
          frequency: { interval_unit: 'MONTH', interval_count: 1 },
          tenure_type: 'REGULAR',
          sequence: 2,
          total_cycles: 0,
          pricing_scheme: { fixed_price: { value: '15.00', currency_code: 'EUR' } },
        },
      ],
      payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 3 },
    });
  });

  it('gives a payment plan a fixed number of regular cycles and no trial', async () => {
    replies.push(token(), json({ id: 'PROD-1' }, 201), json({ id: 'P-2' }, 201));
    const terms: RecurringTerms = {
      ...monthly,
      kind: 'payment_plan',
      trialDays: null,
      installments: 3,
      billingInterval: 'week',
    };
    await provider().createPlan({ name: 'Plan', terms, requestId: 'r' });
    expect(body(calls[2]).billing_cycles).toEqual([
      {
        frequency: { interval_unit: 'WEEK', interval_count: 1 },
        tenure_type: 'REGULAR',
        sequence: 1,
        total_cycles: 3,
        pricing_scheme: { fixed_price: { value: '15.00', currency_code: 'EUR' } },
      },
    ]);
  });

  it('creates a subscription on a plan with our custom id', async () => {
    replies.push(token(), json({ id: 'I-1', status: 'APPROVAL_PENDING' }, 201));
    expect(await provider().createSubscription({ planId: 'P-1', customId: 'offer-1', requestId: 'r' })).toBe('I-1');
    expect(calls[1].url).toBe('https://api-m.sandbox.paypal.com/v1/billing/subscriptions');
    expect(body(calls[1])).toEqual({ plan_id: 'P-1', custom_id: 'offer-1' });
    expect(header(calls[1], 'PayPal-Request-Id')).toBe('r');
  });

  it('reads a subscription status and refuses an unknown one', async () => {
    replies.push(token(), json({ id: 'I-1', status: 'ACTIVE' }), json({ id: 'I-1', status: 'WEIRD' }));
    const p = provider();
    expect(await p.subscriptionStatus('I-1')).toBe('ACTIVE');
    expect(calls[1].url).toBe('https://api-m.sandbox.paypal.com/v1/billing/subscriptions/I-1');
    await expect(p.subscriptionStatus('I-1')).rejects.toThrow(/UNKNOWN_SUBSCRIPTION_STATUS/);
  });

  it('cancels a subscription; PayPal answers 204 with no body', async () => {
    replies.push(token(), new Response(null, { status: 204 }));
    await provider().cancelSubscription('I-1', 'Cancelled by the member');
    expect(calls[1].url).toBe('https://api-m.sandbox.paypal.com/v1/billing/subscriptions/I-1/cancel');
    expect(calls[1].init.method).toBe('POST');
    expect(body(calls[1])).toEqual({ reason: 'Cancelled by the member' });
  });

  it('parses subscription state events to the subscription id', () => {
    const event = (type: string) => JSON.stringify({ event_type: type, resource: { id: 'I-1', status: 'ACTIVE' } });
    for (const type of ['ACTIVATED', 'CANCELLED', 'SUSPENDED', 'EXPIRED']) {
      expect(provider().parseEvent(event(`BILLING.SUBSCRIPTION.${type}`))).toEqual({
        kind: 'subscription.changed',
        subscriptionId: 'I-1',
      });
    }
    expect(provider().parseEvent(event('BILLING.SUBSCRIPTION.PAYMENT.FAILED'))).toEqual({
      kind: 'subscription.payment_failed',
      subscriptionId: 'I-1',
    });
  });

  it('parses a completed sale of a subscription', () => {
    const raw = JSON.stringify({
      event_type: 'PAYMENT.SALE.COMPLETED',
      resource: {
        id: 'SALE-1',
        state: 'completed',
        amount: { total: '15.00', currency: 'EUR' },
        billing_agreement_id: 'I-1',
        create_time: '2026-11-12T10:00:00Z',
      },
    });
    expect(provider().parseEvent(raw)).toEqual({
      kind: 'subscription.paid',
      subscriptionId: 'I-1',
      saleId: 'SALE-1',
      amountCents: 1500,
      currency: 'EUR',
      paidAt: new Date('2026-11-12T10:00:00Z'),
    });
  });

  it('ignores a sale outside a subscription and parses a sale refund', () => {
    const sale = JSON.stringify({
      event_type: 'PAYMENT.SALE.COMPLETED',
      resource: { id: 'SALE-1', amount: { total: '15.00', currency: 'EUR' } },
    });
    expect(provider().parseEvent(sale)).toEqual({ kind: 'ignored' });
    const refund = JSON.stringify({
      event_type: 'PAYMENT.SALE.REFUNDED',
      resource: { id: 'REF-1', sale_id: 'SALE-1' },
    });
    expect(provider().parseEvent(refund)).toEqual({ kind: 'sale.refunded', saleId: 'SALE-1' });
  });
});
