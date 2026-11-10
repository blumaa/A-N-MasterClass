// Client page of a coaching product: balance, booking, sessions.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { clientCoaching } from '@/features/coaching/api/booking';
import { calendarPortFor } from '@/features/coaching/api/googleCalendar';
import { ClientCoaching } from '@/features/coaching/components/ClientCoaching';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { googleClient } from '@/lib/google/server';

type Props = PageProps<'/[space]/coaching/[program]'>;

async function load(params: Props['params']) {
  const { space, program } = await params;
  const viewer = await currentViewer(space);
  if (!viewer) return null;
  const repo = getRepo();
  return clientCoaching(repo, viewer, calendarPortFor(repo, googleClient()), program, new Date());
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  return data ? { title: data.product.title } : {};
}

export default async function CoachingPage({ params }: Props) {
  const data = await load(params);
  if (!data) notFound();
  return (
      <ClientCoaching data={data} />
  );
}
