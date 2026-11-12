// Studio side of podcasts (G18, Kajabi Podcasts): podcast products with show settings and every
// episode (drafts and scheduled included). Gate: products.edit (G15). Audio is uploaded first
// (requestUpload, FileUpload); a new path must sit in this podcast's folder of this space
// (isProductPath). DB triggers queue old audio for removal (storage_trash).
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import { ConstraintError } from '@/lib/data/errors';
import type { EpisodePatch, NewEpisode, ProductPatch, Repo } from '@/lib/data/repo';
import type { Episode, PodcastSettings, Product } from '@/lib/data/types';
import { isProductPath } from '@/lib/storage/uploadPath';
import { DEFAULT_PODCAST } from './listen';

export type StudioPodcast = { product: Product; settings: PodcastSettings; episodes: Episode[] };

export async function studioPodcasts(repo: Repo, viewer: Viewer): Promise<{ podcasts: StudioPodcast[] } | null> {
  if (!viewerCan(viewer, 'products.edit')) return null;
  const podcasts = (await repo.products(viewer.space.id)).filter((p) => p.kind === 'podcast');
  return {
    podcasts: await Promise.all(
      podcasts.map(async (product) => {
        const [settings, episodes] = await Promise.all([repo.podcastSettings(product.id), repo.episodes(product.id)]);
        return { product, settings: settings ?? { productId: product.id, ...DEFAULT_PODCAST }, episodes };
      }),
    ),
  };
}

export type PodcastCommand =
  | { op: 'createPodcast'; title: string; slug: string }
  | { op: 'updateProduct'; productId: string; patch: Pick<ProductPatch, 'title' | 'subtitle' | 'status'> }
  | ({ op: 'saveSettings' } & PodcastSettings)
  | ({ op: 'createEpisode' } & Omit<NewEpisode, 'createdAt'>)
  | { op: 'updateEpisode'; episodeId: string; patch: EpisodePatch }
  | { op: 'deleteEpisode'; episodeId: string };

const FORBIDDEN: CommandResult = { ok: false, error: 'forbidden' };
const NOT_FOUND: CommandResult = { ok: false, error: 'not_found' };

type Ctx = { repo: Repo; spaceId: string; now: Date };

const isPodcast = async (repo: Repo, spaceId: string, productId: string) => {
  const p = await repo.product(productId);
  return p !== null && p.kind === 'podcast' && p.spaceId === spaceId;
};

/** False when the op targets a row outside the viewer's space, of another kind, or missing. */
async function owns({ repo, spaceId }: Ctx, c: PodcastCommand): Promise<boolean> {
  switch (c.op) {
    case 'createPodcast':
      return true;
    case 'updateProduct':
    case 'saveSettings':
      return isPodcast(repo, spaceId, c.productId);
    case 'createEpisode':
      return isProductPath(c.audioPath, spaceId, c.productId) && isPodcast(repo, spaceId, c.productId);
    case 'updateEpisode':
    case 'deleteEpisode': {
      const e = await repo.episode(c.episodeId);
      if (e === null) return false;
      const path = c.op === 'updateEpisode' ? c.patch.audioPath : undefined;
      const pathOk = path === undefined || path === e.audioPath || isProductPath(path, spaceId, e.productId);
      return pathOk && isPodcast(repo, spaceId, e.productId);
    }
  }
}

async function run({ repo, spaceId, now }: Ctx, c: PodcastCommand): Promise<string | undefined> {
  switch (c.op) {
    case 'createPodcast': {
      const product = await repo.createProduct({ spaceId, kind: 'podcast', slug: c.slug, title: c.title });
      await repo.savePodcastSettings({ productId: product.id, ...DEFAULT_PODCAST });
      return product.id;
    }
    case 'updateProduct':
      return void (await repo.updateProduct(c.productId, c.patch));
    case 'saveSettings': {
      const { op: _op, ...row } = c;
      return void (await repo.savePodcastSettings(row));
    }
    case 'createEpisode': {
      const { op: _op, ...row } = c;
      return (await repo.createEpisode({ ...row, createdAt: now })).id;
    }
    case 'updateEpisode':
      return void (await repo.updateEpisode(c.episodeId, c.patch));
    case 'deleteEpisode':
      return void (await repo.deleteEpisode(c.episodeId));
  }
}

export async function editPodcasts(repo: Repo, viewer: Viewer, c: PodcastCommand, now: Date): Promise<CommandResult> {
  if (!viewer.profile || !viewerCan(viewer, 'products.edit')) return FORBIDDEN;
  const ctx: Ctx = { repo, spaceId: viewer.space.id, now };
  if (!(await owns(ctx, c))) return NOT_FOUND;
  try {
    return { ok: true, id: await run(ctx, c) };
  } catch (e) {
    if (e instanceof ConstraintError) return { ok: false, error: 'invalid', message: e.message };
    throw e;
  }
}
