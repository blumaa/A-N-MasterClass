// One row per subscription for the member account page and Studio > Customers (G5).
// Terms come from the subscription (copied at checkout), so offer edits never change them.
import type { RecurringTerms } from '@/lib/commerce/recurring';
import type { Offer, Subscription, SubscriptionStatus } from '@/lib/data/types';

export type SubscriptionRow = {
  id: string;
  email: string;
  offerTitle: string;
  terms: RecurringTerms;
  status: SubscriptionStatus;
  paymentsMade: number;
  currentPeriodEnd: Date | null;
  endedAt: Date | null;
  livemode: boolean;
  createdAt: Date;
  /** Same rule as cancelOwnSubscription: subscriptions only, while billing. */
  cancellable: boolean;
};

export function subscriptionRows(
  subs: readonly Subscription[],
  offers: readonly Pick<Offer, 'id' | 'title'>[],
): SubscriptionRow[] {
  const titles = new Map(offers.map((o) => [o.id, o.title]));
  return subs.map((s) => ({
    id: s.id,
    email: s.email,
    offerTitle: titles.get(s.offerId) ?? '',
    terms: {
      kind: s.kind,
      priceCents: s.amountCents,
      currency: s.currency,
      billingInterval: s.billingInterval,
      trialDays: s.trialDays,
      installments: s.installments,
    },
    status: s.status,
    paymentsMade: s.paymentsMade,
    currentPeriodEnd: s.currentPeriodEnd,
    endedAt: s.endedAt,
    livemode: s.livemode,
    createdAt: s.createdAt,
    cancellable: canCancel(s),
  }));
}

export function canCancel(s: Pick<Subscription, 'kind' | 'status'>): boolean {
  return s.kind === 'subscription' && (s.status === 'active' || s.status === 'past_due');
}
