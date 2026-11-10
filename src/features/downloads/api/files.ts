// Client side of downloads (G18, Kajabi Downloads): a download product's page listing its files
// (type + size), and the signed-download gate. Holders and editors (preview) get the files.
import type { Viewer } from '@/lib/auth/viewer';
import { heldProducts, productPage, type ProductPage } from '@/lib/data/held';
import type { Repo } from '@/lib/data/repo';
import type { Product } from '@/lib/data/types';
import { downloadName, fileType, formatBytes } from '@/lib/format/bytes';

export type ClientFile = { id: string; title: string; type: string; size: string };
export type ClientDownloads = ProductPage & { files: ClientFile[] };

export async function clientDownloads(repo: Repo, viewer: Viewer, slug: string, now: Date): Promise<ClientDownloads | null> {
  const page = await productPage(repo, viewer, 'download', slug, now);
  if (!page) return null;
  const files = page.hasAccess || page.isEditor ? await repo.productFiles(page.product.id) : [];
  return {
    ...page,
    files: files.map((f) => ({ id: f.id, title: f.title, type: fileType(f.filePath), size: formatBytes(f.sizeBytes) })),
  };
}

/** Storage path + save-as name of one file, or null when the viewer may not download it. */
export async function fileDownload(
  repo: Repo,
  viewer: Viewer,
  slug: string,
  fileId: string,
  now: Date,
): Promise<{ path: string; name: string } | null> {
  const page = await productPage(repo, viewer, 'download', slug, now);
  if (!page || !(page.hasAccess || page.isEditor)) return null;
  const file = await repo.productFile(fileId);
  if (!file || file.productId !== page.product.id) return null;
  return { path: file.filePath, name: downloadName(file.title, file.filePath) };
}

/** Library section: published download products the viewer holds an active grant for. */
export const myDownloads = (repo: Repo, viewer: Viewer, now: Date): Promise<Product[]> => heldProducts(repo, viewer, 'download', now);
