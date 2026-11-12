// Fake payment provider for DATA_SOURCE=fake dev: no network, every capture completes.
// State is per instance; the composition root keeps one instance on globalThis.
import type { Currency } from '@/lib/commerce/money';
import {
  orderTotalCents,
  type Capture,
  type CaptureStatus,
  type PaymentProvider,
  type ProviderSubscriptionStatus,
} from './provider';

type FakeOrder = { amountCents: number; currency: Currency; capture: Capture | null };

export type FakeProvider = PaymentProvider & {
  /** Dev/test hook: move a capture to another status (simulates a refund in PayPal). */
  setCaptureStatus(captureId: string, status: CaptureStatus): void;
  /** Dev/test hook: move a subscription to another status (simulates PayPal billing). */
  setSubscriptionStatus(subscriptionId: string, status: ProviderSubscriptionStatus): void;
};

export function createFakeProvider(): FakeProvider {
  const orders = new Map<string, FakeOrder>();
  const captures = new Map<string, Capture>();
  const plans = new Set<string>();
  const subscriptions = new Map<string, ProviderSubscriptionStatus>();
  let seq = 0;

  function subscriptionOf(id: string): ProviderSubscriptionStatus {
    const status = subscriptions.get(id);
    if (!status) throw new Error(`fake provider: unknown subscription ${id}`);
    return status;
  }

  return {
    name: 'fake',
    async createOrder(input) {
      const id = `FAKE-ORDER-${++seq}`;
      orders.set(id, { amountCents: orderTotalCents(input), currency: input.currency, capture: null });
      return id;
    },
    async captureOrder(providerOrderId) {
      const order = orders.get(providerOrderId);
      if (!order) throw new Error(`fake provider: unknown order ${providerOrderId}`);
      // Same order captured twice returns the same capture, like PayPal-Request-Id replays.
      order.capture ??= { captureId: `FAKE-CAPTURE-${++seq}`, status: 'COMPLETED', amountCents: order.amountCents, currency: order.currency };
      captures.set(order.capture.captureId, order.capture);
      return { ...order.capture };
    },
    async captureStatus(captureId) {
      const capture = captures.get(captureId);
      if (!capture) throw new Error(`fake provider: unknown capture ${captureId}`);
      return capture.status;
    },
    async verifyWebhook() {
      return false;
    },
    parseEvent() {
      return { kind: 'ignored' };
    },
    async createPlan() {
      const id = `FAKE-PLAN-${++seq}`;
      plans.add(id);
      return id;
    },
    async createSubscription({ planId }) {
      if (!plans.has(planId)) throw new Error(`fake provider: unknown plan ${planId}`);
      // No approval popup in fake mode: the buyer has approved by the time we read it.
      const id = `FAKE-SUB-${++seq}`;
      subscriptions.set(id, 'APPROVED');
      return id;
    },
    async subscriptionStatus(subscriptionId) {
      return subscriptionOf(subscriptionId);
    },
    async cancelSubscription(subscriptionId) {
      subscriptionOf(subscriptionId);
      subscriptions.set(subscriptionId, 'CANCELLED');
    },
    setSubscriptionStatus(subscriptionId, status) {
      subscriptionOf(subscriptionId);
      subscriptions.set(subscriptionId, status);
    },
    setCaptureStatus(captureId, status) {
      const capture = captures.get(captureId);
      if (!capture) throw new Error(`fake provider: unknown capture ${captureId}`);
      capture.status = status;
    },
  };
}
