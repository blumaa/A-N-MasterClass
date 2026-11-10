// Fake payment provider for DATA_SOURCE=fake dev: no network, every capture completes.
// State is per instance; the composition root keeps one instance on globalThis.
import type { Currency } from '@/lib/commerce/money';
import type { Capture, CaptureStatus, PaymentProvider } from './provider';

type FakeOrder = { amountCents: number; currency: Currency; capture: Capture | null };

export type FakeProvider = PaymentProvider & {
  /** Dev/test hook: move a capture to another status (simulates a refund in PayPal). */
  setCaptureStatus(captureId: string, status: CaptureStatus): void;
};

export function createFakeProvider(): FakeProvider {
  const orders = new Map<string, FakeOrder>();
  const captures = new Map<string, Capture>();
  let seq = 0;

  return {
    name: 'fake',
    async createOrder({ amountCents, currency }) {
      const id = `FAKE-ORDER-${++seq}`;
      orders.set(id, { amountCents, currency, capture: null });
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
    setCaptureStatus(captureId, status) {
      const capture = captures.get(captureId);
      if (!capture) throw new Error(`fake provider: unknown capture ${captureId}`);
      capture.status = status;
    },
  };
}
