import { describe, expect, it } from 'vitest';
import {
  checkoutPath,
  claimPath,
  contactsCsvHref,
  paypalWebhookPath,
  studioCustomersHref,
  studioOfferHref,
  studioOffersHref,
  studioPaymentsHref,
  thanksPath,
} from './paths';

describe('checkout paths', () => {
  it('builds checkout, thank-you and claim URLs', () => {
    expect(checkoutPath('full')).toBe('/checkout/full');
    expect(thanksPath('full', 'pending')).toBe('/checkout/full/thanks?status=pending');
    expect(thanksPath('full', 'welcome')).toBe('/checkout/full/thanks?status=welcome');
    expect(claimPath('a b')).toBe('/claim/a%20b');
  });
});

describe('studio commerce paths', () => {
  it('builds offers, payments and customers URLs', () => {
    expect(studioOffersHref).toBe('/studio/offers');
    expect(studioOfferHref('o 1')).toBe('/studio/offers/o%201');
    expect(studioPaymentsHref).toBe('/studio/payments');
    expect(studioCustomersHref).toBe('/studio/customers');
    expect(contactsCsvHref).toBe('/studio/customers/contacts.csv');
    expect(paypalWebhookPath('alexander')).toBe('/api/payments/paypal/alexander');
  });
});
