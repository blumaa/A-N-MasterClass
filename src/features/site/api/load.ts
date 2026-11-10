// Request-scoped loaders for public site routes: generateMetadata and the page share one read.
import 'server-only';
import { cache } from 'react';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { blogPosts, curricula, homePage, publicPage, publicPost, type CurriculumPreview, type PublicPage } from './site';

export type LoadedPage = PublicPage & { curricula: Record<string, CurriculumPreview> };
type Target = { kind: 'home' } | { kind: 'page' | 'post'; slug: string };

async function load(spaceSlug: string, target: Target): Promise<LoadedPage | null> {
  const viewer = await currentViewer(spaceSlug);
  if (!viewer) return null;
  const repo = getRepo();
  const spaceId = viewer.space.id;
  const found =
    target.kind === 'home'
      ? await homePage(repo, spaceId)
      : target.kind === 'page'
        ? await publicPage(repo, spaceId, target.slug)
        : await publicPost(repo, spaceId, target.slug);
  return found ? { ...found, curricula: await curricula(repo, spaceId, found.sections) } : null;
}

// cache() keys on argument identity, so targets are passed as primitives.
export const loadHome = cache((space: string) => load(space, { kind: 'home' }));
export const loadPage = cache((space: string, slug: string) => load(space, { kind: 'page', slug }));
export const loadPost = cache((space: string, slug: string) => load(space, { kind: 'post', slug }));

export const loadBlog = cache(async (space: string) => {
  const viewer = await currentViewer(space);
  return viewer ? blogPosts(getRepo(), viewer.space.id) : null;
});
