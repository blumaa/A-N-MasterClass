import { describe, expect, it } from 'vitest';
import type { Page } from '@/lib/data/types';
import { pageMetadata } from './metadata';

const page: Page = {
  id: 'p', spaceId: 's', kind: 'page', slug: 'about', title: 'About', isHome: false, legalKind: null,
  seoTitle: null, seoDescription: null, draft: [], published: [], publishedAt: new Date('2026-11-01T00:00:00Z'),
  updatedAt: new Date('2026-11-01T00:00:00Z'),
};

describe('pageMetadata', () => {
  it('falls back to the page title', () => {
    expect(pageMetadata(page)).toEqual({ title: 'About', description: undefined, openGraph: { title: 'About', description: undefined, type: 'website' } });
  });

  it('prefers the SEO fields', () => {
    const meta = pageMetadata({ ...page, seoTitle: 'About us', seoDescription: 'Who we are' });
    expect(meta).toMatchObject({ title: 'About us', description: 'Who we are', openGraph: { title: 'About us', description: 'Who we are' } });
  });

  it('marks posts as articles with their publish time', () => {
    const meta = pageMetadata({ ...page, kind: 'post' });
    expect(meta.openGraph).toMatchObject({ type: 'article', publishedTime: '2026-11-01T00:00:00.000Z' });
  });

  it('leaves the home title to the layout default unless an SEO title is set', () => {
    expect(pageMetadata({ ...page, isHome: true }).title).toBeUndefined();
    expect(pageMetadata({ ...page, isHome: true, seoTitle: 'Rope' }).title).toEqual({ absolute: 'Rope' });
  });
});
