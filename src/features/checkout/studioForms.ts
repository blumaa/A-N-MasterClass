// Studio commerce forms -> typed DAL inputs. Price text becomes cents here (DAL takes cents).
import { CURRENCIES, parsePrice } from '@/lib/commerce/money';
import { BILLING_INTERVALS, OFFER_KINDS, PAYMENT_ENVS } from '@/lib/data/types';
import { FormError, formReader, parseForm, type FormReader } from '@/lib/forms/formReader';
import { titleAndSlug } from '@/lib/forms/commands';
import type { OfferCommand, OfferTerms } from './api/offers';
import type { PaymentsInput } from './api/payments';

const OPS: readonly OfferCommand['op'][] = ['create', 'update', 'setProducts', 'setLinks', 'publish', 'unpublish', 'delete'];

function price(r: FormReader): number {
  const cents = parsePrice(r.required('price'));
  if (cents === null) throw new FormError('Enter a price like 49 or 49.95.');
  return cents;
}

function count(r: FormReader, name: string): number | null {
  const v = r.raw(name);
  if (!v) return null;
  if (!/^\d+$/.test(v)) throw new FormError('Enter whole numbers for trial days and payments.');
  return Number(v);
}

/** Price type (G5). Only this type's fields are kept; others are ignored if sent. */
function terms(r: FormReader): OfferTerms {
  const kind = r.oneOf('kind', OFFER_KINDS);
  if (kind === 'one_time') return { kind, billingInterval: null, trialDays: null, installments: null };
  const billingInterval = r.oneOf('interval', BILLING_INTERVALS);
  if (kind === 'subscription') return { kind, billingInterval, trialDays: count(r, 'trialDays'), installments: null };
  const installments = count(r, 'installments');
  if (installments === null) throw new FormError('Enter the number of payments.');
  return { kind, billingInterval, trialDays: null, installments };
}

function parseOffer(form: FormData): OfferCommand {
  const r = formReader(form);
  const op = r.oneOf('op', OPS);
  if (op === 'create') {
    return { op, ...titleAndSlug(r), priceCents: price(r), currency: r.oneOf('currency', CURRENCIES) };
  }
  const offerId = r.required('offerId');
  switch (op) {
    case 'update':
      return {
        op,
        offerId,
        title: r.required('title'),
        slug: r.required('slug'),
        priceCents: price(r),
        currency: r.oneOf('currency', CURRENCIES),
        description: r.raw('description') ?? '',
        terms: terms(r),
      };
    case 'setProducts':
      return {
        op,
        offerId,
        items: form
          .getAll('productId')
          .filter((v): v is string => typeof v === 'string')
          .map((productId) => ({ productId, accessGroupId: r.raw(`group:${productId}`) || null })),
      };
    case 'setLinks':
      return { op, offerId, bumpOfferId: r.raw('bumpOfferId') || null, upsellOfferId: r.raw('upsellOfferId') || null };
    case 'publish':
    case 'unpublish':
    case 'delete':
      return { op, offerId };
  }
}

export function offerCommandFromForm(form: FormData): { ok: true; command: OfferCommand } | { ok: false; message: string } {
  const parsed = parseForm(() => parseOffer(form));
  return parsed.ok ? { ok: true, command: parsed.value } : parsed;
}

export function paymentsInputFromForm(form: FormData): ReturnType<typeof parseForm<PaymentsInput>> {
  return parseForm(() => {
    const r = formReader(form);
    return { env: r.oneOf('env', PAYMENT_ENVS), clientId: r.raw('clientId') ?? '', secret: r.raw('secret') ?? '', webhookId: r.raw('webhookId') ?? '' };
  });
}
