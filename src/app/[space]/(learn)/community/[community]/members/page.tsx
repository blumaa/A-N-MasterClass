// Member directory of a community (G2: names from space profiles).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { communityPage, directory } from '@/features/community/api/feed';
import { CommunityFrame } from '@/features/community/components/CommunityFrame';
import { MemberList } from '@/features/community/components/MemberList';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Members' };

export default async function MembersRoute({ params }: PageProps<'/[space]/community/[community]/members'>) {
  const { space, community } = await params;
  const viewer = await currentViewer(space);
  if (!viewer) notFound();
  const repo = getRepo();
  const now = new Date();
  const page = await communityPage(repo, viewer, community, null, now);
  if (page?.kind !== 'open') notFound();
  const members = await directory(repo, page.community, now);
  return (
    <CommunityFrame community={page.community} channels={page.channels} activeId={null}>
      <Stack gap="loose">
        <Heading level={1} variant="title">
          Members
        </Heading>
        <MemberList members={members} />
      </Stack>
    </CommunityFrame>
  );
}
