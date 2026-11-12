import { describe, expect, it } from 'vitest';
import { SITE_IMAGE_MAX_BYTES, isSiteImagePath, siteImagePath, siteImageProblem, siteImageUrl } from './siteImages';

const SPACE = '11111111-1111-4111-8111-111111111111';

describe('site images', () => {
  it('stores images in <space>/site/ with a safe name', () => {
    expect(siteImagePath({ spaceId: SPACE, id: 'u1', fileName: 'My Hero Photo.JPG' })).toBe(`${SPACE}/site/u1-my-hero-photo.jpg`);
  });

  it('accepts only paths directly in the space site folder', () => {
    expect(isSiteImagePath(`${SPACE}/site/u1-a.jpg`, SPACE)).toBe(true);
    expect(isSiteImagePath(`other/site/u1-a.jpg`, SPACE)).toBe(false);
    expect(isSiteImagePath(`${SPACE}/site/x/u1-a.jpg`, SPACE)).toBe(false);
    expect(isSiteImagePath(`${SPACE}/prod/u1-a.jpg`, SPACE)).toBe(false);
    expect(isSiteImagePath('https://evil.test/a.jpg', SPACE)).toBe(false);
  });

  it('allows jpeg, png and webp up to the size limit', () => {
    expect(siteImageProblem({ fileName: 'a.jpeg', sizeBytes: 10 })).toBeNull();
    expect(siteImageProblem({ fileName: 'a.PNG', sizeBytes: 10 })).toBeNull();
    expect(siteImageProblem({ fileName: 'a.webp', sizeBytes: SITE_IMAGE_MAX_BYTES })).toBeNull();
    expect(siteImageProblem({ fileName: 'a.gif', sizeBytes: 10 })).toMatch(/JPG, PNG or WebP/);
    expect(siteImageProblem({ fileName: 'a.jpg', sizeBytes: 0 })).toMatch(/empty/);
    expect(siteImageProblem({ fileName: 'a.jpg', sizeBytes: SITE_IMAGE_MAX_BYTES + 1 })).toMatch(/too large/);
  });

  it('builds the public object URL from the Supabase URL', () => {
    expect(siteImageUrl(`${SPACE}/site/u1-a b.jpg`, 'https://x.supabase.co')).toBe(
      `https://x.supabase.co/storage/v1/object/public/site/${SPACE}/site/u1-a%20b.jpg`,
    );
  });
});
