import { describe, expect, it } from 'vitest';
import { paypalSdkUrl } from './paypalSdk';

describe('paypalSdkUrl', () => {
  it('loads the SDK for the space client id, offer currency and capture intent', () => {
    const url = new URL(paypalSdkUrl('cid&x', 'EUR'));
    expect(url.origin + url.pathname).toBe('https://www.paypal.com/sdk/js');
    expect(Object.fromEntries(url.searchParams)).toEqual({ 'client-id': 'cid&x', currency: 'EUR', intent: 'capture' });
  });

  it('loads the subscription SDK with vault and subscription intent; the plan sets the currency', () => {
    const url = new URL(paypalSdkUrl('cid', 'EUR', 'subscription'));
    expect(Object.fromEntries(url.searchParams)).toEqual({ 'client-id': 'cid', vault: 'true', intent: 'subscription' });
  });
});
