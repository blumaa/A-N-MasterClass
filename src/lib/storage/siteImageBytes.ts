// Composition root: bytes of a public site image (logo) for server-side drawing. Server only.
// Fake mode serves no files, so it returns null and callers fall back.
import 'server-only';
import { dataSource } from '@/config/dataSource';
import { siteImageSrc } from './siteImageSrc';

export async function siteImageBytes(path: string): Promise<Uint8Array | null> {
  if (dataSource() !== 'supabase') return null;
  const res = await fetch(siteImageSrc(path), { cache: 'no-store' });
  if (!res.ok) throw new Error(`site image ${path}: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}
