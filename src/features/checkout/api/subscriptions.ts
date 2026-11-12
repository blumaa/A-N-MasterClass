// Subscriptions and payment plans (G5), mirroring Kajabi:
// https://help.kajabi.com/en/articles/17174608-set-up-and-manage-subscriptions-with-kajabi-payments
// https://help.kajabi.com/en/articles/17175348-cancel-a-customer-s-subscription
// https://help.kajabi.com/en/articles/17174611-manage-failed-payments-with-kajabi-payments
// Grants follow the subscription: active and past_due keep access, a cancel keeps access until
// the paid period ends, a suspension (payments failed after retries) removes it now, a completed
// payment plan keeps it. Provider status is always re-read, never taken from the event body.
import { randomUUID } from 'node:crypto';
import { addInterval, addTrial, recurringTermsKey, type RecurringTerms } from '@/lib/commerce/recurring';
import { WAIVER_VERSION } from '@/lib/commerce/waiver';
import type { Repo } from '@/lib/data/repo';
import type { Offer, Subscription, SubscriptionStatus } from '@/lib/data/types';
import type { PaymentProvider, ProviderEvent } from '@/lib/payments/provider';
import { buyerProfile, finishBuyer, giveGrants } from './buyer';

export type RecurringOffer = Pick<Offer, 'id' | 'title'> & RecurringTerms;

export type ActivateResult =
  | { status: 'active'; subscriptionId: string; profileId: string; newAccount: boolean; claimToken: string | null }
  | { status: 'pending'; subscriptionId: string };

type SubscriptionEvent = Extract<
  ProviderEvent,
  { kind: 'subscription.changed' | 'subscription.payment_failed' | 'subscription.paid' | 'sale.refunded' }
>;

export type SubscriptionOutcome =
  | SubscriptionStatus
  | 'recorded'
  | 'duplicate'
  | 'refunded'
  | 'ignored'
  | 'unknown_subscription'
  | 'unknown_sale';

/** Creates (or reuses) the provider plan for the offer's terms and a pending subscription. */
export async function startSubscription(
  repo: Repo,
  provider: PaymentProvider,
  livemode: boolean,
  spaceId: string,
  offer: RecurringOffer,
  buyer: { email: string; marketingConsent: boolean },
  now: Date,
): Promise<string> {
  if (offer.kind === 'one_time' || offer.billingInterval === null) throw new Error(`offer ${offer.id} is not recurring`);
  const terms: RecurringTerms = {
    kind: offer.kind,
    priceCents: offer.priceCents,
    currency: offer.currency,
    billingInterval: offer.billingInterval,
    trialDays: offer.trialDays,
    installments: offer.installments,
  };
  const termsKey = recurringTermsKey(terms);
  let planId = await repo.providerPlan(offer.id, provider.name, livemode, termsKey);
  if (!planId) {
    planId = await provider.createPlan({ name: offer.title, terms, requestId: randomUUID() });
    await repo.saveProviderPlan({ spaceId, offerId: offer.id, provider: provider.name, livemode, termsKey, planId });
  }
  const providerSubscriptionId = await provider.createSubscription({
    planId,
    customId: offer.id,
    requestId: randomUUID(),
  });
  await repo.createSubscription({
    spaceId,
    offerId: offer.id,
    email: buyer.email,
    kind: offer.kind,
    provider: provider.name,
    providerSubscriptionId,
    amountCents: offer.priceCents,
    currency: offer.currency,
    billingInterval: offer.billingInterval,
    trialDays: offer.trialDays,
    installments: offer.installments,
    livemode,
    waiverVersion: WAIVER_VERSION,
    waiverAcceptedAt: now,
    marketingConsent: buyer.marketingConsent,
  });
  return providerSubscriptionId;
}

async function ownSubscription(
  repo: Repo,
  provider: PaymentProvider,
  spaceId: string,
  providerSubscriptionId: string,
): Promise<Subscription | null> {
  const sub = await repo.subscriptionByProviderId(provider.name, providerSubscriptionId);
  return sub && sub.spaceId === spaceId ? sub : null;
}

/** Idempotent. Gives access once the buyer approved in the provider. */
async function activate(repo: Repo, provider: PaymentProvider, sub: Subscription, now: Date): Promise<ActivateResult> {
  if (sub.status !== 'pending') {
    if (!sub.profileId) throw new Error(`subscription ${sub.id} is ${sub.status} without a buyer`);
    return { status: 'active', subscriptionId: sub.id, profileId: sub.profileId, newAccount: false, claimToken: null };
  }
  const status = await provider.subscriptionStatus(sub.providerSubscriptionId);
  if (status !== 'ACTIVE' && status !== 'APPROVED') return { status: 'pending', subscriptionId: sub.id };

  const { profileId, isNew } = await buyerProfile(repo, sub.spaceId, sub.email);
  await giveGrants(repo, profileId, [sub.offerId], { subscriptionId: sub.id }, now);
  const claimToken = await finishBuyer(
    repo,
    { spaceId: sub.spaceId, email: sub.email, marketingConsent: sub.marketingConsent, createdAt: sub.createdAt },
    profileId,
    isNew,
    now,
  );
  const currentPeriodEnd = sub.trialDays ? addTrial(now, sub.trialDays) : addInterval(now, sub.billingInterval);
  await repo.updateSubscription(sub.id, { status: 'active', profileId, currentPeriodEnd });
  return { status: 'active', subscriptionId: sub.id, profileId, newAccount: isNew, claimToken };
}

/** Called after the buyer approved in the popup; the webhook is the backup path. null = not this space's. */
export async function activateSubscription(
  repo: Repo,
  provider: PaymentProvider,
  spaceId: string,
  providerSubscriptionId: string,
  now: Date,
): Promise<ActivateResult | null> {
  const sub = await ownSubscription(repo, provider, spaceId, providerSubscriptionId);
  return sub && activate(repo, provider, sub, now);
}

/** Cancel: access until the paid period ends (Kajabi). Already ended = no-op. */
export async function endSubscription(repo: Repo, sub: Subscription, now: Date): Promise<void> {
  if (sub.status === 'cancelled' || sub.status === 'completed') return;
  const endedAt = sub.currentPeriodEnd && sub.currentPeriodEnd > now ? sub.currentPeriodEnd : now;
  await repo.updateSubscription(sub.id, { status: 'cancelled', endedAt });
  for (const grant of await repo.grantsForSubscription(sub.id)) {
    if (grant.status === 'active') await repo.setGrantExpiry(grant.id, endedAt);
  }
}

/** Payments failed after the provider's retries: cancelled there too, access removed now. */
async function suspendSubscription(repo: Repo, provider: PaymentProvider, sub: Subscription, now: Date): Promise<void> {
  await provider.cancelSubscription(sub.providerSubscriptionId, 'Payments failed');
  if (sub.status !== 'cancelled' && sub.status !== 'completed') {
    await repo.updateSubscription(sub.id, { status: 'cancelled', endedAt: now });
  }
  for (const grant of await repo.grantsForSubscription(sub.id)) {
    if (grant.status === 'active') await repo.revokeGrant(grant.id);
  }
}

async function providerChanged(
  repo: Repo,
  provider: PaymentProvider,
  sub: Subscription,
  now: Date,
): Promise<SubscriptionOutcome> {
  switch (await provider.subscriptionStatus(sub.providerSubscriptionId)) {
    case 'ACTIVE':
    case 'APPROVED':
      await activate(repo, provider, sub, now);
      break;
    case 'CANCELLED':
      await endSubscription(repo, sub, now);
      break;
    case 'SUSPENDED':
      await suspendSubscription(repo, provider, sub, now);
      break;
    case 'EXPIRED':
      // Every cycle billed: a payment plan is paid off. A subscription has no last cycle.
      if (sub.kind === 'subscription') await endSubscription(repo, sub, now);
      else if (sub.status === 'active' || sub.status === 'past_due') {
        await repo.updateSubscription(sub.id, { status: 'completed' });
      }
      break;
    case 'APPROVAL_PENDING':
      return 'ignored';
  }
  return (await repo.subscription(sub.id))?.status ?? 'unknown_subscription';
}

export async function applySubscriptionEvent(
  repo: Repo,
  provider: PaymentProvider,
  spaceId: string,
  event: SubscriptionEvent,
  now: Date,
): Promise<SubscriptionOutcome> {
  if (event.kind === 'sale.refunded') {
    return (await repo.refundSubscriptionPayment(spaceId, provider.name, event.saleId)) ? 'refunded' : 'unknown_sale';
  }
  const sub = await ownSubscription(repo, provider, spaceId, event.subscriptionId);
  if (!sub) return 'unknown_subscription';
  switch (event.kind) {
    case 'subscription.changed':
      return providerChanged(repo, provider, sub, now);
    case 'subscription.payment_failed':
      if (sub.status !== 'active') return sub.status;
      return (await repo.updateSubscription(sub.id, { status: 'past_due' })).status;
    case 'subscription.paid': {
      if (event.amountCents !== sub.amountCents || event.currency !== sub.currency) {
        throw new Error(`sale ${event.saleId} amount does not match subscription ${sub.id}`);
      }
      if (sub.status === 'pending') await activate(repo, provider, sub, now);
      const recorded = await repo.recordSubscriptionPayment({
        subscriptionId: sub.id,
        saleId: event.saleId,
        amountCents: event.amountCents,
        paidAt: event.paidAt,
      });
      return recorded ? 'recorded' : 'duplicate';
    }
  }
}

export type CancelOutcome = 'cancelled' | 'not_found' | 'not_cancellable';

/**
 * Member self-cancel (G5). Subscriptions only: a payment plan is a debt for one purchase.
 * Caller checks the viewer; profileId is the signed-in member.
 */
export async function cancelOwnSubscription(
  repo: Repo,
  provider: PaymentProvider,
  spaceId: string,
  profileId: string,
  subscriptionId: string,
  now: Date,
): Promise<CancelOutcome> {
  const sub = await repo.subscription(subscriptionId);
  if (!sub || sub.spaceId !== spaceId || sub.profileId !== profileId) return 'not_found';
  if (sub.kind !== 'subscription' || (sub.status !== 'active' && sub.status !== 'past_due')) return 'not_cancellable';
  if (sub.provider !== provider.name) throw new Error(`subscription ${sub.id} belongs to ${sub.provider}`);
  await provider.cancelSubscription(sub.providerSubscriptionId, 'Cancelled by the member');
  await endSubscription(repo, sub, now);
  return 'cancelled';
}
