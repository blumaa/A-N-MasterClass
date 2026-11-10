// Money as integer cents. Only two-decimal currencies (PayPal sends "49.95"); adding a
// zero-decimal currency (JPY) needs per-currency exponents first.
export const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF'] as const;
export type Currency = (typeof CURRENCIES)[number];

export const isCurrency = (v: unknown): v is Currency => CURRENCIES.includes(v as Currency);

/** Highest price an instructor can set, in cents. Guards typos (SQL check mirrors it). */
export const MAX_PRICE_CENTS = 9_999_999;

const DECIMAL = /^(\d+)(?:[.,](\d{1,2}))?$/;

function toCents(text: string): number | null {
  const m = DECIMAL.exec(text.trim());
  if (!m) return null;
  return Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
}

/** Studio price field: "49.95" / "49,95" / "120" -> cents. null = not a valid price. */
export function parsePrice(text: string): number | null {
  const cents = toCents(text);
  return cents !== null && cents <= MAX_PRICE_CENTS ? cents : null;
}

/** PayPal amount.value. */
export const centsToDecimal = (cents: number): string =>
  `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;

/** PayPal amount.value back to cents; null if not an exact two-decimal amount. */
export function decimalToCents(value: string): number | null {
  return /^\d+(\.\d{1,2})?$/.test(value) ? toCents(value) : null;
}

export const formatMoney = (cents: number, currency: Currency, locale: string): string =>
  new Intl.NumberFormat(locale, { style: 'currency', currency }).format(cents / 100);
