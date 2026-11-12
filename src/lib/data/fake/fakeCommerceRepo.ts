// Commerce part of the fake repo. Same constraints as supabase/migrations/*_commerce.sql:
// unique (space_id, slug) offers, price range check, offer products in the offer's space
// (with an access group of that community, if any),
// unique (provider, provider_order_id) and (provider, capture_id), no offer delete once sold,
// one credentials row per (space, env), contacts unique on (space, lower(email)).
// G23 (*_coupons_bumps_upsells.sql): bump/upsell links in the same space and never self, cleared
// when the linked offer goes; order coupon and bump in the order's space, no extras without them.
// G5 (*_subscriptions.sql): offers_recurring_terms / offers_trial_days via recurringTermsError,
// no offer delete once it has subscriptions.
import { MAX_PRICE_CENTS } from '@/lib/commerce/money';
import { recurringTermsError } from '@/lib/commerce/recurring';
import { SLUG_PATTERN } from '@/lib/tenancy/slug';
import {
  ConstraintError,
  OFFER_HAS_SUBSCRIPTIONS,
  OFFER_LINK_SELF,
  OFFER_LINK_SPACE,
  OFFER_TERMS,
  OFFER_TRIAL_DAYS,
  ORDER_EXTRAS,
} from '../errors';
import type { Repo } from '../repo';
import type { Contact, Offer, Order } from '../types';
import type { Db } from './db';

type CommerceRepo = Pick<
  Repo,
  | 'offers'
  | 'offer'
  | 'offerBySlug'
  | 'createOffer'
  | 'updateOffer'
  | 'deleteOffer'
  | 'offerItems'
  | 'setOfferItems'
  | 'orders'
  | 'order'
  | 'orderByProviderId'
  | 'orderByCaptureId'
  | 'createOrder'
  | 'updateOrder'
  | 'paymentCredentials'
  | 'paymentSecret'
  | 'savePaymentCredentials'
  | 'contacts'
  | 'upsertContact'
  | 'createClaimToken'
  | 'consumeClaimToken'
>;

function checkOffer(db: Db, row: Offer): void {
  if (!SLUG_PATTERN.test(row.slug)) throw new ConstraintError(`invalid slug: ${JSON.stringify(row.slug)}`);
  if (db.offers.some((o) => o.spaceId === row.spaceId && o.id !== row.id && o.slug === row.slug)) {
    throw new ConstraintError(`slug taken: ${row.slug}`);
  }
  if (!Number.isInteger(row.priceCents) || row.priceCents < 0 || row.priceCents > MAX_PRICE_CENTS) {
    throw new ConstraintError('price out of range');
  }
  const terms = recurringTermsError(row);
  if (terms) throw new ConstraintError(terms === 'trial' ? OFFER_TRIAL_DAYS : OFFER_TERMS);
  for (const link of [row.bumpOfferId, row.upsellOfferId]) {
    if (link === null) continue;
    if (link === row.id) throw new ConstraintError(OFFER_LINK_SELF);
    if (db.offers.find((o) => o.id === link)?.spaceId !== row.spaceId) throw new ConstraintError(OFFER_LINK_SPACE);
  }
}

function checkOrder(db: Db, row: Order): void {
  const others = db.orders.filter((o) => o.provider === row.provider && o.id !== row.id);
  if (others.some((o) => o.providerOrderId === row.providerOrderId)) throw new ConstraintError('provider order id taken');
  if (row.captureId !== null && others.some((o) => o.captureId === row.captureId)) throw new ConstraintError('capture id taken');
  if ((row.couponId === null && row.discountCents !== 0) || (row.bumpOfferId === null && row.bumpCents !== 0)) {
    throw new ConstraintError(ORDER_EXTRAS);
  }
  if (row.couponId !== null && db.coupons.find((c) => c.id === row.couponId)?.spaceId !== row.spaceId) {
    throw new ConstraintError('coupon not in order space');
  }
  if (row.bumpOfferId !== null && db.offers.find((o) => o.id === row.bumpOfferId)?.spaceId !== row.spaceId) {
    throw new ConstraintError('bump offer not in order space');
  }
}

export function createFakeCommerceRepo(db: Db, id: (prefix: string) => string): CommerceRepo {
  const findOffer = (oid: string): Offer => {
    const row = db.offers.find((o) => o.id === oid);
    if (!row) throw new Error('offer not found');
    return row;
  };
  const findOrder = (oid: string): Order => {
    const row = db.orders.find((o) => o.id === oid);
    if (!row) throw new Error('order not found');
    return row;
  };

  return {
    offers: async (spaceId) =>
      db.offers.filter((o) => o.spaceId === spaceId).toSorted((a, b) => a.title.localeCompare(b.title)),
    offer: async (oid) => db.offers.find((o) => o.id === oid) ?? null,
    offerBySlug: async (spaceId, slug) => db.offers.find((o) => o.spaceId === spaceId && o.slug === slug) ?? null,
    async createOffer(input) {
      const row: Offer = {
        ...input,
        id: id('offer'),
        description: null,
        status: 'draft',
        bumpOfferId: null,
        upsellOfferId: null,
        kind: 'one_time',
        billingInterval: null,
        trialDays: null,
        installments: null,
      };
      checkOffer(db, row);
      db.offers.push(row);
      return row;
    },
    async updateOffer(oid, patch) {
      const row = findOffer(oid);
      checkOffer(db, { ...row, ...patch });
      return Object.assign(row, patch);
    },
    async deleteOffer(oid) {
      if (db.orders.some((o) => o.offerId === oid || o.bumpOfferId === oid)) throw new ConstraintError('offer has orders');
      if (db.subscriptions.some((s) => s.offerId === oid)) throw new ConstraintError(OFFER_HAS_SUBSCRIPTIONS);
      db.providerPlans = db.providerPlans.filter((p) => p.offerId !== oid);
      for (const o of db.offers) {
        if (o.bumpOfferId === oid) o.bumpOfferId = null;
        if (o.upsellOfferId === oid) o.upsellOfferId = null;
      }
      for (const c of db.coupons) c.offerIds = c.offerIds.filter((x) => x !== oid);
      db.offerProducts = db.offerProducts.filter((op) => op.offerId !== oid);
      db.offers = db.offers.filter((o) => o.id !== oid);
    },
    offerItems: async (oid) =>
      db.offerProducts.filter((op) => op.offerId === oid).map(({ productId, accessGroupId }) => ({ productId, accessGroupId })),
    async setOfferItems(oid, items) {
      const row = findOffer(oid);
      for (const item of items) {
        const product = db.products.find((p) => p.id === item.productId);
        if (!product || product.spaceId !== row.spaceId) throw new ConstraintError('product not in offer space');
        if (item.accessGroupId !== null && db.accessGroups.find((g) => g.id === item.accessGroupId)?.communityId !== product.id) {
          throw new ConstraintError('access group must belong to its community');
        }
      }
      const byProduct = new Map(items.map((i) => [i.productId, i.accessGroupId]));
      db.offerProducts = [
        ...db.offerProducts.filter((op) => op.offerId !== oid),
        ...[...byProduct].map(([productId, accessGroupId]) => ({ offerId: oid, productId, accessGroupId })),
      ];
    },

    orders: async (spaceId) =>
      db.orders.filter((o) => o.spaceId === spaceId).toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    order: async (oid) => db.orders.find((o) => o.id === oid) ?? null,
    orderByProviderId: async (provider, providerOrderId) =>
      db.orders.find((o) => o.provider === provider && o.providerOrderId === providerOrderId) ?? null,
    orderByCaptureId: async (provider, captureId) =>
      db.orders.find((o) => o.provider === provider && o.captureId === captureId) ?? null,
    async createOrder(input) {
      findOffer(input.offerId);
      const row: Order = {
        couponId: null,
        discountCents: 0,
        bumpOfferId: null,
        bumpCents: 0,
        ...input,
        email: input.email.toLowerCase(),
        id: id('order'),
        profileId: null,
        captureId: null,
        status: 'created',
        paidAt: null,
      };
      checkOrder(db, row);
      db.orders.push(row);
      return row;
    },
    async updateOrder(oid, patch) {
      const row = findOrder(oid);
      checkOrder(db, { ...row, ...patch });
      return Object.assign(row, patch);
    },

    paymentCredentials: async (spaceId, env) =>
      db.paymentCredentials.find((c) => c.spaceId === spaceId && c.env === env) ?? null,
    paymentSecret: async (spaceId, env) =>
      db.paymentSecrets.find((c) => c.spaceId === spaceId && c.env === env)?.secret ?? null,
    async savePaymentCredentials(row, secret) {
      const other = (c: { spaceId: string; env: string }) => !(c.spaceId === row.spaceId && c.env === row.env);
      db.paymentCredentials = [...db.paymentCredentials.filter(other), row];
      if (secret !== null) db.paymentSecrets = [...db.paymentSecrets.filter(other), { spaceId: row.spaceId, env: row.env, secret }];
    },

    contacts: async (spaceId) =>
      db.contacts.filter((c) => c.spaceId === spaceId).toSorted((a, b) => a.email.localeCompare(b.email)),
    async upsertContact({ spaceId, email, profileId, consent }) {
      const key = email.toLowerCase();
      let row = db.contacts.find((c) => c.spaceId === spaceId && c.email === key);
      if (!row) {
        row = { spaceId, email: key, profileId: null, marketingConsent: false, consentAt: null, consentSource: null, createdAt: new Date() } satisfies Contact;
        db.contacts.push(row);
      }
      if (profileId) row.profileId = profileId;
      if (consent && !row.marketingConsent) {
        Object.assign(row, { marketingConsent: true, consentAt: consent.at, consentSource: consent.source });
      }
      return row;
    },

    async createClaimToken(row) {
      if (db.claimTokens.some((t) => t.tokenHash === row.tokenHash)) throw new ConstraintError('claim token exists');
      db.claimTokens.push({ ...row });
    },
    async consumeClaimToken(spaceId, tokenHash, now) {
      const row = db.claimTokens.find((t) => t.tokenHash === tokenHash && t.spaceId === spaceId);
      if (!row || row.usedAt !== null || row.expiresAt <= now) return null;
      row.usedAt = now;
      return { ...row };
    },
  };
}
