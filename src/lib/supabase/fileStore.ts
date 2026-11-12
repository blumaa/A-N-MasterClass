// FileStore on Supabase Storage, private bucket `resources`. Service client only: the bucket has
// no object policies, so only the server signs reads and uploads. Server only.
import 'server-only';
import { SIGNED_URL_TTL_S, type FileStore } from '@/lib/storage/fileStore';
import type { Db } from './server';

export const RESOURCES_BUCKET = 'resources';

export function createSupabaseFileStore(db: Db): FileStore {
  const bucket = () => db.storage.from(RESOURCES_BUCKET);
  return {
    async signedUrl(path, download) {
      const { data, error } = await bucket().createSignedUrl(path, SIGNED_URL_TTL_S, download === undefined ? undefined : { download });
      if (error) throw error;
      return data.signedUrl;
    },
    async uploadUrl(path) {
      const { data, error } = await bucket().createSignedUploadUrl(path);
      if (error) throw error;
      return data.signedUrl;
    },
    async remove(paths) {
      if (paths.length === 0) return;
      const { error } = await bucket().remove(paths);
      if (error) throw error;
    },
  };
}
