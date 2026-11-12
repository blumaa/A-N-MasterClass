// Composition root: picks the FileStore for DATA_SOURCE. Server only.
import 'server-only';
import { dataSource } from '@/config/dataSource';
import { adminClient } from '@/lib/supabase/admin';
import { createSupabaseFileStore } from '@/lib/supabase/fileStore';
import { createFakeFileStore, type Bucket, type FileStore } from './fileStore';

export function getFileStore(bucket: Bucket = 'resources'): FileStore {
  switch (dataSource()) {
    case 'fake':
      return createFakeFileStore(undefined, bucket);
    case 'supabase':
      return createSupabaseFileStore(adminClient(), bucket);
  }
}
