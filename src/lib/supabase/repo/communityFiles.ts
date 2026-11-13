// Supabase Repo: post photo rows. Mirrors src/lib/data/fake/fakeCommunityFiles.ts.
import type { Repo } from '@/lib/data/repo';
import type { PostPhoto } from '@/lib/data/types';
import { check, nextPosition, unwrap, type Row, type RepoCtx } from './context';

type FilesRepo = Pick<Repo, 'postPhotos' | 'addPostPhotos' | 'deletePostPhoto'>;

const toPostPhoto = (r: Row<'post_photos'>): PostPhoto => ({ id: r.id, postId: r.post_id, path: r.path, thumbPath: r.thumb_path, position: r.position });

// No admin(): runs as the caller; RLS and the post_photos_check trigger decide.
export function createCommunityFilesRepo({ db }: RepoCtx): FilesRepo {
  return {
    async postPhotos(postIds) {
      if (postIds.length === 0) return [];
      const rows = unwrap(
        await (await db()).from('post_photos').select('*').in('post_id', [...postIds]).order('position').order('id'),
      );
      return rows.map(toPostPhoto);
    },
    async addPostPhotos(postId, photos) {
      if (photos.length === 0) return [];
      const client = await db();
      const start = await nextPosition(client, 'post_photos', 'post_id', postId);
      const rows = unwrap(
        await client
          .from('post_photos')
          .insert(photos.map((p, i) => ({ post_id: postId, path: p.path, thumb_path: p.thumbPath, position: start + i })))
          .select('*'),
      );
      return rows.map(toPostPhoto).toSorted((a, b) => a.position - b.position);
    },
    async deletePostPhoto(id) {
      check(await (await db()).from('post_photos').delete().eq('id', id));
    },
  };
}
