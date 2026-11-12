// next/image remote patterns for site images (next.config.ts). Relative imports only: the
// config file does not resolve the @/ alias. Keep the path in sync with siteImageUrl.
const SITE_PATH = '/storage/v1/object/public/site/**';
const FAKE_HOST = 'files.example.test';

export type ImagePattern = { protocol: 'https'; hostname: string; port: ''; pathname: string; search: '' };

const pattern = (hostname: string): ImagePattern => ({ protocol: 'https', hostname, port: '', pathname: SITE_PATH, search: '' });

export function siteImagePatterns(supabaseUrl: string | undefined): ImagePattern[] {
  return [pattern(FAKE_HOST), ...(supabaseUrl ? [pattern(new URL(supabaseUrl).hostname)] : [])];
}
