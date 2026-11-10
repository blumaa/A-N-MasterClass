// Composition root: picks the FileStore for DATA_SOURCE. Server only.
import 'server-only';
import { dataSource } from '@/config/dataSource';
import { createFakeFileStore, type FileStore } from './fileStore';

export function getFileStore(): FileStore {
  switch (dataSource()) {
    case 'fake':
      return createFakeFileStore();
    case 'supabase':
      // OWES: supabase.storage.from('resources').createSignedUrl(path, SIGNED_URL_TTL_S, { download }).
      throw new Error('DATA_SOURCE=supabase: Supabase file store not built yet. Use DATA_SOURCE=fake.');
  }
}
