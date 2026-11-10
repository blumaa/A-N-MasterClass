import { describe, expect, it } from 'vitest';
import { centsToDecimal, decimalToCents, formatMoney, isCurrency, parsePrice } from './money';

describe('parsePrice', () => {
  it('reads whole and two-decimal amounts as cents', () => {
    expect(parsePrice('120')).toBe(12000);
    expect(parsePrice('49.9')).toBe(4990);
    expect(parsePrice('49.95')).toBe(4995);
    expect(parsePrice('0')).toBe(0);
  });

  it('accepts a comma as decimal separator', () => {
    expect(parsePrice('49,95')).toBe(4995);
  });

  it('refuses negatives, three decimals and junk', () => {
    expect(parsePrice('-1')).toBeNull();
    expect(parsePrice('1.234')).toBeNull();
    expect(parsePrice('abc')).toBeNull();
    expect(parsePrice('')).toBeNull();
  });

  it('refuses amounts above the cap', () => {
    expect(parsePrice('100000')).toBeNull();
  });
});

describe('PayPal decimal strings', () => {
  it('round-trips cents', () => {
    expect(centsToDecimal(4995)).toBe('49.95');
    expect(centsToDecimal(12000)).toBe('120.00');
    expect(centsToDecimal(5)).toBe('0.05');
    expect(decimalToCents('49.95')).toBe(4995);
    expect(decimalToCents('120')).toBe(12000);
  });

  it('returns null for a value it cannot read exactly', () => {
    expect(decimalToCents('1.234')).toBeNull();
    expect(decimalToCents('x')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats with the currency', () => {
    expect(formatMoney(4995, 'EUR', 'en')).toBe('€49.95');
    expect(formatMoney(12000, 'USD', 'en')).toBe('$120.00');
  });
});

it('knows supported currencies', () => {
  expect(isCurrency('EUR')).toBe(true);
  expect(isCurrency('JPY')).toBe(false);
});
