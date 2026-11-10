import { describe, expect, it } from 'vitest';
import { orderStatusFor, PaymentProviderError } from './provider';

describe('orderStatusFor', () => {
  it('maps paid, partial and full refund; leaves the rest alone', () => {
    expect(orderStatusFor('COMPLETED')).toBe('paid');
    expect(orderStatusFor('PARTIALLY_REFUNDED')).toBe('partially_refunded');
    expect(orderStatusFor('REFUNDED')).toBe('refunded');
    expect(orderStatusFor('PENDING')).toBeNull();
    expect(orderStatusFor('DECLINED')).toBeNull();
  });
});

describe('PaymentProviderError', () => {
  it('names status, issue and debug id', () => {
    expect(new PaymentProviderError(422, 'ORDER_NOT_APPROVED', 'abc').message).toBe(
      'payment provider error 422 ORDER_NOT_APPROVED (debug id abc)',
    );
  });
});
