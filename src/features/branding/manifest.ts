// Per-space web app manifest (G20): installs as the instructor's own app.
// Icon = the uploaded browser icon (square, at least 512 px); without one, browsers fall back
// to a page screenshot.
import type { MetadataRoute } from 'next';
import { DEFAULT_BRAND, type BrandColors } from '@/tokens/resolveBrand';

export function spaceManifest(name: string, colors: BrandColors | null, iconSrc?: string | null): MetadataRoute.Manifest {
  const brand = colors ?? DEFAULT_BRAND;
  return {
    name,
    short_name: name,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: brand.accent,
    background_color: brand.page,
    ...(iconSrc ? { icons: [{ src: iconSrc, sizes: '512x512', purpose: 'any' as const }] } : {}),
  };
}
