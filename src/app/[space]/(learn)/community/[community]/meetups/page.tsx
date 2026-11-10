// Meetups of a community (G14), while the viewer's access group has them on.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { meetupList } from '@/features/community/api/meetups';
import { communityShell } from '@/features/community/api/shell';
import { CommunityFrame } from '@/features/community/components/CommunityFrame';
import { MeetupList } from '@/features/community/components/Meetups';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Meetups' };

export default async function MeetupsRoute({ params }: PageProps<'/[space]/community/[community]/meetups'>) {
  const { space, community } = await params;
  const viewer = await currentViewer(space);
  if (!viewer) notFound();
  const repo = getRepo();
  const now = new Date();
  const shell = await communityShell(repo, viewer, community, now);
  const meetups = shell && (await meetupList(repo, viewer, shell.community, shell.access, now));
  if (!shell || !meetups) notFound();
  return (
    <CommunityFrame community={shell.community} channels={shell.channels} activeId="meetups" extras={shell.nav}>
      <Stack gap="loose">
        <Heading level={1} variant="title">
          Meetups
        </Heading>
        <MeetupList community={shell.community.slug} meetups={meetups} />
      </Stack>
    </CommunityFrame>
  );
}
