import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPayPalProvider, PAYPAL_BASE_URL } from './paypal';
import { PaymentProviderError } from './provider';

type Call = { url: string; init: RequestInit };

let calls: Call[];
let replies: Response[];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const fakeFetch = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
  calls.push({ url: String(url), init: init ?? {} });
  const reply = replies.shift();
  if (!reply) throw new Error(`unexpected fetch ${String(url)}`);
  return reply;
});

const provider = (webhookId: string | null = 'WH-1') =>
  createPayPalProvider({ clientId: 'cid', secret: 'sec', env: 'sandbox', webhookId }, fakeFetch as typeof fetch);

const token = () => json({ access_token: 'tok', expires_in: 32400 });
const header = (c: Call, name: string) => new Headers(c.init.headers).get(name);

beforeEach(() => {
  calls = [];
  replies = [];
  fakeFetch.mockClear();
});

describe('PayPal adapter', () => {
  it('uses the sandbox or live base URL', () => {
    expect(PAYPAL_BASE_URL.sandbox).toBe('https://api-m.sandbox.paypal.com');
    expect(PAYPAL_BASE_URL.live).toBe('https://api-m.paypal.com');
  });

  it('gets a token with basic auth, then creates a CAPTURE order with our price', async () => {
    replies.push(token(), json({ id: 'PO-1', status: 'CREATED' }, 201));
    const id = await provider().createOrder({
      amountCents: 4950,
      currency: 'EUR',
      description: 'Full access',
      referenceId: 'offer-1',
      requestId: 'req-1',
    });
    expect(id).toBe('PO-1');
    const [auth, create] = calls;
    expect(auth.url).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token');
    expect(header(auth, 'Authorization')).toBe(`Basic ${btoa('cid:sec')}`);
    expect(auth.init.body).toBe('grant_type=client_credentials');
    expect(create.url).toBe('https://api-m.sandbox.paypal.com/v2/checkout/orders');
    expect(header(create, 'Authorization')).toBe('Bearer tok');
    expect(header(create, 'PayPal-Request-Id')).toBe('req-1');
    expect(JSON.parse(String(create.init.body))).toEqual({
      intent: 'CAPTURE',
      purchase_units: [{ reference_id: 'offer-1', description: 'Full access', amount: { currency_code: 'EUR', value: '49.50' } }],
    });
  });

  it('reuses the token until it expires', async () => {
    replies.push(token(), json({ id: 'A' }, 201), json({ id: 'B' }, 201));
    const p = provider();
    const input = { amountCents: 100, currency: 'EUR' as const, description: 'x', referenceId: 'o', requestId: 'r' };
    await p.createOrder(input);
    await p.createOrder({ ...input, requestId: 'r2' });
    expect(calls.filter((c) => c.url.endsWith('/oauth2/token'))).toHaveLength(1);
  });

  it('cuts the description to PayPal’s 127 characters', async () => {
    replies.push(token(), json({ id: 'PO-1' }, 201));
    await provider().createOrder({ amountCents: 1, currency: 'EUR', description: 'x'.repeat(200), referenceId: 'o', requestId: 'r' });
    expect(JSON.parse(String(calls[1].init.body)).purchase_units[0].description).toHaveLength(127);
  });

  it('captures with return=representation and reads the capture', async () => {
    replies.push(
      token(),
      json({
        id: 'PO-1',
        status: 'COMPLETED',
        purchase_units: [{ payments: { captures: [{ id: 'CAP-1', status: 'COMPLETED', amount: { currency_code: 'EUR', value: '49.50' } }] } }],
      }, 201),
    );
    const capture = await provider().captureOrder('PO-1', 'req-cap');
    expect(capture).toEqual({ captureId: 'CAP-1', status: 'COMPLETED', amountCents: 4950, currency: 'EUR' });
    const call = calls[1];
    expect(call.url).toBe('https://api-m.sandbox.paypal.com/v2/checkout/orders/PO-1/capture');
    expect(header(call, 'Prefer')).toBe('return=representation');
    expect(header(call, 'PayPal-Request-Id')).toBe('req-cap');
  });

  it('throws a provider error with issue and debug id on failure', async () => {
    replies.push(token(), json({ name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'ORDER_NOT_APPROVED' }], debug_id: 'dbg' }, 422));
    const err = await provider().captureOrder('PO-1', 'r').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PaymentProviderError);
    expect(err).toMatchObject({ status: 422, issue: 'ORDER_NOT_APPROVED', debugId: 'dbg' });
  });

  it('throws when a capture response has no capture', async () => {
    replies.push(token(), json({ id: 'PO-1', purchase_units: [] }, 201));
    await expect(provider().captureOrder('PO-1', 'r')).rejects.toThrow(/NO_CAPTURE_IN_RESPONSE/);
  });

  it('reads a capture status', async () => {
    replies.push(token(), json({ id: 'CAP-1', status: 'REFUNDED' }));
    expect(await provider().captureStatus('CAP-1')).toBe('REFUNDED');
    expect(calls[1].url).toBe('https://api-m.sandbox.paypal.com/v2/payments/captures/CAP-1');
  });

  it('verifies a webhook by posting the raw event back unchanged', async () => {
    replies.push(token(), json({ verification_status: 'SUCCESS' }));
    const raw = '{"id":"WH-EV","event_type":"PAYMENT.CAPTURE.COMPLETED",  "resource":{"amount":{"value":"1.10"}}}';
    const headers = new Headers({
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://api.paypal.com/cert',
      'paypal-transmission-id': 't-1',
      'paypal-transmission-sig': 'sig',
      'paypal-transmission-time': '2026-11-10T12:00:00Z',
    });
    expect(await provider().verifyWebhook(headers, raw)).toBe(true);
    const call = calls[1];
    expect(call.url).toBe('https://api-m.sandbox.paypal.com/v1/notifications/verify-webhook-signature');
    const body = String(call.init.body);
    expect(body.endsWith(`"webhook_event":${raw}}`)).toBe(true);
    expect(JSON.parse(body)).toMatchObject({
      auth_algo: 'SHA256withRSA',
      cert_url: 'https://api.paypal.com/cert',
      transmission_id: 't-1',
      transmission_sig: 'sig',
      transmission_time: '2026-11-10T12:00:00Z',
      webhook_id: 'WH-1',
    });
  });

  it('refuses a webhook without signature headers, without a webhook id, or on FAILURE', async () => {
    expect(await provider().verifyWebhook(new Headers(), '{}')).toBe(false);
    const headers = new Headers({
      'paypal-auth-algo': 'a',
      'paypal-cert-url': 'c',
      'paypal-transmission-id': 'i',
      'paypal-transmission-sig': 's',
      'paypal-transmission-time': 't',
    });
    expect(await provider(null).verifyWebhook(headers, '{}')).toBe(false);
    replies.push(token(), json({ verification_status: 'FAILURE' }));
    expect(await provider().verifyWebhook(headers, '{}')).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it('parses a completed capture event', () => {
    const raw = JSON.stringify({
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: {
        id: 'CAP-1',
        status: 'COMPLETED',
        amount: { currency_code: 'EUR', value: '10.00' },
        supplementary_data: { related_ids: { order_id: 'PO-1' } },
      },
    });
    expect(provider().parseEvent(raw)).toEqual({
      kind: 'capture.completed',
      providerOrderId: 'PO-1',
      capture: { captureId: 'CAP-1', status: 'COMPLETED', amountCents: 1000, currency: 'EUR' },
    });
  });

  it('parses a refund event to its capture id from the "up" link', () => {
    const raw = JSON.stringify({
      event_type: 'PAYMENT.CAPTURE.REFUNDED',
      resource: {
        id: 'REF-1',
        links: [
          { rel: 'self', href: 'https://api.paypal.com/v2/payments/refunds/REF-1' },
          { rel: 'up', href: 'https://api.paypal.com/v2/payments/captures/CAP-1' },
        ],
      },
    });
    expect(provider().parseEvent(raw)).toEqual({ kind: 'capture.changed', captureId: 'CAP-1' });
  });

  it('parses a reversal whose resource is the capture itself', () => {
    const raw = JSON.stringify({
      event_type: 'PAYMENT.CAPTURE.REVERSED',
      resource: { id: 'CAP-1', links: [{ rel: 'up', href: 'https://api.paypal.com/v2/checkout/orders/PO-1' }] },
    });
    expect(provider().parseEvent(raw)).toEqual({ kind: 'capture.changed', captureId: 'CAP-1' });
  });

  it('ignores other events and malformed bodies', () => {
    expect(provider().parseEvent(JSON.stringify({ event_type: 'CHECKOUT.ORDER.APPROVED', resource: {} }))).toEqual({ kind: 'ignored' });
    expect(provider().parseEvent('not json')).toEqual({ kind: 'ignored' });
    expect(provider().parseEvent(JSON.stringify({ event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: {} }))).toEqual({ kind: 'ignored' });
  });
});
