// Student library: programs with progress + Continue, then every other product kind the viewer holds.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ProductTiles } from '@/components/ProductTiles/ProductTiles';
import { Heading, Stack } from '@/components/ui/mds';
import { myCoaching } from '@/features/coaching/api/booking';
import { coachingHref } from '@/features/coaching/paths';
import { myCommunities } from '@/features/community/api/feed';
import { communityHref } from '@/features/community/paths';
import { myDownloads } from '@/features/downloads/api/files';
import { downloadHref } from '@/features/downloads/paths';
import { myPodcasts } from '@/features/podcasts/api/listen';
import { podcastHref } from '@/features/podcasts/paths';
import { library } from '@/features/programs/api/library';
import { LibraryList } from '@/features/programs/components/LibraryList';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Library' };

export default async function LibraryPage({ params }: PageProps<'/[space]/library'>) {
  const viewer = await currentViewer((await params).space);
  if (!viewer) notFound();
  const repo = getRepo();
  const now = new Date();
  const [items, communities, coaching, podcasts, downloads] = await Promise.all([
    library(repo, viewer, now),
    myCommunities(repo, viewer, now),
    myCoaching(repo, viewer, now),
    myPodcasts(repo, viewer, now),
    myDownloads(repo, viewer, now),
  ]);
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Library
      </Heading>
      <LibraryList items={items} />
      <ProductTiles heading="Communities" products={communities} href={communityHref} />
      <ProductTiles heading="Coaching" products={coaching} href={coachingHref} />
      <ProductTiles heading="Podcasts" products={podcasts} href={podcastHref} />
      <ProductTiles heading="Downloads" products={downloads} href={downloadHref} />
    </Stack>
  );
}
