// Supabase Repo: podcasts (settings, episodes, private feeds) and downloads (files).
// Semantics mirror src/lib/data/fake/fakeMediaRepo.ts; constraints come from the SQL schema
// (checks + the media_product_matches kind trigger, all class 23 -> ConstraintError).
import type { Repo } from '@/lib/data/repo';
import { check, defined, isoOrNull, unwrap, unwrapMaybe, type RepoCtx } from './context';
import { toEpisode, toPodcastFeed, toPodcastSettings, toProductFile } from './mapMedia';

export type MediaRepo = Pick<
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

export function createMediaRepo({ db, admin }: RepoCtx): MediaRepo {
  return {
    // podcast settings
    async podcastSettings(productId) {
      const row = unwrapMaybe(
        await (await db()).from('podcast_settings').select('*').eq('product_id', productId).maybeSingle(),
      );
      return row && toPodcastSettings(row);
    },
    async savePodcastSettings(s) {
      check(
        await (await db())
          .from('podcast_settings')
          .upsert(
            { product_id: s.productId, author: s.author.trim(), explicit: s.explicit, episode_order: s.order },
            { onConflict: 'product_id' },
          ),
      );
    },

    // episodes
    async episodes(productId) {
      return unwrap(
        await (await db()).from('episodes').select('*').eq('product_id', productId).order('created_at', { ascending: false }),
      ).map(toEpisode);
    },
    async episode(id) {
      const row = unwrapMaybe(await (await db()).from('episodes').select('*').eq('id', id).maybeSingle());
      return row && toEpisode(row);
    },
    async createEpisode(input) {
      const row = unwrap(
        await (await db())
          .from('episodes')
          .insert({
            product_id: input.productId,
            title: input.title.trim(),
            type: input.type,
            season: input.season,
            show_notes: input.showNotes,
            audio_path: input.audioPath,
            audio_bytes: input.audioBytes,
            duration_s: input.durationS,
            explicit: input.explicit,
            publish_at: isoOrNull(input.publishAt),
            created_at: input.createdAt.toISOString(),
          })
          .select('*')
          .single(),
      );
      return toEpisode(row);
    },
    async updateEpisode(id, p) {
      const row = unwrap(
        await (await db())
          .from('episodes')
          .update(
            defined({
              title: p.title?.trim(),
              type: p.type,
              season: p.season,
              show_notes: p.showNotes,
              audio_path: p.audioPath,
              audio_bytes: p.audioBytes,
              duration_s: p.durationS,
              explicit: p.explicit,
              publish_at: isoOrNull(p.publishAt),
            }),
          )
          .eq('id', id)
          .select('*')
          .single(),
      );
      return toEpisode(row);
    },
    async deleteEpisode(id) {
      check(await (await db()).from('episodes').delete().eq('id', id));
    },

    // private feeds. The RPCs read auth.uid() and now(), so profileId and now are implied by the
    // session: db() must be the listener's own client here.
    async podcastFeedToken(productId) {
      return unwrap(await (await db()).rpc('podcast_feed_token', { target_product: productId }));
    },
    async resetPodcastFeed(productId) {
      return unwrap(await (await db()).rpc('reset_podcast_feed', { target_product: productId }));
    },
    // The anonymous RSS reader has no session; podcast_feed() is granted to service_role only.
    async podcastFeedByToken(token) {
      const rows = unwrap(await admin().rpc('podcast_feed', { target_token: token }));
      return rows[0] ? toPodcastFeed(rows[0]) : null;
    },

    // downloads
    async productFiles(productId) {
      return unwrap(
        await (await db()).from('product_files').select('*').eq('product_id', productId).order('created_at', { ascending: true }),
      ).map(toProductFile);
    },
    async productFile(id) {
      const row = unwrapMaybe(await (await db()).from('product_files').select('*').eq('id', id).maybeSingle());
      return row && toProductFile(row);
    },
    async createProductFile(input) {
      const row = unwrap(
        await (await db())
          .from('product_files')
          .insert({
            product_id: input.productId,
            title: input.title.trim(),
            file_path: input.filePath,
            size_bytes: input.sizeBytes,
            created_at: input.createdAt.toISOString(),
          })
          .select('*')
          .single(),
      );
      return toProductFile(row);
    },
    async renameProductFile(id, title) {
      const row = unwrap(
        await (await db()).from('product_files').update({ title: title.trim() }).eq('id', id).select('*').single(),
      );
      return toProductFile(row);
    },
    async deleteProductFile(id) {
      check(await (await db()).from('product_files').delete().eq('id', id));
    },
  };
}
