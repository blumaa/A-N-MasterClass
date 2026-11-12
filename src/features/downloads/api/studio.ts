// Studio side of downloads (G18): download products and their files. Gate: products.edit (G15).
// Files are uploaded first (requestUpload, FileUpload); the form saves the path + size. A path must sit
// in this product's folder of this space (isProductPath). Deleting a row removes its object after the DB write.
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import { ConstraintError } from '@/lib/data/errors';
import type { NewProductFile, ProductPatch, Repo } from '@/lib/data/repo';
import type { Product, ProductFile } from '@/lib/data/types';
import type { FileStore } from '@/lib/storage/fileStore';
import { isProductPath } from '@/lib/storage/uploadPath';

export type StudioDownload = { product: Product; files: ProductFile[] };

export async function studioDownloads(repo: Repo, viewer: Viewer): Promise<{ downloads: StudioDownload[] } | null> {
  if (!viewerCan(viewer, 'products.edit')) return null;
  const products = (await repo.products(viewer.space.id)).filter((p) => p.kind === 'download');
  return { downloads: await Promise.all(products.map(async (product) => ({ product, files: await repo.productFiles(product.id) }))) };
}

export type DownloadCommand =
  | { op: 'createDownload'; title: string; slug: string }
  | { op: 'updateProduct'; productId: string; patch: Pick<ProductPatch, 'title' | 'subtitle' | 'status'> }
  | ({ op: 'addFile' } & Omit<NewProductFile, 'createdAt'>)
  | { op: 'renameFile'; fileId: string; title: string }
  | { op: 'deleteFile'; fileId: string };

const FORBIDDEN: CommandResult = { ok: false, error: 'forbidden' };
const NOT_FOUND: CommandResult = { ok: false, error: 'not_found' };

type Ctx = { repo: Repo; files: FileStore; spaceId: string; now: Date };

const isDownload = async (repo: Repo, spaceId: string, productId: string) => {
  const p = await repo.product(productId);
  return p !== null && p.kind === 'download' && p.spaceId === spaceId;
};

/** False when the op targets a row outside the viewer's space, of another kind, or missing. */
async function owns({ repo, spaceId }: Ctx, c: DownloadCommand): Promise<boolean> {
  switch (c.op) {
    case 'createDownload':
      return true;
    case 'updateProduct':
      return isDownload(repo, spaceId, c.productId);
    case 'addFile':
      return isProductPath(c.filePath, spaceId, c.productId) && isDownload(repo, spaceId, c.productId);
    case 'renameFile':
    case 'deleteFile': {
      const f = await repo.productFile(c.fileId);
      return f !== null && isDownload(repo, spaceId, f.productId);
    }
  }
}

async function run({ repo, files, spaceId, now }: Ctx, c: DownloadCommand): Promise<string | undefined> {
  switch (c.op) {
    case 'createDownload':
      return (await repo.createProduct({ spaceId, kind: 'download', slug: c.slug, title: c.title })).id;
    case 'updateProduct':
      return void (await repo.updateProduct(c.productId, c.patch));
    case 'addFile': {
      const { op: _op, ...row } = c;
      return (await repo.createProductFile({ ...row, createdAt: now })).id;
    }
    case 'renameFile':
      return void (await repo.renameProductFile(c.fileId, c.title));
    case 'deleteFile': {
      const file = await repo.productFile(c.fileId);
      await repo.deleteProductFile(c.fileId);
      return void (file && (await files.remove([file.filePath])));
    }
  }
}

export async function editDownloads(repo: Repo, files: FileStore, viewer: Viewer, c: DownloadCommand, now: Date): Promise<CommandResult> {
  if (!viewer.profile || !viewerCan(viewer, 'products.edit')) return FORBIDDEN;
  const ctx: Ctx = { repo, files, spaceId: viewer.space.id, now };
  if (!(await owns(ctx, c))) return NOT_FOUND;
  try {
    return { ok: true, id: await run(ctx, c) };
  } catch (e) {
    if (e instanceof ConstraintError) return { ok: false, error: 'invalid', message: e.message };
    throw e;
  }
}
