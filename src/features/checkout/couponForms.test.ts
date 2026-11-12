import { describe, expect, it } from 'vitest';
import { couponCommandFromForm } from './couponForms';

const form = (entries: Record<string, string | string[]>): FormData => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) for (const x of [v].flat()) f.append(k, x);
  return f;
};

const base = { code: ' save10 ', discountType: 'percent', discount: '10', currency: 'EUR', maxUses: '', expiresAt: '' };

describe('couponCommandFromForm', () => {
  it('parses a percent coupon with no limits and its offers', () => {
    expect(couponCommandFromForm(form({ op: 'create', ...base, offerId: ['o1', 'o2'] }))).toEqual({
      ok: true,
      command: {
        op: 'create',
        code: 'save10',
        percentOff: 10,
        amountOffCents: null,
        currency: null,
        maxUses: null,
        oncePerCustomer: false,
        expiresAt: null,
        offerIds: ['o1', 'o2'],
      },
    });
  });

  it('parses an amount coupon with limits, expiry and the active flag', () => {
    const parsed = couponCommandFromForm(
      form({
        op: 'update',
        couponId: 'c1',
        ...base,
        discountType: 'amount',
        discount: '5,50',
        currency: 'USD',
        maxUses: '20',
        oncePerCustomer: 'on',
        expiresAt: '2026-12-31',
        active: 'on',
      }),
    );
    expect(parsed).toEqual({
      ok: true,
      command: {
        op: 'update',
        couponId: 'c1',
        code: 'save10',
        percentOff: null,
        amountOffCents: 550,
        currency: 'USD',
        maxUses: 20,
        oncePerCustomer: true,
        expiresAt: new Date('2026-12-31T00:00:00Z'),
        offerIds: [],
        active: true,
      },
    });
  });

  it('reads an unticked active box as off, and parses delete', () => {
    const parsed = couponCommandFromForm(form({ op: 'update', couponId: 'c1', ...base }));
    expect(parsed.ok && parsed.command.op === 'update' && parsed.command.active).toBe(false);
    expect(couponCommandFromForm(form({ op: 'delete', couponId: 'c1' }))).toEqual({ ok: true, command: { op: 'delete', couponId: 'c1' } });
  });

  it('refuses a bad discount, max uses or date', () => {
    expect(couponCommandFromForm(form({ op: 'create', ...base, discount: '10.5' }))).toMatchObject({ ok: false });
    expect(couponCommandFromForm(form({ op: 'create', ...base, discountType: 'amount', discount: 'abc' }))).toMatchObject({ ok: false });
    expect(couponCommandFromForm(form({ op: 'create', ...base, maxUses: '-1' }))).toMatchObject({ ok: false });
    expect(couponCommandFromForm(form({ op: 'create', ...base, expiresAt: 'soon' }))).toMatchObject({ ok: false });
  });
});
