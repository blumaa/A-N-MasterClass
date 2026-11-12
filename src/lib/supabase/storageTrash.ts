// StorageTrash on the storage_trash queue (migration 20261115000000_storage_cleanup). Service client only. Server only.
import 'server-only';
import type { Bucket } from '@/lib/storage/fileStore';
import type { StorageTrash } from '@/lib/storage/trash';
import type { Db } from './server';

export function createSupabaseStorageTrash(db: Db): StorageTrash {
  return {
    async take(max) {
      const { data, error } = await db.rpc('storage_trash_take', { max_rows: max });
      if (error) throw error;
      return data.map((r) => ({ bucket: r.bucket as Bucket, path: r.path }));
    },
    async done(bucket, paths) {
      if (paths.length === 0) return;
      const { error } = await db.rpc('storage_trash_done', { target_bucket: bucket, paths });
      if (error) throw error;
    },
    async queueOrphans(graceHours) {
      const { data, error } = await db.rpc('storage_queue_orphans', { grace: `${graceHours} hours` });
      if (error) throw error;
      return data;
    },
  };
}
