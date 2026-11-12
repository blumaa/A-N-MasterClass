// Payment provider seam (G28). The DAL talks to this interface only; PayPal is the first
// adapter, Stripe can follow behind the same shape. Price + currency always come from our
// offer row, never from the browser.
import type { Currency } from '@/lib/commerce/money';
import type { RecurringTerms } from '@/lib/commerce/recurring';
import type { OrderStatus, RecurringProvider } from '@/lib/data/types';

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

/** One item of the order: the offer, then an order bump (G23). Quantity is always 1. */
export type OrderLine = { name: string; amountCents: number };

export type CreateOrderInput = {
  lines: readonly OrderLine[];
  /** Coupon discount on the order (G23). Total = sum of lines - discount. */
  discountCents: number;
  currency: Currency;
  description: string;
  /** Our offer id; shows up in the instructor's PayPal dashboard. */
  referenceId: string;
  /** Idempotency key (PayPal-Request-Id). */
  requestId: string;
};

export const lineTotalCents = (lines: readonly OrderLine[]): number => lines.reduce((sum, l) => sum + l.amountCents, 0);
export const orderTotalCents = ({ lines, discountCents }: Pick<CreateOrderInput, 'lines' | 'discountCents'>): number =>
  lineTotalCents(lines) - discountCents;

/** PayPal subscription status enum (Subscriptions v1). */
export const PROVIDER_SUBSCRIPTION_STATUSES = [
  'APPROVAL_PENDING',
  'APPROVED',
  'ACTIVE',
  'SUSPENDED',
  'CANCELLED',
  'EXPIRED',
] as const;
export type ProviderSubscriptionStatus = (typeof PROVIDER_SUBSCRIPTION_STATUSES)[number];

/** A billing plan for one offer's recurring terms (G5). Plans are fixed once created. */
export type CreatePlanInput = { name: string; terms: RecurringTerms; requestId: string };

/** customId shows up in the instructor's PayPal dashboard (our offer id). */
export type CreateSubscriptionInput = { planId: string; customId: string; requestId: string };

export type ProviderEvent =
  | { kind: 'capture.completed'; providerOrderId: string; capture: Capture }
  /** Refund or reversal: caller re-reads the capture status, the event body is not trusted for it. */
  | { kind: 'capture.changed'; captureId: string }
  /** Activated, cancelled, suspended or expired: caller re-reads the subscription status. */
  | { kind: 'subscription.changed'; subscriptionId: string }
  | { kind: 'subscription.payment_failed'; subscriptionId: string }
  /** One paid billing cycle. saleId is the idempotency key. */
  | {
      kind: 'subscription.paid';
      subscriptionId: string;
      saleId: string;
      amountCents: number;
      currency: string;
      paidAt: Date;
    }
  | { kind: 'sale.refunded'; saleId: string }
  | { kind: 'ignored' };

export interface PaymentProvider {
  readonly name: RecurringProvider;
  createOrder(input: CreateOrderInput): Promise<string>;
  captureOrder(providerOrderId: string, requestId: string): Promise<Capture>;
  captureStatus(captureId: string): Promise<CaptureStatus>;
  /** false = not from the provider (or no webhook configured). */
  verifyWebhook(headers: Headers, rawBody: string): Promise<boolean>;
  parseEvent(rawBody: string): ProviderEvent;
  /** Recurring (G5): returns the provider plan id. */
  createPlan(input: CreatePlanInput): Promise<string>;
  /** Returns the provider subscription id; the buyer approves it in the provider's popup. */
  createSubscription(input: CreateSubscriptionInput): Promise<string>;
  subscriptionStatus(subscriptionId: string): Promise<ProviderSubscriptionStatus>;
  cancelSubscription(subscriptionId: string, reason: string): Promise<void>;
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
