// Recurring offer terms (G5), mirroring Kajabi:
// subscriptions https://help.kajabi.com/en/articles/12695517-how-to-create-a-subscription-offer
// payment plans https://help.kajabi.com/articles/sales/offers/create-a-payment-plan-offer
// SQL check offers_recurring_terms (20261112180000_subscriptions.sql) mirrors recurringTermsError.
import type { Currency } from './money';
import type { BillingInterval, OfferKind } from '@/lib/data/types';

/** Kajabi payment plan limits: weekly 2-104, monthly 2-24, annual 2-5 payments. */
export const INSTALLMENT_LIMITS: Record<BillingInterval, { min: number; max: number }> = {
  week: { min: 2, max: 104 },
  month: { min: 2, max: 24 },
  year: { min: 2, max: 5 },
};

export const TRIAL_DAYS_MAX = 365;

export type RecurringTerms = {
  kind: OfferKind;
  priceCents: number;
  currency: Currency;
  billingInterval: BillingInterval | null;
  trialDays: number | null;
  installments: number | null;
};

export type TermsError = 'terms' | 'price' | 'trial' | 'installments';

/** null = valid. One-time offers carry no recurring terms; recurring offers are never free. */
export function recurringTermsError(t: RecurringTerms): TermsError | null {
  if (t.kind === 'one_time') {
    return t.billingInterval === null && t.trialDays === null && t.installments === null ? null : 'terms';
  }
  if (t.billingInterval === null) return 'terms';
  if (t.priceCents <= 0) return 'price';
  if (t.kind === 'subscription') {
    if (t.installments !== null) return 'terms';
    return t.trialDays === null || (t.trialDays >= 1 && t.trialDays <= TRIAL_DAYS_MAX) ? null : 'trial';
  }
  if (t.trialDays !== null) return 'terms';
  const { min, max } = INSTALLMENT_LIMITS[t.billingInterval];
  return t.installments !== null && t.installments >= min && t.installments <= max ? null : 'installments';
}

/** One billing interval later, in UTC. Month and year clamp to the last day like Postgres intervals. */
export function addInterval(from: Date, interval: BillingInterval): Date {
  if (interval === 'week') return new Date(from.getTime() + 7 * 86_400_000);
  const months = interval === 'month' ? 1 : 12;
  const d = new Date(from);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

export const addTrial = (from: Date, days: number): Date => new Date(from.getTime() + days * 86_400_000);

/** Provider plans are fixed once created, so a cached plan is keyed by every billed term. */
export const recurringTermsKey = (t: RecurringTerms): string =>
  [t.kind, t.priceCents, t.currency, t.billingInterval, t.trialDays ?? 0, t.installments ?? 0].join(':');
