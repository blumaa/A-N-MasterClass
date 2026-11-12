// SEO + Open Graph for a public page or post (G11). seoTitle/seoDescription win; the home
// page keeps the layout's default title (space name) unless an SEO title is set.
import type { Metadata } from 'next';
import type { PageMeta } from '@/lib/data/types';

export function pageMetadata(page: PageMeta): Metadata {
  const title = page.seoTitle ?? page.title;
  const description = page.seoDescription ?? undefined;
  const openGraph =
    page.kind === 'post'
      ? { title, description, type: 'article' as const, publishedTime: page.publishedAt?.toISOString() }
      : { title, description, type: 'website' as const };
  const pageTitle = page.isHome ? (page.seoTitle ? { absolute: page.seoTitle } : undefined) : title;
  return { title: pageTitle, description, openGraph };
}
