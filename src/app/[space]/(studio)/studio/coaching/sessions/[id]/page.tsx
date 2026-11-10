// Studio > Coaching > one session.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { coachSettingsOf } from '@/features/coaching/api/schedule';
import { studioSession } from '@/features/coaching/api/studio';
import { StudioSessionDetail } from '@/features/coaching/components/StudioSessionDetail';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Coaching session' };

export default async function StudioSessionPage({ params }: PageProps<'/[space]/studio/coaching/sessions/[id]'>) {
  const { space, id } = await params;
  const viewer = await currentViewer(space);
  if (!viewer) notFound();
  const repo = getRepo();
  const [data, settings] = await Promise.all([studioSession(repo, viewer, id), coachSettingsOf(repo, viewer.space.id)]);
  if (!data) notFound();
  return <StudioSessionDetail data={data} timeZone={settings.timeZone} />;
}
