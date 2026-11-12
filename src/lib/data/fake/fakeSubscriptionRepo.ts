// Subscription part of the fake repo (G5). Same rules as subscriptions / subscription_payments /
// provider_plans and record_subscription_payment in supabase/migrations/20261112180000_subscriptions.sql.
import { addInterval } from '@/lib/commerce/recurring';
import { ConstraintError, SUBSCRIPTION_ID_TAKEN } from '../errors';
import type { Repo } from '../repo';
import type { Subscription } from '../types';
import type { Db } from './db';

type SubscriptionRepo = Pick<
  Repo,
  | 'subscriptions'
  | 'subscriptionsForProfile'
  | 'subscription'
  | 'subscriptionByProviderId'
  | 'createSubscription'
  | 'updateSubscription'
  | 'recordSubscriptionPayment'
  | 'subscriptionPayments'
  | 'refundSubscriptionPayment'
  | 'providerPlan'
  | 'saveProviderPlan'
>;

const newestFirst = (a: Subscription, b: Subscription) => b.createdAt.getTime() - a.createdAt.getTime();

export function createFakeSubscriptionRepo(db: Db, id: (prefix: string) => string): SubscriptionRepo {
  const find = (sid: string): Subscription => {
    const row = db.subscriptions.find((s) => s.id === sid);
    if (!row) throw new Error(`subscription ${sid} not found`);
    return row;
  };
  // Distinct createdAt for stable newest-first order within one test tick.
  let tick = 0;

  return {
    subscriptions: async (spaceId) => db.subscriptions.filter((s) => s.spaceId === spaceId).toSorted(newestFirst),
    subscriptionsForProfile: async (spaceId, profileId) =>
      db.subscriptions.filter((s) => s.spaceId === spaceId && s.profileId === profileId).toSorted(newestFirst),
    subscription: async (sid) => db.subscriptions.find((s) => s.id === sid) ?? null,
    subscriptionByProviderId: async (provider, providerId) =>
      db.subscriptions.find((s) => s.provider === provider && s.providerSubscriptionId === providerId) ?? null,
    async createSubscription(input) {
      if (
        db.subscriptions.some(
          (s) => s.provider === input.provider && s.providerSubscriptionId === input.providerSubscriptionId,
        )
      ) {
        throw new ConstraintError(SUBSCRIPTION_ID_TAKEN);
      }
      const row: Subscription = {
        ...input,
        id: id('subscription'),
        profileId: null,
        status: 'pending',
        paymentsMade: 0,
        currentPeriodEnd: null,
        endedAt: null,
        createdAt: new Date(Date.now() + tick++),
      };
      db.subscriptions.push(row);
      return row;
    },
    async updateSubscription(sid, patch) {
      const row = find(sid);
      const next = { ...row, ...patch };
      if (next.status !== 'pending' && next.profileId === null)
        throw new ConstraintError('subscriptions_active_has_buyer');
      return Object.assign(row, patch);
    },
    async recordSubscriptionPayment({ subscriptionId, saleId, amountCents, paidAt }) {
      const s = find(subscriptionId);
      if (db.subscriptionPayments.some((p) => p.provider === s.provider && p.saleId === saleId)) return false;
      db.subscriptionPayments.push({
        id: id('payment'),
        subscriptionId,
        spaceId: s.spaceId,
        provider: s.provider,
        saleId,
        amountCents,
        currency: s.currency,
        status: 'paid',
        livemode: s.livemode,
        paidAt,
      });
      const paymentsMade = s.paymentsMade + 1;
      const extended = addInterval(paidAt, s.billingInterval);
      const live = s.status === 'active' || s.status === 'past_due';
      Object.assign(s, {
        paymentsMade,
        currentPeriodEnd: s.currentPeriodEnd && s.currentPeriodEnd > extended ? s.currentPeriodEnd : extended,
        status:
          live && s.kind === 'payment_plan' && s.installments !== null && paymentsMade >= s.installments
            ? 'completed'
            : s.status === 'past_due'
              ? 'active'
              : s.status,
      });
      return true;
    },
    subscriptionPayments: async (sid) =>
      db.subscriptionPayments
        .filter((p) => p.subscriptionId === sid)
        .toSorted((a, b) => a.paidAt.getTime() - b.paidAt.getTime()),
    async refundSubscriptionPayment(spaceId, provider, saleId) {
      const row = db.subscriptionPayments.find(
        (p) => p.spaceId === spaceId && p.provider === provider && p.saleId === saleId,
      );
      if (!row) return null;
      row.status = 'refunded';
      return row;
    },
    providerPlan: async (offerId, provider, livemode, termsKey) =>
      db.providerPlans.find(
        (p) => p.offerId === offerId && p.provider === provider && p.livemode === livemode && p.termsKey === termsKey,
      )?.planId ?? null,
    async saveProviderPlan(row) {
      const same = (p: typeof row) =>
        p.offerId === row.offerId &&
        p.provider === row.provider &&
        p.livemode === row.livemode &&
        p.termsKey === row.termsKey;
      db.providerPlans = [...db.providerPlans.filter((p) => !same(p)), { ...row }];
    },
  };
}
