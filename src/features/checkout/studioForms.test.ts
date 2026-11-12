import { describe, expect, it } from 'vitest';
import { offerCommandFromForm, paymentsInputFromForm } from './studioForms';

const form = (entries: Record<string, string | string[]>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) for (const x of [v].flat()) f.append(k, x);
  return f;
};

describe('offerCommandFromForm', () => {
  it('parses bump and upsell links; empty means none', () => {
    expect(offerCommandFromForm(form({ op: 'setLinks', offerId: 'o1', bumpOfferId: 'o2', upsellOfferId: '' }))).toEqual({
      ok: true,
      command: { op: 'setLinks', offerId: 'o1', bumpOfferId: 'o2', upsellOfferId: null },
    });
  });

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

  it('collects ticked products with the access group picked per community', () => {
    expect(
      offerCommandFromForm(form({ op: 'setProducts', offerId: 'o1', productId: ['p1', 'c1'], 'group:c1': 'g1', 'group:c2': 'g2' })),
    ).toEqual({
      ok: true,
      command: {
        op: 'setProducts',
        offerId: 'o1',
        items: [
          { productId: 'p1', accessGroupId: null },
          { productId: 'c1', accessGroupId: 'g1' },
        ],
      },
    });
    expect(offerCommandFromForm(form({ op: 'setProducts', offerId: 'o1', productId: 'c1', 'group:c1': '' }))).toMatchObject({
      command: { items: [{ productId: 'c1', accessGroupId: null }] },
    });
    expect(offerCommandFromForm(form({ op: 'setProducts', offerId: 'o1' }))).toMatchObject({ command: { items: [] } });
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
