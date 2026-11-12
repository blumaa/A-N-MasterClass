// Storage trash: paths whose rows are gone or changed. DB triggers fill the queue
// (migration 20261115000000_storage_cleanup); the server drains it through the Storage API.
// One mechanism for every delete path: commands never remove files themselves.
import type { Bucket, FileStore } from './fileStore';

export type TrashItem = { bucket: Bucket; path: string };

export type StorageTrash = {
  /** Oldest queued paths no row points at, up to `max`. */
  take(max: number): Promise<TrashItem[]>;
  /** Drops paths whose objects are gone. */
  done(bucket: Bucket, paths: string[]): Promise<void>;
  /** Queues objects older than the grace period that no row points at. Returns how many. */
  queueOrphans(graceHours: number): Promise<number>;
};

/** Uploads not saved to a row within this time count as orphans. */
export const ORPHAN_GRACE_HOURS = 24;
/** Storage API remove() takes at most 1000 paths per call. */
export const REMOVE_BATCH = 1000;
/** Paths per drain run. */
export const DRAIN_LIMIT = 1000;

/** In-memory queue. Fake mode has no Storage, so nothing is ever orphaned. */
export function createFakeStorageTrash(initial: TrashItem[] = []): StorageTrash {
  let items = [...initial];
  return {
    async take(max) {
      return items.slice(0, max).map((i) => ({ ...i }));
    },
    async done(bucket, paths) {
      const gone = new Set(paths);
      items = items.filter((i) => i.bucket !== bucket || !gone.has(i.path));
    },
    async queueOrphans() {
      return 0;
    },
  };
}

/**
 * Removes queued objects bucket by bucket and drops them from the queue. A failing bucket keeps its
 * paths queued for the next run; the others still drain, then the first error is thrown.
 * Returns how many paths were removed.
 */
export async function drainStorageTrash(
  trash: StorageTrash,
  storeFor: (bucket: Bucket) => Pick<FileStore, 'remove'>,
  limit: number = DRAIN_LIMIT,
): Promise<number> {
  const byBucket = Map.groupBy(await trash.take(limit), (i) => i.bucket);
  let removed = 0;
  let failure: unknown = null;
  for (const [bucket, items] of byBucket) {
    const paths = items.map((i) => i.path);
    try {
      for (let i = 0; i < paths.length; i += REMOVE_BATCH) {
        const batch = paths.slice(i, i + REMOVE_BATCH);
        await storeFor(bucket).remove(batch);
        await trash.done(bucket, batch);
        removed += batch.length;
      }
    } catch (error) {
      failure ??= error;
    }
  }
  if (failure !== null) throw failure;
  return removed;
}
