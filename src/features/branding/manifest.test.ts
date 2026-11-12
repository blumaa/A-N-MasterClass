import { describe, expect, it } from 'vitest';
import { DEFAULT_BRAND } from '@/tokens/resolveBrand';
import { spaceManifest } from './manifest';

describe('spaceManifest (G20)', () => {
  it('names the app after the space and paints it with the brand', () => {
    const colors = { ...DEFAULT_BRAND, accent: '#2f6b4f', page: '#f6f3ee' };
    expect(spaceManifest('Natasha', colors)).toEqual({
      name: 'Natasha',
      short_name: 'Natasha',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      theme_color: '#2f6b4f',
      background_color: '#f6f3ee',
    });
  });

  it('installs with the uploaded browser icon', () => {
    expect(spaceManifest('Natasha', null, '/icon.png').icons).toEqual([
      { src: '/icon.png', sizes: '512x512', purpose: 'any' },
    ]);
  });

  it('falls back to the platform default brand', () => {
    expect(spaceManifest('Alexander', null)).toMatchObject({
      theme_color: DEFAULT_BRAND.accent,
      background_color: DEFAULT_BRAND.page,
    });
  });
});
