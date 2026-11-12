// One meetup: time in the member's zone (its own zone as secondary), RSVP, join link while
// joinable, replay afterwards.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { meetupItem } from '@/features/community/api/meetups';
import { communityShell } from '@/features/community/api/shell';
import { CommunityFrame } from '@/features/community/components/CommunityFrame';
import { MeetupDetail } from '@/features/community/components/Meetups';
import { meetupAction } from '@/features/community/eventsActions';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { currentViewerZone } from '@/lib/time/currentViewerZone';

type Props = PageProps<'/[space]/community/[community]/meetups/[meetup]'>;

async function load(params: Props['params']) {
  const { space, community, meetup } = await params;
  const viewer = await currentViewer(space);
  if (!viewer) return null;
  const repo = getRepo();
  const now = new Date();
  const shell = await communityShell(repo, viewer, community, now);
  const item = shell && (await meetupItem(repo, viewer, shell.community, shell.access, meetup, now));
  return shell && item ? { viewer, shell, item } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  return data ? { title: data.item.title } : {};
}

export default async function MeetupRoute({ params }: Props) {
  const [data, viewerZone] = await Promise.all([load(params), currentViewerZone()]);
  if (!data) notFound();
  const { viewer, shell, item } = data;
  return (
    <CommunityFrame community={shell.community} channels={shell.channels} activeId="meetups" extras={shell.nav}>
      <MeetupDetail
        community={shell.community.slug}
        meetup={item}
        action={meetupAction}
        signedIn={viewer.profile !== null}
        viewerZone={viewerZone}
      />
    </CommunityFrame>
  );
}
