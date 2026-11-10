// Studio > Site > Page preview: the draft rendered with the public components.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Stack, Text } from '@/components/ui/mds';
import { AppLink } from '@/components/ui/links';
import { draftPreview, sectionRefs } from '@/features/site/api/site';
import { PublicPageView } from '@/features/site/components/PublicPageView';
import { studioPageHref } from '@/features/site/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Preview', robots: { index: false } };

export default async function StudioPagePreview({ params }: PageProps<'/[space]/studio/site/pages/[id]/preview'>) {
  const { space, id } = await params;
  const viewer = await currentViewer(space);
  const preview = viewer ? await draftPreview(getRepo(), viewer, id) : null;
  if (!viewer || !preview) notFound();
  const refs = await sectionRefs(getRepo(), viewer.space, preview.sections);
  return (
    <Stack gap="loose">
      <Text role="status" tone="secondary">
        Draft preview. <AppLink href={studioPageHref(id)}>Back to editor</AppLink>
      </Text>
      <PublicPageView page={preview.page} sections={preview.sections} refs={refs} />
    </Stack>
  );
}
