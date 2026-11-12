import { describe, expect, it } from 'vitest';
import { createFakeFileStore, type Bucket, type FileStore } from './fileStore';
import { createFakeStorageTrash, drainStorageTrash, REMOVE_BATCH } from './trash';

const stores = () => {
  const made = new Map<Bucket, ReturnType<typeof createFakeFileStore>>();
  const storeFor = (bucket: Bucket) => {
    if (!made.has(bucket)) made.set(bucket, createFakeFileStore(undefined, bucket));
    return made.get(bucket)!;
  };
  return { made, storeFor };
};

describe('fake storage trash', () => {
  it('takes oldest first up to the limit and forgets done paths', async () => {
    const trash = createFakeStorageTrash([
      { bucket: 'site', path: 'a' },
      { bucket: 'resources', path: 'b' },
      { bucket: 'site', path: 'c' },
    ]);
    expect(await trash.take(2)).toEqual([
      { bucket: 'site', path: 'a' },
      { bucket: 'resources', path: 'b' },
    ]);
    await trash.done('site', ['a', 'c']);
    expect(await trash.take(10)).toEqual([{ bucket: 'resources', path: 'b' }]);
  });

  it('queues no orphans (fake mode has no Storage)', async () => {
    expect(await createFakeStorageTrash().queueOrphans(24)).toBe(0);
  });
});

describe('drainStorageTrash', () => {
  it('removes each path from its bucket and empties the queue', async () => {
    const trash = createFakeStorageTrash([
      { bucket: 'site', path: 's/1.png' },
      { bucket: 'community', path: 'c/1.png' },
      { bucket: 'site', path: 's/2.png' },
    ]);
    const { made, storeFor } = stores();
    expect(await drainStorageTrash(trash, storeFor)).toBe(3);
    expect(made.get('site')?.removed).toEqual(['s/1.png', 's/2.png']);
    expect(made.get('community')?.removed).toEqual(['c/1.png']);
    expect(await trash.take(10)).toEqual([]);
  });

  it('does nothing on an empty queue', async () => {
    const { made, storeFor } = stores();
    expect(await drainStorageTrash(createFakeStorageTrash(), storeFor)).toBe(0);
    expect(made.size).toBe(0);
  });

  it('removes in batches the Storage API accepts', async () => {
    const items = Array.from({ length: REMOVE_BATCH + 5 }, (_, i) => ({ bucket: 'resources' as const, path: `p/${i}` }));
    const calls: number[] = [];
    const store: Pick<FileStore, 'remove'> = { remove: async (paths) => void calls.push(paths.length) };
    expect(await drainStorageTrash(createFakeStorageTrash(items), () => store, REMOVE_BATCH + 5)).toBe(REMOVE_BATCH + 5);
    expect(calls).toEqual([REMOVE_BATCH, 5]);
  });

  it('keeps the paths of a failing bucket queued, drains the others, then throws', async () => {
    const trash = createFakeStorageTrash([
      { bucket: 'site', path: 's/1.png' },
      { bucket: 'community', path: 'c/1.png' },
    ]);
    const { made, storeFor } = stores();
    const failing = (bucket: Bucket) =>
      bucket === 'site' ? { remove: async () => Promise.reject(new Error('storage down')) } : storeFor(bucket);
    await expect(drainStorageTrash(trash, failing)).rejects.toThrow('storage down');
    expect(made.get('community')?.removed).toEqual(['c/1.png']);
    expect(await trash.take(10)).toEqual([{ bucket: 'site', path: 's/1.png' }]);
  });
});
