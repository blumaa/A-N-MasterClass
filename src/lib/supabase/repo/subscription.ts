// Supabase Repo: subscriptions and payment plans (G5). Semantics mirror
// src/lib/data/fake/fakeSubscriptionRepo.ts; rules live in 20261112180000_subscriptions.sql.
// Reads run as the caller (RLS: buyer reads own, staff read the space). Writes use admin():
// there is no browser write policy, and webhooks and guest checkouts have no session.
import type { Repo } from '@/lib/data/repo';
import { check, defined, isoOrNull, unwrap, unwrapMaybe, type RepoCtx } from './context';
import { toSubscription, toSubscriptionPayment } from './mapCommerce';

export type SubscriptionRepo = Pick<
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

export function createSubscriptionRepo({ db, admin }: RepoCtx): SubscriptionRepo {
  return {
    async subscriptions(spaceId) {
      const rows = unwrap(
        await (
          await db()
        )
          .from('subscriptions')
          .select('*')
          .eq('space_id', spaceId)
          .order('created_at', { ascending: false }),
      );
      return rows.map(toSubscription);
    },
    async subscriptionsForProfile(spaceId, profileId) {
      const rows = unwrap(
        await (
          await db()
        )
          .from('subscriptions')
          .select('*')
          .eq('space_id', spaceId)
          .eq('profile_id', profileId)
          .order('created_at', { ascending: false }),
      );
      return rows.map(toSubscription);
    },
    async subscription(id) {
      const row = unwrapMaybe(await (await db()).from('subscriptions').select('*').eq('id', id).maybeSingle());
      return row && toSubscription(row);
    },
    // Webhooks look up by provider id with no session.
    async subscriptionByProviderId(provider, providerId) {
      const row = unwrapMaybe(
        await admin()
          .from('subscriptions')
          .select('*')
          .eq('provider', provider)
          .eq('provider_subscription_id', providerId)
          .maybeSingle(),
      );
      return row && toSubscription(row);
    },
    async createSubscription(input) {
      const row = unwrap(
        await admin()
          .from('subscriptions')
          .insert({
            space_id: input.spaceId,
            offer_id: input.offerId,
            email: input.email,
            kind: input.kind,
            provider: input.provider,
            provider_subscription_id: input.providerSubscriptionId,
            amount_cents: input.amountCents,
            currency: input.currency,
            billing_interval: input.billingInterval,
            trial_days: input.trialDays,
            installments: input.installments,
            livemode: input.livemode,
            waiver_version: input.waiverVersion,
            waiver_accepted_at: input.waiverAcceptedAt.toISOString(),
            marketing_consent: input.marketingConsent,
          })
          .select('*')
          .single(),
      );
      return toSubscription(row);
    },
    async updateSubscription(id, patch) {
      const row = unwrap(
        await admin()
          .from('subscriptions')
          .update(
            defined({
              profile_id: patch.profileId,
              status: patch.status,
              current_period_end: isoOrNull(patch.currentPeriodEnd),
              ended_at: isoOrNull(patch.endedAt),
            }),
          )
          .eq('id', id)
          .select('*')
          .single(),
      );
      return toSubscription(row);
    },
    async recordSubscriptionPayment({ subscriptionId, saleId, amountCents, paidAt }) {
      return unwrap(
        await admin().rpc('record_subscription_payment', {
          target_subscription: subscriptionId,
          sale: saleId,
          amount: amountCents,
          paid: paidAt.toISOString(),
        }),
      );
    },
    async subscriptionPayments(subscriptionId) {
      const rows = unwrap(
        await (
          await db()
        )
          .from('subscription_payments')
          .select('*')
          .eq('subscription_id', subscriptionId)
          .order('paid_at'),
      );
      return rows.map(toSubscriptionPayment);
    },
    async refundSubscriptionPayment(spaceId, provider, saleId) {
      const row = unwrapMaybe(
        await admin()
          .from('subscription_payments')
          .update({ status: 'refunded' })
          .eq('space_id', spaceId)
          .eq('provider', provider)
          .eq('sale_id', saleId)
          .select('*')
          .maybeSingle(),
      );
      return row && toSubscriptionPayment(row);
    },
    async providerPlan(offerId, provider, livemode, termsKey) {
      const row = unwrapMaybe(
        await admin()
          .from('provider_plans')
          .select('plan_id')
          .eq('offer_id', offerId)
          .eq('provider', provider)
          .eq('livemode', livemode)
          .eq('terms_key', termsKey)
          .maybeSingle(),
      );
      return row?.plan_id ?? null;
    },
    async saveProviderPlan(p) {
      check(
        await admin().from('provider_plans').upsert({
          space_id: p.spaceId,
          offer_id: p.offerId,
          provider: p.provider,
          livemode: p.livemode,
          terms_key: p.termsKey,
          plan_id: p.planId,
        }),
      );
    },
  };
}
