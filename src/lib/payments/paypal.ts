// PayPal REST adapter (Orders v2, Payments v2, Webhooks v1). One instance per space +
// credential env; each instructor uses their own REST app (G28). Errors throw
// PaymentProviderError, never swallowed. fetch is injected so tests run offline.
import { centsToDecimal, decimalToCents } from '@/lib/commerce/money';
import type { PaymentEnv } from '@/lib/data/types';
import {
  CAPTURE_STATUSES,
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
    return obj(await res.json());
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
        default:
          return { kind: 'ignored' };
      }
    },
  };
}
