// Studio > Coaching: products, availability, Google Calendar, upcoming sessions.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { connectCalendarAction, disconnectCalendarAction } from '@/features/coaching/actions';
import type { ConnectOutcome } from '@/features/coaching/api/googleConnect';
import { studioCoaching } from '@/features/coaching/api/studio';
import { StudioCoaching } from '@/features/coaching/components/StudioCoaching';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { siteImageSrc } from '@/lib/storage/siteImageSrc';

export const metadata: Metadata = { title: 'Coaching' };

const OUTCOMES: readonly ConnectOutcome[] = ['connected', 'denied', 'failed'];
const outcomeOf = (v: string | string[] | undefined): ConnectOutcome | null =>
  OUTCOMES.find((o) => o === v) ?? null;

export default async function StudioCoachingPage({ params, searchParams }: PageProps<'/[space]/studio/coaching'>) {
  const [{ space }, query] = await Promise.all([params, searchParams]);
  const viewer = await currentViewer(space);
  const data = viewer ? await studioCoaching(getRepo(), viewer, new Date()) : null;
  if (!data) notFound();
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Coaching
      </Heading>
      <StudioCoaching
        data={data}
        outcome={outcomeOf(query.calendar)}
        connect={connectCalendarAction}
        disconnect={disconnectCalendarAction}
        imageSrc={siteImageSrc}
      />
    </Stack>
  );
}
