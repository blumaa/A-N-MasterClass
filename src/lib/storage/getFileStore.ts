// Composition root: picks the FileStore for DATA_SOURCE. Server only.
import 'server-only';
import { dataSource } from '@/config/dataSource';
import { adminClient } from '@/lib/supabase/admin';
import { createSupabaseFileStore } from '@/lib/supabase/fileStore';
import { createFakeFileStore, type FileStore } from './fileStore';

export function getFileStore(): FileStore {
  switch (dataSource()) {
    case 'fake':
      return createFakeFileStore();
    case 'supabase':
      return createSupabaseFileStore(adminClient());
  }
}
