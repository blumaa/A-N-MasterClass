// Checkout DAL (G4, G23, G25, G28). Public: no viewer needed, the buyer may be a guest.
// Price and currency always come from the offer row, never from the client.
import { randomUUID } from 'node:crypto';
import { WAIVER_VERSION } from '@/lib/commerce/waiver';
import type { Repo } from '@/lib/data/repo';
import type { Currency, PaymentEnv } from '@/lib/data/types';
import type { ProviderChoice } from '@/lib/payments/forSpace';
import type { PaymentProvider } from '@/lib/payments/provider';
import { isEmail, normalizeEmail } from '@/lib/text/email';
import { fulfilOrder, type FulfilResult } from './fulfil';

export type CheckoutOffer = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  priceCents: number;
  currency: Currency;
  products: string[];
};

export type CheckoutInput = { offerSlug: string; email: string; waiverAccepted: boolean; marketingConsent: boolean };

type Invalid = { ok: false; error: 'invalid'; message: string };
type NotFound = { ok: false; error: 'not_found' };

export type StartResult =
  | { ok: true; kind: 'provider'; providerOrderId: string }
  | { ok: true; kind: 'fulfilled'; fulfilment: FulfilResult }
  | Invalid
  | NotFound;

/** env = current credential env (G10): free orders on staging must not count as live. */
export type CheckoutDeps = { resolveProvider: () => Promise<ProviderChoice>; env: PaymentEnv };

export type CompleteResult = { ok: true; fulfilment: FulfilResult } | NotFound;

const invalid = (message: string): Invalid => ({ ok: false, error: 'invalid', message });

export async function checkoutOffer(repo: Repo, spaceId: string, slug: string): Promise<CheckoutOffer | null> {
  const offer = await repo.offerBySlug(spaceId, slug);
  if (!offer || offer.status !== 'published') return null;
  const products = await Promise.all((await repo.offerItems(offer.id)).map((item) => repo.product(item.productId)));
  return {
    id: offer.id,
    slug: offer.slug,
    title: offer.title,
    description: offer.description,
    priceCents: offer.priceCents,
    currency: offer.currency,
    products: products.flatMap((p) => (p ? [p.title] : [])),
  };
}

export async function startCheckout(
  repo: Repo,
  deps: CheckoutDeps,
  spaceId: string,
  input: CheckoutInput,
  now: Date,
): Promise<StartResult> {
  const email = normalizeEmail(input.email);
  if (!isEmail(email)) return invalid('Enter a valid email address.');
  if (!input.waiverAccepted) return invalid('Please confirm the withdrawal waiver to continue.');
  const offer = await checkoutOffer(repo, spaceId, input.offerSlug);
  if (!offer) return { ok: false, error: 'not_found' };

  const order = {
    spaceId,
    offerId: offer.id,
    email,
    amountCents: offer.priceCents,
    currency: offer.currency,
    waiverVersion: WAIVER_VERSION,
    waiverAcceptedAt: now,
    marketingConsent: input.marketingConsent,
    createdAt: now,
  };

  if (offer.priceCents === 0) {
    const row = await repo.createOrder({ ...order, provider: 'free', providerOrderId: `free-${randomUUID()}`, livemode: deps.env === 'live' });
    return { ok: true, kind: 'fulfilled', fulfilment: await fulfilOrder(repo, row, null, now) };
  }

  const choice = await deps.resolveProvider();
  if (choice.kind === 'not_set_up') return invalid('Payments are not set up for this site yet.');
  const providerOrderId = await choice.provider.createOrder({
    amountCents: offer.priceCents,
    currency: offer.currency,
    description: offer.title,
    referenceId: offer.id,
    requestId: randomUUID(),
  });
  await repo.createOrder({ ...order, provider: choice.provider.name, providerOrderId, livemode: choice.livemode });
  return { ok: true, kind: 'provider', providerOrderId };
}

/** Called after the buyer approved. Capture is keyed on our order id, so a retry never charges twice. */
export async function completeCheckout(
  repo: Repo,
  provider: PaymentProvider,
  spaceId: string,
  providerOrderId: string,
  now: Date,
): Promise<CompleteResult> {
  const order = await repo.orderByProviderId(provider.name, providerOrderId);
  if (!order || order.spaceId !== spaceId) return { ok: false, error: 'not_found' };
  if (order.status !== 'created') return { ok: true, fulfilment: await fulfilOrder(repo, order, null, now) };
  const capture = await provider.captureOrder(providerOrderId, `capture-${order.id}`);
  return { ok: true, fulfilment: await fulfilOrder(repo, order, capture, now) };
}
