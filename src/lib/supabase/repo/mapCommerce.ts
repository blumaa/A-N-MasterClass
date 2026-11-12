// Row (snake_case, ISO strings) -> domain type (camelCase, Date). Commerce tables only.
// Enum-like text columns are guarded by SQL checks, so the casts below trust the DB.
import type {
  ClaimToken,
  Contact,
  Coupon,
  Offer,
  OfferItem,
  Order,
  PaymentCredentials,
} from "@/lib/data/types";
import { toDate, toDateOrNull, type Row } from "./context";

export const toOffer = (r: Row<"offers">): Offer => ({
  id: r.id,
  spaceId: r.space_id,
  slug: r.slug,
  title: r.title,
  description: r.description,
  priceCents: r.price_cents,
  currency: r.currency as Offer["currency"],
  status: r.status as Offer["status"],
  bumpOfferId: r.bump_offer_id,
  upsellOfferId: r.upsell_offer_id,
});

export const toOfferItem = (r: Row<"offer_products">): OfferItem => ({
  productId: r.product_id,
  accessGroupId: r.access_group_id,
});

export const toOrder = (r: Row<"orders">): Order => ({
  id: r.id,
  spaceId: r.space_id,
  offerId: r.offer_id,
  profileId: r.profile_id,
  email: r.email,
  provider: r.provider as Order["provider"],
  providerOrderId: r.provider_order_id,
  captureId: r.capture_id,
  status: r.status as Order["status"],
  amountCents: r.amount_cents,
  couponId: r.coupon_id,
  discountCents: r.discount_cents,
  bumpOfferId: r.bump_offer_id,
  bumpCents: r.bump_cents,
  currency: r.currency as Order["currency"],
  livemode: r.livemode,
  waiverVersion: r.waiver_version,
  waiverAcceptedAt: toDate(r.waiver_accepted_at),
  marketingConsent: r.marketing_consent,
  createdAt: toDate(r.created_at),
  paidAt: toDateOrNull(r.paid_at),
});

// secret_id stays behind: the domain type has no secret.
export const toPaymentCredentials = (
  r: Row<"payment_credentials">,
): PaymentCredentials => ({
  spaceId: r.space_id,
  env: r.env as PaymentCredentials["env"],
  clientId: r.client_id,
  webhookId: r.webhook_id,
  updatedAt: toDate(r.updated_at),
});

export const toContact = (r: Row<"contacts">): Contact => ({
  spaceId: r.space_id,
  email: r.email,
  profileId: r.profile_id,
  marketingConsent: r.marketing_consent,
  consentAt: toDateOrNull(r.consent_at),
  consentSource: r.consent_source,
  createdAt: toDate(r.created_at),
});

export const toClaimToken = (r: Row<"claim_tokens">): ClaimToken => ({
  tokenHash: r.token_hash,
  spaceId: r.space_id,
  profileId: r.profile_id,
  expiresAt: toDate(r.expires_at),
  usedAt: toDateOrNull(r.used_at),
});

/** coupon_offers rows come embedded: select("*, coupon_offers(offer_id)"). */
export const toCoupon = (
  r: Row<"coupons"> & { coupon_offers: { offer_id: string }[] },
): Coupon => ({
  id: r.id,
  spaceId: r.space_id,
  code: r.code,
  percentOff: r.percent_off,
  amountOffCents: r.amount_off_cents,
  currency: r.currency as Coupon["currency"],
  maxUses: r.max_uses,
  oncePerCustomer: r.once_per_customer,
  expiresAt: toDateOrNull(r.expires_at),
  active: r.active,
  offerIds: r.coupon_offers.map((o) => o.offer_id).toSorted(),
  createdAt: toDate(r.created_at),
});
