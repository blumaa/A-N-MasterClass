// One coaching session for the client.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { clientSession, rescheduleSlots } from '@/features/coaching/api/booking';
import { calendarPortFor } from '@/features/coaching/api/googleCalendar';
import { coachSettingsOf } from '@/features/coaching/api/schedule';
import { ClientSessionDetail } from '@/features/coaching/components/ClientSessionDetail';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { googleClient } from '@/lib/google/server';

export const metadata: Metadata = { title: 'Coaching session' };

export default async function CoachingSessionPage({ params }: PageProps<'/[space]/coaching/[program]/sessions/[session]'>) {
  const { space, program, session: id } = await params;
  const viewer = await currentViewer(space);
  if (!viewer) notFound();
  const repo = getRepo();
  const now = new Date();
  const [session, product, settings] = await Promise.all([
    clientSession(repo, viewer, id, now),
    repo.productBySlug(viewer.space.id, program),
    coachSettingsOf(repo, viewer.space.id),
  ]);
  if (!session || !product || product.id !== session.productId) notFound();
  const reschedule = session.changeable
    ? await rescheduleSlots(repo, viewer, calendarPortFor(repo, googleClient()), id, now)
    : { slots: [], calendarDown: false };
  return (
      <ClientSessionDetail
        product={product}
        session={session}
        timeZone={settings.timeZone}
        cutoffHours={settings.cancelCutoffHours}
        reschedule={reschedule}
      />
  );
}
