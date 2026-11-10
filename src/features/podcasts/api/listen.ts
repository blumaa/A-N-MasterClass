// Listener side of podcasts (G18, Kajabi private podcasts): the podcast page, the audio redirect,
// and the private RSS feed. Holders hear released episodes (publishAt reached); editors hear all.
// Each holder gets one feed token; the feed works only while their grant is active (Kajabi: access
// removed = feed stops), and resetting it kills the old URL.
import type { Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import { ConstraintError } from '@/lib/data/errors';
import { heldProducts, productPage, type ProductPage } from '@/lib/data/held';
import type { Repo } from '@/lib/data/repo';
import type { Episode, PodcastOrder, PodcastSettings, Product } from '@/lib/data/types';
import { feedEpisodeHref, feedHref, podcastHref } from '../paths';
import { podcastRss } from './rss';

export const DEFAULT_PODCAST: Omit<PodcastSettings, 'productId'> = { author: '', explicit: false, order: 'episodic' };

export const released = (e: Pick<Episode, 'publishAt'>, now: Date): boolean => e.publishAt !== null && e.publishAt <= now;

const time = (d: Date | null): number => d?.getTime() ?? Number.POSITIVE_INFINITY;

/** Episodic: newest first. Serial: by season, then oldest first (Apple itunes:type). Undated drafts sort as "latest". */
export function orderEpisodes<E extends Pick<Episode, 'season' | 'publishAt'>>(episodes: E[], order: PodcastOrder): E[] {
  return order === 'episodic'
    ? episodes.toSorted((a, b) => time(b.publishAt) - time(a.publishAt))
    : episodes.toSorted((a, b) => (a.season ?? 0) - (b.season ?? 0) || time(a.publishAt) - time(b.publishAt));
}

export type ClientEpisode = Omit<Episode, 'audioPath' | 'productId'> & { released: boolean };

export type ClientPodcast = ProductPage & {
  settings: PodcastSettings;
  episodes: ClientEpisode[];
  /** Holders only: absolute private feed URL for podcast apps. */
  feedUrl: string | null;
};

const settingsOf = async (repo: Repo, productId: string): Promise<PodcastSettings> =>
  (await repo.podcastSettings(productId)) ?? { productId, ...DEFAULT_PODCAST };

export async function clientPodcast(repo: Repo, viewer: Viewer, slug: string, origin: string, now: Date): Promise<ClientPodcast | null> {
  const page = await productPage(repo, viewer, 'podcast', slug, now);
  if (!page) return null;
  const { product, hasAccess, isEditor } = page;
  const me = viewer.profile?.id;
  const [settings, all, token] = await Promise.all([
    settingsOf(repo, product.id),
    hasAccess || isEditor ? repo.episodes(product.id) : [],
    hasAccess && me ? repo.podcastFeedToken(product.id, me, now) : null,
  ]);
  const shown = isEditor ? all : all.filter((e) => released(e, now));
  const episodes = orderEpisodes(shown, settings.order).map(({ audioPath: _a, productId: _p, ...e }) => ({ ...e, released: released(e, now) }));
  return { ...page, settings, episodes, feedUrl: token ? origin + feedHref(token) : null };
}

export const myPodcasts = (repo: Repo, viewer: Viewer, now: Date): Promise<Product[]> => heldProducts(repo, viewer, 'podcast', now);

/** Storage path of an episode the viewer may hear on the podcast page; null otherwise. */
export async function episodeAudio(repo: Repo, viewer: Viewer, slug: string, episodeId: string, now: Date): Promise<string | null> {
  const page = await productPage(repo, viewer, 'podcast', slug, now);
  if (!page || !(page.hasAccess || page.isEditor)) return null;
  const episode = await repo.episode(episodeId);
  if (!episode || episode.productId !== page.product.id) return null;
  return page.isEditor || released(episode, now) ? episode.audioPath : null;
}

/** Podcast behind a feed token in this space: published, grant still active. */
async function feedPodcast(repo: Repo, spaceSlug: string, token: string, now: Date) {
  const [space, feed] = await Promise.all([repo.spaceBySlug(spaceSlug), repo.podcastFeedByToken(token, now)]);
  if (!space || !feed) return null;
  const product = await repo.product(feed.productId);
  if (!product || product.spaceId !== space.id || product.status !== 'published') return null;
  const [settings, episodes] = await Promise.all([settingsOf(repo, product.id), repo.episodes(product.id)]);
  return { space, product, settings, episodes: orderEpisodes(episodes.filter((e) => released(e, now)), settings.order) };
}

export async function feedXml(repo: Repo, spaceSlug: string, token: string, origin: string, now: Date): Promise<string | null> {
  const found = await feedPodcast(repo, spaceSlug, token, now);
  if (!found) return null;
  const { space, product, settings, episodes } = found;
  return podcastRss({
    title: product.title,
    description: product.subtitle ?? '',
    link: origin + podcastHref(product.slug),
    language: space.locale,
    author: settings.author || space.name,
    explicit: settings.explicit,
    order: settings.order,
    items: episodes.map((e) => ({
      guid: e.id,
      title: e.title,
      notes: e.showNotes,
      pubDate: e.publishAt!,
      url: origin + feedEpisodeHref(token, e.id),
      bytes: e.audioBytes,
      durationS: e.durationS,
      type: e.type,
      season: e.season,
    })),
  });
}

/** Storage path of a released episode reached through a feed token; null otherwise. */
export async function feedAudio(repo: Repo, spaceSlug: string, token: string, episodeId: string, now: Date): Promise<string | null> {
  const found = await feedPodcast(repo, spaceSlug, token, now);
  return found?.episodes.find((e) => e.id === episodeId)?.audioPath ?? null;
}

/** New private feed URL for the viewer; podcast apps on the old one stop updating. */
export async function resetFeed(repo: Repo, viewer: Viewer, productId: string, now: Date): Promise<CommandResult> {
  const me = viewer.profile?.id;
  if (!me) return { ok: false, error: 'forbidden' };
  const product = await repo.product(productId);
  if (!product || product.spaceId !== viewer.space.id) return { ok: false, error: 'not_found' };
  try {
    await repo.resetPodcastFeed(productId, me, now);
    return { ok: true };
  } catch (e) {
    if (e instanceof ConstraintError) return { ok: false, error: 'invalid', message: e.message };
    throw e;
  }
}
