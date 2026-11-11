// Studio > Podcasts: podcast products, their settings and episodes.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { studioPodcasts } from '@/features/podcasts/api/studio';
import { StudioPodcasts } from '@/features/podcasts/components/StudioPodcasts';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Podcasts' };

export default async function StudioPodcastsPage({ params }: PageProps<'/[space]/studio/podcasts'>) {
  const viewer = await currentViewer((await params).space);
  const data = viewer ? await studioPodcasts(getRepo(), viewer) : null;
  if (!data) notFound();
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Podcasts
      </Heading>
      <StudioPodcasts podcasts={data.podcasts} />
    </Stack>
  );
}
