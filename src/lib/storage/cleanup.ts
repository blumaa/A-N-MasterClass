// Composition root for Storage cleanup. Server only.
import 'server-only';
import { after } from 'next/server';
import { dataSource } from '@/config/dataSource';
import { adminClient } from '@/lib/supabase/admin';
import { createSupabaseStorageTrash } from '@/lib/supabase/storageTrash';
import { getFileStore } from './getFileStore';
import type { CleanupResult } from './storageCron';
import { createFakeStorageTrash, drainStorageTrash, ORPHAN_GRACE_HOURS, type StorageTrash } from './trash';

function getStorageTrash(): StorageTrash {
  switch (dataSource()) {
    case 'fake':
      return createFakeStorageTrash();
    case 'supabase':
      return createSupabaseStorageTrash(adminClient());
  }
}

/** Cron: queue orphans past the grace period, then drain the queue. */
export async function cleanupStorage(): Promise<CleanupResult> {
  const trash = getStorageTrash();
  const queued = await trash.queueOrphans(ORPHAN_GRACE_HOURS);
  return { queued, removed: await drainStorageTrash(trash, getFileStore) };
}

/**
 * After a mutation that may have queued paths: drain once the response is sent. A failure leaves
 * the paths queued for the cron run.
 */
export function drainSoon(): void {
  after(async () => {
    await drainStorageTrash(getStorageTrash(), getFileStore);
  });
}
