// Order fulfilment (G4, G28): one idempotent path shared by the capture route, the free
// checkout and the PayPal webhook. Mirrors the fulfil_order SQL RPC (atomic there).
import type { Repo } from '@/lib/data/repo';
import type { Order, OrderStatus } from '@/lib/data/types';
import { buyerProfile, finishBuyer, giveGrants } from './buyer';
import { applySubscriptionEvent, type SubscriptionOutcome } from './subscriptions';
import { orderStatusFor, type Capture, type PaymentProvider, type ProviderEvent } from '@/lib/payments/provider';

export type FulfilResult =
  | { status: 'paid'; orderId: string; profileId: string; newAccount: boolean; claimToken: string | null }
  | { status: 'pending'; orderId: string };

/** Throws when the capture cannot pay for this order: never grant on a mismatch. */
function checkCapture(order: Order, capture: Capture | null): void {
  if (capture === null) {
    if (order.provider !== 'free' || order.amountCents !== 0) throw new Error(`order ${order.id} needs a capture`);
    return;
  }
  if (capture.status !== 'COMPLETED' && capture.status !== 'PENDING') {
    throw new Error(`capture ${capture.captureId} is ${capture.status}`);
  }
  if (capture.amountCents !== order.amountCents || capture.currency !== order.currency) {
    throw new Error(`capture ${capture.captureId} amount does not match order ${order.id}`);
  }
}

export async function fulfilOrder(repo: Repo, order: Order, capture: Capture | null, now: Date): Promise<FulfilResult> {
  if (order.status !== 'created') {
    if (!order.profileId) throw new Error(`order ${order.id} is ${order.status} without a buyer`);
    return { status: 'paid', orderId: order.id, profileId: order.profileId, newAccount: false, claimToken: null };
  }
  checkCapture(order, capture);
  if (capture?.status === 'PENDING') {
    await repo.updateOrder(order.id, { captureId: capture.captureId });
    return { status: 'pending', orderId: order.id };
  }

  const { profileId, isNew } = await buyerProfile(repo, order.spaceId, order.email);
  // The order bump (G23) grants its offer's products too; a product in both is granted once.
  const offerIds = order.bumpOfferId ? [order.offerId, order.bumpOfferId] : [order.offerId];
  await giveGrants(repo, profileId, offerIds, { orderId: order.id }, now);
  const claimToken = await finishBuyer(repo, order, profileId, isNew, now);
  await repo.updateOrder(order.id, { status: 'paid', captureId: capture?.captureId ?? null, profileId, paidAt: now });
  return { status: 'paid', orderId: order.id, profileId, newAccount: isNew, claimToken };
}

export type EventOutcome = 'fulfilled' | 'pending' | 'ignored' | 'unknown_order' | OrderStatus | SubscriptionOutcome;

/** Webhook backup path. Orders of other spaces count as unknown: a space's webhook only touches its own orders. */
export async function applyProviderEvent(
  repo: Repo,
  provider: PaymentProvider,
  spaceId: string,
  event: ProviderEvent,
  now: Date,
): Promise<EventOutcome> {
  switch (event.kind) {
    case 'ignored':
      return 'ignored';
    case 'capture.completed': {
      const order = await repo.orderByProviderId(provider.name, event.providerOrderId);
      if (!order || order.spaceId !== spaceId) return 'unknown_order';
      const result = await fulfilOrder(repo, order, event.capture, now);
      return result.status === 'paid' ? 'fulfilled' : 'pending';
    }
    case 'capture.changed': {
      const order = await repo.orderByCaptureId(provider.name, event.captureId);
      if (!order || order.spaceId !== spaceId) return 'unknown_order';
      // Re-read the capture instead of trusting the event payload: covers out-of-order delivery.
      const status = orderStatusFor(await provider.captureStatus(event.captureId));
      if (!status) return 'ignored';
      if (status !== order.status) await repo.updateOrder(order.id, { status });
      if (status === 'refunded') {
        for (const grant of await repo.grantsForOrder(order.id)) {
          if (grant.status === 'active') await repo.revokeGrant(grant.id);
        }
      }
      return status;
    }
    case 'subscription.changed':
    case 'subscription.payment_failed':
    case 'subscription.paid':
    case 'sale.refunded':
      return applySubscriptionEvent(repo, provider, spaceId, event, now);
  }
}
