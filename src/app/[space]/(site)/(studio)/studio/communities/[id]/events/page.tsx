// Studio > one community > challenges and meetups.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/ui/links';
import { Heading, Stack } from '@/components/ui/mds';
import { studioEvents } from '@/features/community/api/studioEvents';
import { ChallengeEditor } from '@/features/community/components/ChallengeEditor';
import { MeetupEditor } from '@/features/community/components/MeetupEditor';
import { studioCommunityHref } from '@/features/community/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Challenges and meetups' };

export default async function StudioEventsPage({ params }: PageProps<'/[space]/studio/communities/[id]/events'>) {
  const { space, id } = await params;
  const viewer = await currentViewer(space);
  const view = viewer && (await studioEvents(getRepo(), viewer, id));
  if (!view) notFound();
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Challenges and meetups
      </Heading>
      <div>
        <BackLink href={studioCommunityHref(id)}>community settings</BackLink>
      </div>
      <ChallengeEditor communityId={id} groups={view.groups} challenges={view.challenges} />
      <MeetupEditor communityId={id} groups={view.groups} channels={view.channels} meetups={view.meetups} />
    </Stack>
  );
}
