// Studio > Programs.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { studioPrograms } from '@/features/studio/api/curriculum';
import { ProgramList } from '@/features/studio/components/ProgramList';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Studio' };

export default async function StudioHome({ params }: PageProps<'/[space]/studio'>) {
  const viewer = await currentViewer((await params).space);
  const programs = viewer ? await studioPrograms(getRepo(), viewer) : null;
  if (!programs) notFound();
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Programs
      </Heading>
      <ProgramList programs={programs} />
    </Stack>
  );
}
