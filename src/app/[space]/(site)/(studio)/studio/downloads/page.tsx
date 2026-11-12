// Studio > Downloads: download products and their files.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { studioDownloads } from '@/features/downloads/api/studio';
import { StudioDownloads } from '@/features/downloads/components/StudioDownloads';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { siteImageSrc } from '@/lib/storage/siteImageSrc';

export const metadata: Metadata = { title: 'Downloads' };

export default async function StudioDownloadsPage({ params }: PageProps<'/[space]/studio/downloads'>) {
  const viewer = await currentViewer((await params).space);
  const data = viewer ? await studioDownloads(getRepo(), viewer) : null;
  if (!data) notFound();
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Downloads
      </Heading>
      <StudioDownloads downloads={data.downloads} imageSrc={siteImageSrc} />
    </Stack>
  );
}
