import { describe, expect, it } from 'vitest';
import {
  checkoutPath,
  contactsCsvHref,
  paypalWebhookPath,
  studioCouponHref,
  studioCouponsHref,
  studioCustomersHref,
  studioOfferHref,
  studioOffersHref,
  studioPaymentsHref,
  thanksPath,
} from './paths';

describe('checkout paths', () => {
  it('builds checkout and thank-you URLs', () => {
    expect(checkoutPath('full')).toBe('/checkout/full');
    // Kajabi's coupon link parameter: the coupon is applied when the buyer opens the checkout.
    expect(checkoutPath('full', 'SAVE 10')).toBe('/checkout/full?coupon_code=SAVE%2010');
    expect(thanksPath('full', 'pending')).toBe('/checkout/full/thanks?status=pending');
    expect(thanksPath('full', 'welcome')).toBe('/checkout/full/thanks?status=welcome');
  });
});

describe('studio commerce paths', () => {
  it('builds offers, coupons, payments and customers URLs', () => {
    expect(studioOffersHref).toBe('/studio/offers');
    expect(studioOfferHref('o 1')).toBe('/studio/offers/o%201');
    expect(studioCouponsHref).toBe('/studio/coupons');
    expect(studioCouponHref('c 1')).toBe('/studio/coupons/c%201');
    expect(studioPaymentsHref).toBe('/studio/payments');
    expect(studioCustomersHref).toBe('/studio/customers');
    expect(contactsCsvHref).toBe('/studio/customers/contacts.csv');
    expect(paypalWebhookPath('alexander')).toBe('/api/payments/paypal/alexander');
  });
});
