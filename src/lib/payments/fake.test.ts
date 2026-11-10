import { describe, expect, it } from 'vitest';
import { createFakeProvider } from './fake';

describe('fake provider', () => {
  it('captures the created amount once and reports status changes', async () => {
    const p = createFakeProvider();
    const id = await p.createOrder({ amountCents: 4900, currency: 'EUR', description: 'x', referenceId: 'o', requestId: 'r' });
    const first = await p.captureOrder(id, 'r1');
    expect(first).toMatchObject({ status: 'COMPLETED', amountCents: 4900, currency: 'EUR' });
    expect((await p.captureOrder(id, 'r2')).captureId).toBe(first.captureId);
    p.setCaptureStatus(first.captureId, 'REFUNDED');
    expect(await p.captureStatus(first.captureId)).toBe('REFUNDED');
  });

  it('refuses an unknown order and never verifies webhooks', async () => {
    const p = createFakeProvider();
    await expect(p.captureOrder('nope', 'r')).rejects.toThrow(/unknown order/);
    expect(await p.verifyWebhook(new Headers(), '{}')).toBe(false);
  });
});
