// Checkout price (G23): always computed here from DB rows, never from the browser.
// Total = offer - coupon discount + bump. The coupon discounts the main offer only.
import type { Repo } from '@/lib/data/repo';
import type { Coupon, Offer } from '@/lib/data/types';
import { lineTotalCents, type OrderLine } from '@/lib/payments/provider';

export type BumpInfo = { id: string; title: string; description: string | null; priceCents: number };

export type Quote = {
  lines: OrderLine[];
  discountCents: number;
  totalCents: number;
  couponId: string | null;
  bump: BumpInfo | null;
};

type Refused = { ok: false; message: string };
export type PriceResult = { ok: true; quote: Quote } | Refused;
export type PriceInput = { couponCode: string; withBump: boolean };

/** bump = the offer's eligible bump (checkoutBump), already loaded. */
export type PricedOffer = Pick<Offer, 'id' | 'title' | 'priceCents' | 'currency'> & { bump: BumpInfo | null };

const NOT_VALID = 'This coupon code is not valid.';
const refused = (message: string): Refused => ({ ok: false, message });

/** Rules that need no order history. */
export function couponDiscount(
  coupon: Coupon,
  offer: Pick<Offer, 'id' | 'priceCents' | 'currency'>,
  now: Date,
): { ok: true; cents: number } | Refused {
  if (!coupon.active) return refused(NOT_VALID);
  if (coupon.expiresAt && coupon.expiresAt <= now) return refused('This coupon has expired.');
  if (!coupon.offerIds.includes(offer.id)) return refused('This coupon does not apply to this offer.');
  if (coupon.percentOff !== null) return { ok: true, cents: Math.round((offer.priceCents * coupon.percentOff) / 100) };
  if (coupon.currency !== offer.currency) return refused('This coupon does not apply to this offer.');
  return { ok: true, cents: Math.min(coupon.amountOffCents ?? 0, offer.priceCents) };
}

/** Bump shown at checkout: published and in the offer's currency (one PayPal order, one currency). */
export async function checkoutBump(repo: Repo, offer: Pick<Offer, 'currency' | 'bumpOfferId'>): Promise<BumpInfo | null> {
  if (!offer.bumpOfferId) return null;
  const bump = await repo.offer(offer.bumpOfferId);
  if (!bump || bump.status !== 'published' || bump.currency !== offer.currency) return null;
  return { id: bump.id, title: bump.title, description: bump.description, priceCents: bump.priceCents };
}

/** email = null before the buyer typed one: the once-per-customer rule is checked at start. */
export async function priceCheckout(
  repo: Repo,
  spaceId: string,
  offer: PricedOffer,
  input: PriceInput,
  email: string | null,
  now: Date,
): Promise<PriceResult> {
  let couponId: string | null = null;
  let discountCents = 0;
  const code = input.couponCode.trim();
  if (code) {
    const coupon = await repo.couponByCode(spaceId, code);
    if (!coupon) return refused(NOT_VALID);
    const discount = couponDiscount(coupon, offer, now);
    if (!discount.ok) return discount;
    const uses = await repo.couponUses(coupon.id, email ?? '');
    if (coupon.maxUses !== null && uses.total >= coupon.maxUses) return refused('This coupon has reached its limit.');
    if (email && coupon.oncePerCustomer && uses.byEmail > 0) return refused('You have already used this coupon.');
    couponId = coupon.id;
    discountCents = discount.cents;
  }
  const bump = input.withBump ? offer.bump : null;
  const lines: OrderLine[] = [{ name: offer.title, amountCents: offer.priceCents }];
  if (bump) lines.push({ name: bump.title, amountCents: bump.priceCents });
  const totalCents = lineTotalCents(lines) - discountCents;
  return { ok: true, quote: { lines, discountCents, totalCents, couponId, bump } };
}
