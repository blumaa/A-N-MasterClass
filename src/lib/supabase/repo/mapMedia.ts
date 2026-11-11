// Row (snake_case, ISO strings) -> domain type for the podcast and download tables.
import type { Episode, EpisodeType, PodcastFeed, PodcastOrder, PodcastSettings, ProductFile } from '@/lib/data/types';
import { toDate, type Row } from './context';

export const toPodcastSettings = (r: Row<'podcast_settings'>): PodcastSettings => ({
  productId: r.product_id,
  author: r.author,
  explicit: r.explicit,
  order: r.episode_order as PodcastOrder,
});

export const toEpisode = (r: Row<'episodes'>): Episode => ({
  id: r.id,
  productId: r.product_id,
  title: r.title,
  type: r.type as EpisodeType,
  season: r.season,
  showNotes: r.show_notes,
  audioPath: r.audio_path,
  audioBytes: r.audio_bytes,
  durationS: r.duration_s,
  explicit: r.explicit,
  publishAt: r.publish_at === null ? null : toDate(r.publish_at),
  createdAt: toDate(r.created_at),
});

export const toPodcastFeed = (r: Row<'podcast_feeds'>): PodcastFeed => ({
  productId: r.product_id,
  profileId: r.profile_id,
  token: r.token,
  createdAt: toDate(r.created_at),
});

export const toProductFile = (r: Row<'product_files'>): ProductFile => ({
  id: r.id,
  productId: r.product_id,
  title: r.title,
  filePath: r.file_path,
  sizeBytes: r.size_bytes,
  createdAt: toDate(r.created_at),
});
