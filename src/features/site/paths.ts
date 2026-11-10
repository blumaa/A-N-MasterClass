// Site browser paths (host-relative). SSOT for public page links and Studio site links.
import type { Page } from '@/lib/data/types';

export const blogHref = '/blog';
export const pageHref = (page: Pick<Page, 'kind' | 'slug' | 'isHome'>): string =>
  page.kind === 'post' ? `${blogHref}/${page.slug}` : page.isHome ? '/' : `/${page.slug}`;

export const studioSiteHref = '/studio/site';
export const studioNavHref = '/studio/site/navigation';
export const studioPageHref = (pageId: string): string => `/studio/site/pages/${pageId}`;
export const studioPreviewHref = (pageId: string): string => `/studio/site/pages/${pageId}/preview`;
