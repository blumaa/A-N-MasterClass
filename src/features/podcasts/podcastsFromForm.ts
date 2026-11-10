// Podcast studio forms -> commands. Publish time is a datetime-local in `timeZone`; blank = draft.
// Season blank = none; length (durationS) typed as h:mm:ss or m:ss, blank = unknown.
import { flag, parser, productPatch, readDuration, readInstant, readWhole, titleAndSlug } from '@/lib/forms/commands';
import type { FormReader as Reader } from '@/lib/forms/formReader';
import type { NewEpisode } from '@/lib/data/repo';
import { EPISODE_TYPES, PODCAST_ORDERS } from '@/lib/data/types';
import type { PodcastCommand } from './api/studio';

const season = (r: Reader): number | null => (r.raw('season') ? readWhole(r, 'season', 'season') : null);
const publishAt = (r: Reader): Date | null => (r.raw('publishAt') ? readInstant(r, 'publishAt', 'publish time') : null);

type EpisodeFields = Omit<NewEpisode, 'productId' | 'createdAt'>;

/** One reader per episode field; the form field carries the same name. */
const EPISODE: { [K in keyof EpisodeFields]: (r: Reader) => EpisodeFields[K] } = {
  title: (r) => r.required('title'),
  type: (r) => r.oneOf('type', EPISODE_TYPES),
  season,
  showNotes: (r) => r.raw('showNotes') ?? '',
  audioPath: (r) => r.required('audioPath'),
  audioBytes: (r) => readWhole(r, 'audioBytes', 'file size'),
  durationS: (r) => readDuration(r, 'durationS'),
  explicit: (r) => flag(r, 'explicit'),
  publishAt,
};
const FIELDS = Object.keys(EPISODE) as (keyof EpisodeFields)[];

const episode = (r: Reader) => Object.fromEntries(FIELDS.map((k) => [k, EPISODE[k](r)])) as EpisodeFields;
const episodePatch = (r: Reader) =>
  Object.fromEntries(FIELDS.flatMap((k) => (r.raw(k) === undefined ? [] : [[k, EPISODE[k](r)]]))) as Partial<EpisodeFields>;

const STUDIO: Record<PodcastCommand['op'], (r: Reader) => PodcastCommand> = {
  createPodcast: (r) => ({ op: 'createPodcast', ...titleAndSlug(r) }),
  updateProduct: (r) => ({ op: 'updateProduct', productId: r.required('productId'), patch: productPatch(r) }),
  saveSettings: (r) => ({
    op: 'saveSettings',
    productId: r.required('productId'),
    author: r.raw('author') ?? '',
    explicit: flag(r, 'explicit'),
    order: r.oneOf('order', PODCAST_ORDERS),
  }),
  createEpisode: (r) => ({ op: 'createEpisode', productId: r.required('productId'), ...episode(r) }),
  updateEpisode: (r) => ({
    op: 'updateEpisode',
    episodeId: r.required('episodeId'),
    patch: episodePatch(r),
  }),
  deleteEpisode: (r) => ({ op: 'deleteEpisode', episodeId: r.required('episodeId') }),
};

export const podcastCommandFromForm = parser<PodcastCommand>(STUDIO);
