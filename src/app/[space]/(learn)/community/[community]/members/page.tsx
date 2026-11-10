// Member directory of a community (G2: names from space profiles). Shown while one of the
// viewer's access groups has the directory on (or the viewer is staff); Message buttons for DM targets.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { dmTargets } from '@/features/community/api/dms';
import { directory } from '@/features/community/api/feed';
import { communityShell } from '@/features/community/api/shell';
import { chatAction } from '@/features/community/chatActions';
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
  const shell = await communityShell(repo, viewer, community, now);
  if (!shell?.access.directory) notFound();
  const [members, targets] = await Promise.all([directory(repo, shell.community, now), dmTargets(repo, viewer, shell.community, now)]);
  return (
    <CommunityFrame community={shell.community} channels={shell.channels} activeId="members" extras={shell.nav}>
      <Stack gap="loose">
        <Heading level={1} variant="title">
          Members
        </Heading>
        <MemberList members={members} dm={{ communityId: shell.community.id, targets: [...targets], action: chatAction }} />
      </Stack>
    </CommunityFrame>
  );
}
