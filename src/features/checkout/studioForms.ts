// Studio commerce forms -> typed DAL inputs. Price text becomes cents here (DAL takes cents).
import { CURRENCIES, parsePrice } from '@/lib/commerce/money';
import { PAYMENT_ENVS } from '@/lib/data/types';
import { FormError, formReader, parseForm, type FormReader } from '@/lib/forms/formReader';
import { slugify } from '@/lib/text/slugify';
import type { OfferCommand } from './api/offers';
import type { PaymentsInput } from './api/payments';

const OPS: readonly OfferCommand['op'][] = ['create', 'update', 'setProducts', 'publish', 'unpublish', 'delete'];

function price(r: FormReader): number {
  const cents = parsePrice(r.required('price'));
  if (cents === null) throw new FormError('Enter a price like 49 or 49.95.');
  return cents;
}

function parseOffer(form: FormData): OfferCommand {
  const r = formReader(form);
  const op = r.oneOf('op', OPS);
  if (op === 'create') {
    const title = r.required('title');
    return { op, title, slug: r.raw('slug') || slugify(title), priceCents: price(r), currency: r.oneOf('currency', CURRENCIES) };
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
      };
    case 'setProducts':
      return { op, offerId, productIds: form.getAll('productId').filter((v): v is string => typeof v === 'string') };
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
