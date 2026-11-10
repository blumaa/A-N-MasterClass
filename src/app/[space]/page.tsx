// Space home. Placeholder catalogue until the page builder (phase 4) owns the home page.
import { Heading, Stack } from '@/components/ui/mds';
import { library } from '@/features/programs/api/library';
import { LibraryList } from '@/features/programs/components/LibraryList';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { notFound } from 'next/navigation';

export default async function SpaceHome({ params }: PageProps<'/[space]'>) {
  const viewer = await currentViewer((await params).space);
  if (!viewer) notFound();
  const items = await library(getRepo(), viewer, new Date());
  return (
    <Stack gap="loose">
      <Heading level={1} variant="display">
        {viewer.space.name}
      </Heading>
      <LibraryList items={items} />
    </Stack>
  );
}
