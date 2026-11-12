// Storage trash against the linked project. Touches only its own contract-test paths: the orphan
// sweep runs with a grace no object reaches, the drain is not run here (it would empty the real queue).
import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { adminClient } from './admin';
import { createSupabaseStorageTrash } from './storageTrash';
import { contractEnabled } from './repo/testing/contractSpace';

describe.skipIf(!contractEnabled)('Supabase storage trash (contract)', () => {
  it('takes queued paths and forgets done ones', async () => {
    const db = adminClient();
    const trash = createSupabaseStorageTrash(db);
    const path = `contract-test/${randomUUID()}/gone.txt`;
    const { error } = await db.from('storage_trash').insert({ bucket: 'resources', path, queued_at: '2000-01-01T00:00:00Z' });
    expect(error).toBeNull();
    try {
      expect(await trash.take(1000)).toContainEqual({ bucket: 'resources', path });
      await trash.done('resources', [path]);
      expect(await trash.take(1000)).not.toContainEqual({ bucket: 'resources', path });
    } finally {
      await db.from('storage_trash').delete().eq('path', path);
    }
  });

  it('runs the orphan sweep', async () => {
    expect(await createSupabaseStorageTrash(adminClient()).queueOrphans(24 * 365 * 100)).toBe(0);
  });
});
