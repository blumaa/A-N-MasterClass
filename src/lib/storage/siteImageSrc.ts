// Composition root: public URL of a site image for DATA_SOURCE. Server only.
import 'server-only';
import { dataSource } from '@/config/dataSource';
import { supabasePublic } from '@/config/supabase';
import { FAKE_FILES_ORIGIN } from './fileStore';
import { siteImageUrl } from './siteImages';

export function siteImageSrc(path: string): string {
  return siteImageUrl(path, dataSource() === 'supabase' ? supabasePublic().url : FAKE_FILES_ORIGIN);
}
