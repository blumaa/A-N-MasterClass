// Space home: the published home page (G11); until one exists, the program library.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { library } from '@/features/programs/api/library';
import { LibraryList } from '@/features/programs/components/LibraryList';
import { loadHome } from '@/features/site/api/load';
import { PublicPageView } from '@/features/site/components/PublicPageView';
import { pageMetadata } from '@/features/site/metadata';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

type Props = PageProps<'/[space]'>;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const home = await loadHome((await params).space);
  return home ? pageMetadata(home.page) : {};
}

export default async function SpaceHome({ params }: Props) {
  const { space } = await params;
  const home = await loadHome(space);
  if (home) return <PublicPageView page={home.page} sections={home.sections} curricula={home.curricula} />;
  const viewer = await currentViewer(space);
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
