// Student library: programs with progress + Continue.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { library } from '@/features/programs/api/library';
import { LibraryList } from '@/features/programs/components/LibraryList';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Library' };

export default async function LibraryPage({ params }: PageProps<'/[space]/library'>) {
  const viewer = await currentViewer((await params).space);
  if (!viewer) notFound();
  const items = await library(getRepo(), viewer, new Date());
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Library
      </Heading>
      <LibraryList items={items} />
    </Stack>
  );
}
