// Client side of non-program products (G18): which products of a kind the viewer holds, and the
// access state of one product page. Drafts are visible to editors only (preview).
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { Repo } from './repo';
import type { Product, ProductKind } from './types';

/** Library section: published products of one kind the viewer holds an active grant for. */
export async function heldProducts(repo: Repo, viewer: Viewer, kind: ProductKind, now: Date): Promise<Product[]> {
  const me = viewer.profile?.id;
  if (!me) return [];
  const products = (await repo.products(viewer.space.id)).filter((p) => p.kind === kind && p.status === 'published');
  const grants = await Promise.all(products.map((p) => repo.activeGrant(p.id, me, now)));
  return products.filter((_, i) => grants[i] !== null);
}

export type ProductPage = { product: Product; hasAccess: boolean; isEditor: boolean };

/** Product of `kind` at `slug` in the viewer's space; null when missing, another kind, or a draft for non-editors. */
export async function productPage(repo: Repo, viewer: Viewer, kind: ProductKind, slug: string, now: Date): Promise<ProductPage | null> {
  const product = await repo.productBySlug(viewer.space.id, slug);
  if (!product || product.kind !== kind) return null;
  const isEditor = viewerCan(viewer, 'products.edit');
  if (product.status !== 'published' && !isEditor) return null;
  const me = viewer.profile?.id;
  const hasAccess = me ? (await repo.activeGrant(product.id, me, now)) !== null : false;
  return { product, hasAccess, isEditor };
}
