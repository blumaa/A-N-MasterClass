// Per-space web app manifest (G20): installs as the instructor's own app.
// Icons arrive with logo upload; browsers fall back to a page screenshot until then.
import type { MetadataRoute } from 'next';
import { DEFAULT_BRAND, type BrandColors } from '@/tokens/resolveBrand';

export function spaceManifest(name: string, colors: BrandColors | null): MetadataRoute.Manifest {
  const brand = colors ?? DEFAULT_BRAND;
  return {
    name,
    short_name: name,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: brand.accent,
    background_color: brand.page,
  };
}
