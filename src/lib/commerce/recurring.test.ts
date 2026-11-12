import { describe, expect, it } from 'vitest';
import { addInterval, addTrial, priceTermsLabel, recurringTermsError, recurringTermsKey } from './recurring';

const sub = {
  kind: 'subscription' as const,
  priceCents: 1500,
  currency: 'EUR' as const,
  billingInterval: 'month' as const,
  trialDays: null,
  installments: null,
};
const plan = { ...sub, kind: 'payment_plan' as const, installments: 3 };

describe('recurringTermsError', () => {
  it('accepts a one-time offer with no recurring terms', () => {
    expect(recurringTermsError({ ...sub, kind: 'one_time', billingInterval: null })).toBeNull();
  });

  it('refuses recurring terms on a one-time offer', () => {
    expect(recurringTermsError({ ...sub, kind: 'one_time' })).toBe('terms');
  });

  it('accepts a subscription with an interval and optional trial', () => {
    expect(recurringTermsError(sub)).toBeNull();
    expect(recurringTermsError({ ...sub, trialDays: 14 })).toBeNull();
  });

  it('refuses a free or interval-less subscription', () => {
    expect(recurringTermsError({ ...sub, priceCents: 0 })).toBe('price');
    expect(recurringTermsError({ ...sub, billingInterval: null })).toBe('terms');
  });

  it('refuses a trial outside 1-365 days', () => {
    expect(recurringTermsError({ ...sub, trialDays: 0 })).toBe('trial');
    expect(recurringTermsError({ ...sub, trialDays: 366 })).toBe('trial');
  });

  it('holds payment plans to Kajabi installment limits per interval', () => {
    expect(recurringTermsError(plan)).toBeNull();
    expect(recurringTermsError({ ...plan, installments: 1 })).toBe('installments');
    expect(recurringTermsError({ ...plan, installments: 25 })).toBe('installments');
    expect(
      recurringTermsError({
        ...plan,
        billingInterval: 'week',
        installments: 104,
      }),
    ).toBeNull();
    expect(
      recurringTermsError({
        ...plan,
        billingInterval: 'year',
        installments: 6,
      }),
    ).toBe('installments');
  });

  it('refuses a trial on a payment plan and installments on a subscription', () => {
    expect(recurringTermsError({ ...plan, trialDays: 7 })).toBe('terms');
    expect(recurringTermsError({ ...sub, installments: 3 })).toBe('terms');
  });
});

describe('addInterval / addTrial', () => {
  const t = new Date('2026-01-31T10:00:00Z');
  it('adds one billing interval in UTC, clamping to month end like Postgres', () => {
    expect(addInterval(t, 'week').toISOString()).toBe('2026-02-07T10:00:00.000Z');
    expect(addInterval(t, 'month').toISOString()).toBe('2026-02-28T10:00:00.000Z');
    expect(addInterval(t, 'year').toISOString()).toBe('2027-01-31T10:00:00.000Z');
  });
  it('adds trial days', () => {
    expect(addTrial(t, 14).toISOString()).toBe('2026-02-14T10:00:00.000Z');
  });
});

describe('recurringTermsKey', () => {
  it('changes when any billed term changes', () => {
    expect(recurringTermsKey(sub)).toBe('subscription:1500:EUR:month:0:0');
    expect(recurringTermsKey({ ...sub, trialDays: 7 })).not.toBe(recurringTermsKey(sub));
    expect(recurringTermsKey(plan)).toBe('payment_plan:1500:EUR:month:0:3');
  });
});

describe('priceTermsLabel', () => {
  it('describes each price type like the Kajabi checkout', () => {
    expect(priceTermsLabel({ ...sub, kind: 'one_time', billingInterval: null }, 'en')).toBe('€15.00');
    expect(priceTermsLabel({ ...sub, kind: 'one_time', billingInterval: null, priceCents: 0 }, 'en')).toBe('Free');
    expect(priceTermsLabel(sub, 'en')).toBe('€15.00 per month');
    expect(priceTermsLabel({ ...sub, trialDays: 7 }, 'en')).toBe('7-day free trial, then €15.00 per month');
    expect(priceTermsLabel({ ...plan, billingInterval: 'week' }, 'en')).toBe('3 weekly payments of €15.00');
  });
});
