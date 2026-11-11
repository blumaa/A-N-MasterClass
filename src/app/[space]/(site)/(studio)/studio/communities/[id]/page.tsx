// Studio > one community: settings, channels, staff ticks.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { studioCommunity } from '@/features/community/api/studio';
import { CommunityEditor } from '@/features/community/components/CommunityEditor';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

type Props = PageProps<'/[space]/studio/communities/[id]'>;

async function load(params: Props['params']) {
  const { space, id } = await params;
  const viewer = await currentViewer(space);
  return viewer ? studioCommunity(getRepo(), viewer, id, new Date()) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const view = await load(params);
  return view ? { title: view.community.title } : {};
}

export default async function StudioCommunityPage({ params }: Props) {
  const view = await load(params);
  if (!view) notFound();
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        {view.community.title}
      </Heading>
      <CommunityEditor view={view} />
    </Stack>
  );
}
