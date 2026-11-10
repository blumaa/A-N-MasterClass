// Podcast and download part of the fake repo. Same constraints as
// supabase/migrations/*_podcasts_downloads.sql.
import { randomUUID } from 'node:crypto';
import { ConstraintError } from '../errors';
import { grantIsActive } from '../grants';
import type { Repo } from '../repo';
import { EPISODE_MAX_BYTES, type Episode, type ProductFile, type ProductKind } from '../types';
import type { Db } from './db';

type MediaRepo = Pick<
  Repo,
  | 'podcastSettings'
  | 'savePodcastSettings'
  | 'episodes'
  | 'episode'
  | 'createEpisode'
  | 'updateEpisode'
  | 'deleteEpisode'
  | 'podcastFeedToken'
  | 'resetPodcastFeed'
  | 'podcastFeedByToken'
  | 'productFiles'
  | 'productFile'
  | 'createProductFile'
  | 'renameProductFile'
  | 'deleteProductFile'
>;

export const AUTHOR_MAX = 200;
export const SHOW_NOTES_MAX = 20_000;
const MP3 = /\.mp3$/i;

function check(ok: boolean, message: string): void {
  if (!ok) throw new ConstraintError(message);
}

const blank = (s: string) => s.trim().length === 0;

export function createFakeMediaRepo(db: Db, id: (prefix: string) => string): MediaRepo {
  const isKind = (productId: string, kind: ProductKind) => db.products.some((p) => p.id === productId && p.kind === kind);

  function checkEpisode(e: Episode): void {
    check(isKind(e.productId, 'podcast'), 'episodes belong to podcast products');
    check(!blank(e.title), 'title required');
    check(MP3.test(e.audioPath), 'audio must be an .mp3 file');
    check(Number.isInteger(e.audioBytes) && e.audioBytes > 0 && e.audioBytes <= EPISODE_MAX_BYTES, 'audio must be 1 byte to 250 MB');
    check(e.season === null || (Number.isInteger(e.season) && e.season >= 1), 'season must be 1 or more');
    check(e.durationS === null || (Number.isInteger(e.durationS) && e.durationS >= 0), 'duration must be 0 or more');
    check(e.showNotes.length <= SHOW_NOTES_MAX, 'show notes too long');
  }

  function checkFile(f: ProductFile): void {
    check(isKind(f.productId, 'download'), 'files belong to download products');
    check(!blank(f.title), 'title required');
    check(!blank(f.filePath), 'file path required');
    check(Number.isInteger(f.sizeBytes) && f.sizeBytes > 0, 'file must not be empty');
  }

  const hasGrant = (productId: string, profileId: string, now: Date) =>
    db.grants.some((g) => g.productId === productId && g.profileId === profileId && grantIsActive(g, now));

  const mustEpisode = (eid: string) => {
    const e = db.episodes.find((x) => x.id === eid);
    if (!e) throw new Error('episode not found');
    return e;
  };
  const mustFile = (fid: string) => {
    const f = db.productFiles.find((x) => x.id === fid);
    if (!f) throw new Error('file not found');
    return f;
  };

  return {
    podcastSettings: async (productId) => db.podcasts.find((p) => p.productId === productId) ?? null,
    async savePodcastSettings(row) {
      check(isKind(row.productId, 'podcast'), 'settings belong to podcast products');
      check(row.author.length <= AUTHOR_MAX, 'author too long');
      db.podcasts = [...db.podcasts.filter((p) => p.productId !== row.productId), { ...row, author: row.author.trim() }];
    },
    episodes: async (productId) =>
      db.episodes.filter((e) => e.productId === productId).toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
    episode: async (eid) => db.episodes.find((e) => e.id === eid) ?? null,
    async createEpisode(input) {
      const row: Episode = { ...input, id: id('ep'), title: input.title.trim() };
      checkEpisode(row);
      db.episodes.push(row);
      return row;
    },
    async updateEpisode(eid, patch) {
      const current = mustEpisode(eid);
      const next: Episode = { ...current, ...patch, title: (patch.title ?? current.title).trim() };
      checkEpisode(next);
      Object.assign(current, next);
      return current;
    },
    async deleteEpisode(eid) {
      db.episodes = db.episodes.filter((e) => e.id !== eid);
    },
    async podcastFeedToken(productId, profileId, now) {
      check(isKind(productId, 'podcast') && hasGrant(productId, profileId, now), 'an active grant is required');
      const found = db.podcastFeeds.find((f) => f.productId === productId && f.profileId === profileId);
      if (found) return found.token;
      const feed = { productId, profileId, token: randomUUID(), createdAt: now };
      db.podcastFeeds.push(feed);
      return feed.token;
    },
    async resetPodcastFeed(productId, profileId, now) {
      check(isKind(productId, 'podcast') && hasGrant(productId, profileId, now), 'an active grant is required');
      db.podcastFeeds = db.podcastFeeds.filter((f) => !(f.productId === productId && f.profileId === profileId));
      const feed = { productId, profileId, token: randomUUID(), createdAt: now };
      db.podcastFeeds.push(feed);
      return feed.token;
    },
    async podcastFeedByToken(token, now) {
      const feed = db.podcastFeeds.find((f) => f.token === token);
      return feed && hasGrant(feed.productId, feed.profileId, now) ? feed : null;
    },
    productFiles: async (productId) =>
      db.productFiles.filter((f) => f.productId === productId).toSorted((a, b) => a.createdAt.getTime() - b.createdAt.getTime()),
    productFile: async (fid) => db.productFiles.find((f) => f.id === fid) ?? null,
    async createProductFile(input) {
      const row: ProductFile = { ...input, id: id('file'), title: input.title.trim() };
      checkFile(row);
      db.productFiles.push(row);
      return row;
    },
    async renameProductFile(fid, title) {
      const current = mustFile(fid);
      checkFile({ ...current, title: title.trim() });
      current.title = title.trim();
      return current;
    },
    async deleteProductFile(fid) {
      db.productFiles = db.productFiles.filter((f) => f.id !== fid);
    },
  };
}
