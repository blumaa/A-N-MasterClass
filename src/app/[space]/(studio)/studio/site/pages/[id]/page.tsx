// Studio > Site > Page editor.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { Heading, Stack } from '@/components/ui/mds';
import { AppLink } from '@/components/ui/links';
import { programOptions, studioPage } from '@/features/site/api/site';
import { PageEditor } from '@/features/site/components/PageEditor';
import { studioSiteHref } from '@/features/site/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

type Props = PageProps<'/[space]/studio/site/pages/[id]'>;

const load = cache(async (space: string, id: string) => {
  const viewer = await currentViewer(space);
  if (!viewer) return null;
  const [found, programs] = await Promise.all([studioPage(getRepo(), viewer, id), programOptions(getRepo(), viewer.space.id)]);
  return found && { ...found, programs };
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
      <AppLink href={studioSiteHref}>Back to site</AppLink>
      <Heading level={1} variant="title">
        {data.page.title}
      </Heading>
      <PageEditor page={data.page} versions={data.versions} programs={data.programs} />
    </Stack>
  );
}
