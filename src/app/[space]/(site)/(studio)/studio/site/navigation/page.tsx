// Studio > Site > Navigation: header + footer links.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { BackLink } from '@/components/ui/links';
import { studioSite } from '@/features/site/api/site';
import { NavEditor } from '@/features/site/components/NavEditor';
import { studioSiteHref } from '@/features/site/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Navigation' };

export default async function StudioNavPage({ params }: PageProps<'/[space]/studio/site/navigation'>) {
  const viewer = await currentViewer((await params).space);
  const site = viewer ? await studioSite(getRepo(), viewer) : null;
  if (!site) notFound();
  return (
    <Stack gap="loose">
      <BackLink href={studioSiteHref}>site</BackLink>
      <Heading level={1} variant="title">
        Navigation
      </Heading>
      <NavEditor header={site.header} footer={site.footer} />
    </Stack>
  );
}
