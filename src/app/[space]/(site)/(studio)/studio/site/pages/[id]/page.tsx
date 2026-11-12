// Studio > Site > Page editor.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Heading, Stack } from '@/components/ui/mds';
import { BackLink } from '@/components/ui/links';
import { sectionChoices, studioPage } from '@/features/site/api/site';
import { PageEditor } from '@/features/site/components/PageEditor';
import { studioSiteHref } from '@/features/site/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { sectionImages } from '@/lib/site/sectionImages';
import { siteImageSrc } from '@/lib/storage/siteImageSrc';

type Props = PageProps<'/[space]/studio/site/pages/[id]'>;

const load = cache(async (space: string, id: string) => {
  const viewer = await currentViewer(space);
  if (!viewer) return null;
  const [found, choices] = await Promise.all([studioPage(getRepo(), viewer, id), sectionChoices(getRepo(), viewer.space.id)]);
  return found && { ...found, choices };
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { space, id } = await params;
  const data = await load(space, id);
  return data ? { title: `Edit ${data.page.title}` } : {};
}

export default async function StudioPageEditor({ params }: Props) {
  const { space, id } = await params;
  const data = await load(space, id);
  if (!data) notFound();
  return (
    <Stack gap="loose">
      <BackLink href={studioSiteHref}>site</BackLink>
      <Heading level={1} variant="title">
        {data.page.title}
      </Heading>
      <PageEditor page={data.page} versions={data.versions} choices={data.choices} images={sectionImages(data.page.draft, siteImageSrc)} />
    </Stack>
  );
}
