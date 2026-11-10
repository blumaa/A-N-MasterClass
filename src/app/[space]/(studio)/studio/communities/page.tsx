// Studio > Communities.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { studioCommunities } from '@/features/community/api/studio';
import { CommunityList } from '@/features/community/components/CommunityList';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Communities' };

export default async function StudioCommunitiesPage({ params }: PageProps<'/[space]/studio/communities'>) {
  const viewer = await currentViewer((await params).space);
  const communities = viewer ? await studioCommunities(getRepo(), viewer) : null;
  if (!communities) notFound();
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Communities
      </Heading>
      <CommunityList communities={communities} />
    </Stack>
  );
}
