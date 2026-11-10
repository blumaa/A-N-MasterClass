// Payment provider seam (G28). The DAL talks to this interface only; PayPal is the first
// adapter, Stripe can follow behind the same shape. Price + currency always come from our
// offer row, never from the browser.
import type { Currency } from '@/lib/commerce/money';
import type { OrderProvider, OrderStatus } from '@/lib/data/types';

/** PayPal capture status enum (Payments v2). */
export const CAPTURE_STATUSES = ['COMPLETED', 'DECLINED', 'PARTIALLY_REFUNDED', 'PENDING', 'REFUNDED', 'FAILED'] as const;
export type CaptureStatus = (typeof CAPTURE_STATUSES)[number];

export type Capture = {
  captureId: string;
  status: CaptureStatus;
  /** null when the provider sent an amount we cannot read exactly. */
  amountCents: number | null;
  currency: string;
};

export type CreateOrderInput = {
  amountCents: number;
  currency: Currency;
  description: string;
  /** Our offer id; shows up in the instructor's PayPal dashboard. */
  referenceId: string;
  /** Idempotency key (PayPal-Request-Id). */
  requestId: string;
};

export type ProviderEvent =
  | { kind: 'capture.completed'; providerOrderId: string; capture: Capture }
  /** Refund or reversal: caller re-reads the capture status, the event body is not trusted for it. */
  | { kind: 'capture.changed'; captureId: string }
  | { kind: 'ignored' };

export interface PaymentProvider {
  readonly name: OrderProvider;
  createOrder(input: CreateOrderInput): Promise<string>;
  captureOrder(providerOrderId: string, requestId: string): Promise<Capture>;
  captureStatus(captureId: string): Promise<CaptureStatus>;
  /** false = not from the provider (or no webhook configured). */
  verifyWebhook(headers: Headers, rawBody: string): Promise<boolean>;
  parseEvent(rawBody: string): ProviderEvent;
}

export class PaymentProviderError extends Error {
  constructor(
    readonly status: number,
    readonly issue: string | null,
    readonly debugId: string | null,
  ) {
    super(`payment provider error ${status}${issue ? ` ${issue}` : ''}${debugId ? ` (debug id ${debugId})` : ''}`);
    this.name = 'PaymentProviderError';
  }
}

/** Order status that follows a capture status; null = no change (pending, declined, failed). */
export function orderStatusFor(status: CaptureStatus): OrderStatus | null {
  switch (status) {
    case 'COMPLETED':
      return 'paid';
    case 'PARTIALLY_REFUNDED':
      return 'partially_refunded';
    case 'REFUNDED':
      return 'refunded';
    default:
      return null;
  }
}
