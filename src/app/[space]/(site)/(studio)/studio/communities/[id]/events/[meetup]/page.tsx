// Studio > one meetup: its events (occurrences) with edit and cancel per Kajabi scope.
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { BackLink } from '@/components/ui/links';
import { Heading, Stack } from '@/components/ui/mds';
import { studioMeetup } from '@/features/community/api/studioEvents';
import { MeetupSessions } from '@/features/community/components/MeetupSessions';
import { studioEventsHref } from '@/features/community/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Meetup events' };

export default async function StudioMeetupPage({ params }: PageProps<'/[space]/studio/communities/[id]/events/[meetup]'>) {
  const { space, id, meetup } = await params;
  const viewer = await currentViewer(space);
  if (!viewer) notFound();
  const view = await studioMeetup(getRepo(), viewer, meetup, new Date());
  // Gone (e.g. "cancel all events" just deleted it) or not editable: back to the list, which checks access.
  if (!view || view.meetup.communityId !== id) redirect(studioEventsHref(id));
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        {view.meetup.title}
      </Heading>
      <div>
        <BackLink href={studioEventsHref(id)}>challenges and meetups</BackLink>
      </div>
      <MeetupSessions meetup={view.meetup} past={view.past} upcoming={view.upcoming} />
    </Stack>
  );
}
