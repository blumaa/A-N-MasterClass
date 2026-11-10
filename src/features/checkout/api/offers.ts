// Studio offers DAL (G13, G23): CRUD, linked products, publish. offers.manage only (G15).
// Price arrives as cents (the form parser turns "49,95" into 4995); slug/price limits are
// enforced by the repo constraint and reported as invalid.
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { Currency } from '@/lib/commerce/money';
import type { CommandResult } from '@/lib/data/commandResult';
import { ConstraintError } from '@/lib/data/errors';
import type { Repo } from '@/lib/data/repo';
import type { Offer, ProductKind } from '@/lib/data/types';

export type StudioOfferRow = { offer: Offer; productCount: number; sold: number };
export type StudioOfferDetail = {
  offer: Offer;
  productIds: string[];
  products: { id: string; title: string; kind: ProductKind }[];
};

type Fields = { title: string; slug: string; priceCents: number; currency: Currency };

export type OfferCommand =
  | ({ op: 'create' } & Fields)
  | ({ op: 'update'; offerId: string; description: string } & Fields)
  | { op: 'setProducts'; offerId: string; productIds: string[] }
  | { op: 'publish' | 'unpublish' | 'delete'; offerId: string };

const OK: CommandResult = { ok: true };
const invalid = (message: string): CommandResult => ({ ok: false, error: 'invalid', message });

export async function studioOffers(repo: Repo, viewer: Viewer): Promise<StudioOfferRow[] | null> {
  if (!viewerCan(viewer, 'offers.manage')) return null;
  const [offers, orders] = await Promise.all([repo.offers(viewer.space.id), repo.orders(viewer.space.id)]);
  const productIds = await Promise.all(offers.map((o) => repo.offerProductIds(o.id)));
  const sold = new Map<string, number>();
  for (const o of orders) if (o.status !== 'created') sold.set(o.offerId, (sold.get(o.offerId) ?? 0) + 1);
  return offers.map((offer, i) => ({ offer, productCount: productIds[i]!.length, sold: sold.get(offer.id) ?? 0 }));
}

async function ownOffer(repo: Repo, viewer: Viewer, offerId: string): Promise<Offer | null> {
  const offer = await repo.offer(offerId);
  return offer && offer.spaceId === viewer.space.id ? offer : null;
}

export async function studioOffer(repo: Repo, viewer: Viewer, offerId: string): Promise<StudioOfferDetail | null> {
  if (!viewerCan(viewer, 'offers.manage')) return null;
  const offer = await ownOffer(repo, viewer, offerId);
  if (!offer) return null;
  const [productIds, products] = await Promise.all([repo.offerProductIds(offer.id), repo.products(viewer.space.id)]);
  return { offer, productIds, products: products.map((p) => ({ id: p.id, title: p.title, kind: p.kind })) };
}

export async function editOffers(repo: Repo, viewer: Viewer, cmd: OfferCommand): Promise<CommandResult> {
  if (!viewerCan(viewer, 'offers.manage')) return { ok: false, error: 'forbidden' };
  try {
    if (cmd.op === 'create') {
      const title = cmd.title.trim();
      if (!title) return invalid('Title is required.');
      const offer = await repo.createOffer({ spaceId: viewer.space.id, title, slug: cmd.slug, priceCents: cmd.priceCents, currency: cmd.currency });
      return { ok: true, id: offer.id };
    }
    const offer = await ownOffer(repo, viewer, cmd.offerId);
    if (!offer) return { ok: false, error: 'not_found' };
    return await apply(repo, offer, cmd);
  } catch (e) {
    if (e instanceof ConstraintError) return invalid(constraintMessage(e));
    throw e;
  }
}

async function apply(repo: Repo, offer: Offer, cmd: Exclude<OfferCommand, { op: 'create' }>): Promise<CommandResult> {
  switch (cmd.op) {
    case 'update': {
      const title = cmd.title.trim();
      if (!title) return invalid('Title is required.');
      await repo.updateOffer(offer.id, {
        title,
        slug: cmd.slug,
        description: cmd.description.trim() || null,
        priceCents: cmd.priceCents,
        currency: cmd.currency,
      });
      return OK;
    }
    case 'setProducts':
      if (offer.status === 'published' && cmd.productIds.length === 0) {
        return invalid('A published offer needs at least one product. Unpublish it first.');
      }
      await repo.setOfferProducts(offer.id, cmd.productIds);
      return OK;
    case 'publish':
      if ((await repo.offerProductIds(offer.id)).length === 0) return invalid('Link at least one product before publishing.');
      await repo.updateOffer(offer.id, { status: 'published' });
      return OK;
    case 'unpublish':
      await repo.updateOffer(offer.id, { status: 'draft' });
      return OK;
    case 'delete':
      await repo.deleteOffer(offer.id);
      return OK;
  }
}

function constraintMessage(e: ConstraintError): string {
  if (/slug taken/.test(e.message)) return 'Another offer already uses this address.';
  if (/invalid slug/.test(e.message)) return 'Use lowercase letters, numbers and dashes for the address.';
  if (/price/.test(e.message)) return 'Enter a price between 0 and 99,999.99.';
  if (/orders/.test(e.message)) return 'This offer has orders and cannot be deleted. Unpublish it instead.';
  if (/space/.test(e.message)) return 'Pick products of this site only.';
  return e.message;
}
