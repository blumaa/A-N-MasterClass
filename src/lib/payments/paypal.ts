// PayPal REST adapter (Orders v2, Payments v2, Subscriptions v1, Catalog Products v1, Webhooks v1). One instance per space +
// credential env; each instructor uses their own REST app (G28). Errors throw
// PaymentProviderError, never swallowed. fetch is injected so tests run offline.
import { centsToDecimal, decimalToCents } from '@/lib/commerce/money';
import type { RecurringTerms } from '@/lib/commerce/recurring';
import type { BillingInterval, PaymentEnv } from '@/lib/data/types';
import {
  CAPTURE_STATUSES,
  PROVIDER_SUBSCRIPTION_STATUSES,
  type ProviderSubscriptionStatus,
  lineTotalCents,
  orderTotalCents,
  PaymentProviderError,
  type Capture,
  type CaptureStatus,
  type CreateOrderInput,
  type PaymentProvider,
  type ProviderEvent,
} from './provider';

export const PAYPAL_BASE_URL: Record<PaymentEnv, string> = {
  sandbox: 'https://api-m.sandbox.paypal.com',
  live: 'https://api-m.paypal.com',
};

/** purchase_units[].description max length (Orders v2). */
const DESCRIPTION_MAX = 127;

/**
 * One purchase unit with items + breakdown. PayPal checks value = item_total - discount (422 if not).
 * https://developer.paypal.com/docs/api/orders/v2/#orders_create
 */
function purchaseUnit({ lines, discountCents, currency, description, referenceId }: CreateOrderInput) {
  const money = (cents: number) => ({ currency_code: currency, value: centsToDecimal(cents) });
  return {
    reference_id: referenceId,
    description: description.slice(0, DESCRIPTION_MAX),
    amount: {
      ...money(orderTotalCents({ lines, discountCents })),
      breakdown: { item_total: money(lineTotalCents(lines)), ...(discountCents > 0 ? { discount: money(discountCents) } : {}) },
    },
    items: lines.map((l) => ({ name: l.name.slice(0, DESCRIPTION_MAX), quantity: '1', category: 'DIGITAL_GOODS', unit_amount: money(l.amountCents) })),
  };
}
const INTERVAL_UNIT: Record<BillingInterval, 'WEEK' | 'MONTH' | 'YEAR'> = { week: 'WEEK', month: 'MONTH', year: 'YEAR' };

/** Failed payments PayPal retries before it suspends the subscription. */
const PAYMENT_FAILURE_THRESHOLD = 3;

/**
 * Billing cycles: an optional free trial of N days, then the regular price every interval.
 * total_cycles 0 = until cancelled (subscription); N = payment plan installments.
 * https://developer.paypal.com/docs/api/subscriptions/v1/#plans_create
 */
function billingCycles(t: RecurringTerms) {
  if (!t.billingInterval) throw new PaymentProviderError(0, 'NOT_RECURRING', null);
  const trial = t.trialDays
    ? [{ frequency: { interval_unit: 'DAY', interval_count: t.trialDays }, tenure_type: 'TRIAL', sequence: 1, total_cycles: 1 }]
    : [];
  return [
    ...trial,
    {
      frequency: { interval_unit: INTERVAL_UNIT[t.billingInterval], interval_count: 1 },
      tenure_type: 'REGULAR',
      sequence: trial.length + 1,
      total_cycles: t.installments ?? 0,
      pricing_scheme: { fixed_price: { value: centsToDecimal(t.priceCents), currency_code: t.currency } },
    },
  ];
}

/** Renew the token this long before PayPal's expiry. */
const TOKEN_MARGIN_MS = 60_000;

/** Webhook headers PayPal signs with, mapped to the verify-webhook-signature body fields. */
const SIGNATURE_HEADERS = {
  auth_algo: 'paypal-auth-algo',
  cert_url: 'paypal-cert-url',
  transmission_id: 'paypal-transmission-id',
  transmission_sig: 'paypal-transmission-sig',
  transmission_time: 'paypal-transmission-time',
} as const;

const CAPTURE_PATH = /\/v2\/payments\/captures\/([^/?]+)$/;

export type PayPalConfig = { clientId: string; secret: string; env: PaymentEnv; webhookId: string | null };

type Json = Record<string, unknown>;

const obj = (v: unknown): Json => (v && typeof v === 'object' ? (v as Json) : {});
const str = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);

function readCapture(raw: unknown): Capture | null {
  const c = obj(raw);
  const id = str(c.id);
  const status = str(c.status);
  if (!id || !CAPTURE_STATUSES.includes(status as CaptureStatus)) return null;
  const amount = obj(c.amount);
  const value = str(amount.value);
  return {
    captureId: id,
    status: status as CaptureStatus,
    amountCents: value === null ? null : decimalToCents(value),
    currency: str(amount.currency_code) ?? '',
  };
}

/** A sale is one subscription payment only when it carries billing_agreement_id (the subscription id). */
function readSale(resource: Json): ProviderEvent {
  const subscriptionId = str(resource.billing_agreement_id);
  const saleId = str(resource.id);
  const amount = obj(resource.amount);
  const total = str(amount.total);
  const amountCents = total === null ? null : decimalToCents(total);
  const created = str(resource.create_time);
  if (!subscriptionId || !saleId || amountCents === null) return { kind: 'ignored' };
  return {
    kind: 'subscription.paid',
    subscriptionId,
    saleId,
    amountCents,
    currency: str(amount.currency) ?? '',
    paidAt: created ? new Date(created) : new Date(),
  };
}

async function failure(res: Response): Promise<PaymentProviderError> {
  const body = obj(await res.json().catch(() => null));
  const details = Array.isArray(body.details) ? body.details : [];
  const issue = str(obj(details[0]).issue) ?? str(body.name) ?? str(body.error);
  return new PaymentProviderError(res.status, issue, str(body.debug_id));
}

export function createPayPalProvider(config: PayPalConfig, fetchImpl: typeof fetch = fetch): PaymentProvider {
  const base = PAYPAL_BASE_URL[config.env];
  let token: { value: string; expiresAt: number } | null = null;

  async function accessToken(): Promise<string> {
    if (token && token.expiresAt > Date.now()) return token.value;
    const res = await fetchImpl(`${base}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${config.clientId}:${config.secret}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) throw await failure(res);
    const body = obj(await res.json());
    const value = str(body.access_token);
    if (!value) throw new PaymentProviderError(res.status, 'NO_ACCESS_TOKEN', null);
    const ttlMs = (typeof body.expires_in === 'number' ? body.expires_in : 0) * 1000;
    token = { value, expiresAt: Date.now() + ttlMs - TOKEN_MARGIN_MS };
    return value;
  }

  async function call(path: string, init: { method: 'GET' | 'POST'; body?: string; headers?: Record<string, string> }): Promise<Json> {
    const res = await fetchImpl(`${base}${path}`, {
      method: init.method,
      headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json', ...init.headers },
      body: init.body,
    });
    if (!res.ok) throw await failure(res);
    // Cancel answers 204 No Content.
    return res.status === 204 ? {} : obj(await res.json());
  }

  async function create(path: string, requestId: string, payload: unknown, missing: string): Promise<string> {
    const body = await call(path, { method: 'POST', headers: { 'PayPal-Request-Id': requestId }, body: JSON.stringify(payload) });
    const id = str(body.id);
    if (!id) throw new PaymentProviderError(200, missing, null);
    return id;
  }

  return {
    name: 'paypal',

    async createOrder(input) {
      const body = await call('/v2/checkout/orders', {
        method: 'POST',
        headers: { 'PayPal-Request-Id': input.requestId },
        body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [purchaseUnit(input)] }),
      });
      const id = str(body.id);
      if (!id) throw new PaymentProviderError(200, 'NO_ORDER_ID', null);
      return id;
    },

    async captureOrder(providerOrderId, requestId) {
      // Write calls return a minimal body unless asked; we need the capture id + amount.
      const body = await call(`/v2/checkout/orders/${encodeURIComponent(providerOrderId)}/capture`, {
        method: 'POST',
        headers: { 'PayPal-Request-Id': requestId, Prefer: 'return=representation' },
      });
      const units = Array.isArray(body.purchase_units) ? body.purchase_units : [];
      const captures = obj(obj(units[0]).payments).captures;
      const capture = readCapture(Array.isArray(captures) ? captures[0] : null);
      if (!capture) throw new PaymentProviderError(200, 'NO_CAPTURE_IN_RESPONSE', null);
      return capture;
    },

    async captureStatus(captureId) {
      const capture = readCapture(await call(`/v2/payments/captures/${encodeURIComponent(captureId)}`, { method: 'GET' }));
      if (!capture) throw new PaymentProviderError(200, 'UNKNOWN_CAPTURE_STATUS', null);
      return capture.status;
    },

    async verifyWebhook(headers, rawBody) {
      if (!config.webhookId) return false;
      const fields: Record<string, string> = {};
      for (const [field, name] of Object.entries(SIGNATURE_HEADERS)) {
        const value = headers.get(name);
        if (!value) return false;
        fields[field] = value;
      }
      // PayPal checks the signature against the event exactly as sent: embed the raw text,
      // never a re-serialised parse.
      const prefix = JSON.stringify({ ...fields, webhook_id: config.webhookId }).slice(0, -1);
      const body = await call('/v1/notifications/verify-webhook-signature', {
        method: 'POST',
        body: `${prefix},"webhook_event":${rawBody}}`,
      });
      return body.verification_status === 'SUCCESS';
    },

    async createPlan({ name, terms, requestId }) {
      const productId = await create(
        '/v1/catalogs/products',
        `${requestId}-product`,
        { name: name.slice(0, DESCRIPTION_MAX), type: 'DIGITAL' },
        'NO_PRODUCT_ID',
      );
      return create(
        '/v1/billing/plans',
        `${requestId}-plan`,
        {
          product_id: productId,
          name: name.slice(0, DESCRIPTION_MAX),
          status: 'ACTIVE',
          billing_cycles: billingCycles(terms),
          payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: PAYMENT_FAILURE_THRESHOLD },
        },
        'NO_PLAN_ID',
      );
    },

    async createSubscription({ planId, customId, requestId }) {
      return create('/v1/billing/subscriptions', requestId, { plan_id: planId, custom_id: customId }, 'NO_SUBSCRIPTION_ID');
    },

    async subscriptionStatus(subscriptionId) {
      const body = await call(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: 'GET' });
      const status = str(body.status);
      if (!PROVIDER_SUBSCRIPTION_STATUSES.includes(status as ProviderSubscriptionStatus)) {
        throw new PaymentProviderError(200, 'UNKNOWN_SUBSCRIPTION_STATUS', null);
      }
      return status as ProviderSubscriptionStatus;
    },

    async cancelSubscription(subscriptionId, reason) {
      await call(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: reason.slice(0, DESCRIPTION_MAX) }),
      });
    },

    parseEvent(rawBody): ProviderEvent {
      let event: Json;
      try {
        event = obj(JSON.parse(rawBody));
      } catch {
        return { kind: 'ignored' };
      }
      const resource = obj(event.resource);
      switch (event.event_type) {
        case 'PAYMENT.CAPTURE.COMPLETED': {
          const capture = readCapture(resource);
          const orderId = str(obj(obj(resource.supplementary_data).related_ids).order_id);
          return capture && orderId ? { kind: 'capture.completed', providerOrderId: orderId, capture } : { kind: 'ignored' };
        }
        case 'PAYMENT.CAPTURE.REFUNDED':
        case 'PAYMENT.CAPTURE.REVERSED': {
          // Refund resource points "up" to its capture; a capture resource points "up" to its order.
          const links = Array.isArray(resource.links) ? resource.links.map(obj) : [];
          const up = str(links.find((l) => l.rel === 'up')?.href);
          const captureId = (up && CAPTURE_PATH.exec(up)?.[1]) ?? str(resource.id);
          return captureId ? { kind: 'capture.changed', captureId } : { kind: 'ignored' };
        }
        case 'BILLING.SUBSCRIPTION.ACTIVATED':
        case 'BILLING.SUBSCRIPTION.CANCELLED':
        case 'BILLING.SUBSCRIPTION.SUSPENDED':
        case 'BILLING.SUBSCRIPTION.EXPIRED': {
          const subscriptionId = str(resource.id);
          return subscriptionId ? { kind: 'subscription.changed', subscriptionId } : { kind: 'ignored' };
        }
        case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED': {
          const subscriptionId = str(resource.id);
          return subscriptionId ? { kind: 'subscription.payment_failed', subscriptionId } : { kind: 'ignored' };
        }
        case 'PAYMENT.SALE.COMPLETED':
          return readSale(resource);
        case 'PAYMENT.SALE.REFUNDED': {
          const saleId = str(resource.sale_id);
          return saleId ? { kind: 'sale.refunded', saleId } : { kind: 'ignored' };
        }
        default:
          return { kind: 'ignored' };
      }
    },
  };
}
