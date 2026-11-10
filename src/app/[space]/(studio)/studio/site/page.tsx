// Studio > Site: pages, blog posts, legal checklist.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { studioSite } from '@/features/site/api/site';
import { SiteOverview } from '@/features/site/components/SiteOverview';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Site' };

export default async function StudioSitePage({ params }: PageProps<'/[space]/studio/site'>) {
  const viewer = await currentViewer((await params).space);
  const site = viewer ? await studioSite(getRepo(), viewer) : null;
  if (!site) notFound();
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Site
      </Heading>
      <SiteOverview site={site} />
    </Stack>
  );
}
