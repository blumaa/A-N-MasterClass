// Student library: programs with progress + Continue, then the viewer's communities and coaching.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { myCoaching } from '@/features/coaching/api/booking';
import { CoachingTiles } from '@/features/coaching/components/CoachingTiles';
import { myCommunities } from '@/features/community/api/feed';
import { CommunityTiles } from '@/features/community/components/CommunityTiles';
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
  const [items, communities, coaching] = await Promise.all([
    library(repo, viewer, now),
    myCommunities(repo, viewer, now),
    myCoaching(repo, viewer, now),
  ]);
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Library
      </Heading>
      <LibraryList items={items} />
      <CommunityTiles communities={communities} />
      <CoachingTiles coaching={coaching} />
    </Stack>
  );
}
