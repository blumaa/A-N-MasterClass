import { describe, expect, it } from 'vitest';
import { offerCommandFromForm, paymentsInputFromForm } from './studioForms';

const form = (entries: Record<string, string | string[]>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) for (const x of [v].flat()) f.append(k, x);
  return f;
};

describe('offerCommandFromForm', () => {
  it('parses create with a decimal-comma price and a slug from the title', () => {
    expect(offerCommandFromForm(form({ op: 'create', title: 'Full Access', price: '49,95', currency: 'EUR' }))).toEqual({
      ok: true,
      command: { op: 'create', title: 'Full Access', slug: 'full-access', priceCents: 4995, currency: 'EUR' },
    });
  });

  it('parses update with description and explicit slug', () => {
    const parsed = offerCommandFromForm(
      form({ op: 'update', offerId: 'o1', title: 'T', slug: 'my-offer', price: '120', currency: 'USD', description: ' d ' }),
    );
    expect(parsed).toEqual({
      ok: true,
      command: { op: 'update', offerId: 'o1', title: 'T', slug: 'my-offer', priceCents: 12000, currency: 'USD', description: 'd' },
    });
  });

  it('collects ticked products', () => {
    expect(offerCommandFromForm(form({ op: 'setProducts', offerId: 'o1', productId: ['p1', 'p2'] }))).toEqual({
      ok: true,
      command: { op: 'setProducts', offerId: 'o1', productIds: ['p1', 'p2'] },
    });
    expect(offerCommandFromForm(form({ op: 'setProducts', offerId: 'o1' }))).toMatchObject({ command: { productIds: [] } });
  });

  it('parses publish, unpublish and delete', () => {
    for (const op of ['publish', 'unpublish', 'delete'] as const) {
      expect(offerCommandFromForm(form({ op, offerId: 'o1' }))).toEqual({ ok: true, command: { op, offerId: 'o1' } });
    }
  });

  it('rejects bad prices, currencies and ops with a message', () => {
    expect(offerCommandFromForm(form({ op: 'create', title: 'T', price: '4.999', currency: 'EUR' }))).toEqual({
      ok: false,
      message: 'Enter a price like 49 or 49.95.',
    });
    expect(offerCommandFromForm(form({ op: 'create', title: 'T', price: '1', currency: 'JPY' }))).toMatchObject({ ok: false });
    expect(offerCommandFromForm(form({ op: 'nuke' }))).toMatchObject({ ok: false });
  });
});

describe('paymentsInputFromForm', () => {
  it('parses env and keeps blank secret as blank (keep stored)', () => {
    expect(paymentsInputFromForm(form({ env: 'live', clientId: 'c', secret: '', webhookId: 'w' }))).toEqual({
      ok: true,
      value: { env: 'live', clientId: 'c', secret: '', webhookId: 'w' },
    });
  });

  it('rejects unknown env', () => {
    expect(paymentsInputFromForm(form({ env: 'prod', clientId: 'c' }))).toMatchObject({ ok: false });
  });
});
