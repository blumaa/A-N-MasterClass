// The viewer's direct messages in one community (G12). Exists while the community has DMs on.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { dmInbox } from '@/features/community/api/dms';
import { communityShell } from '@/features/community/api/shell';
import { CommunityFrame } from '@/features/community/components/CommunityFrame';
import { DmInbox } from '@/features/community/components/DmInbox';
import { LiveRefresh } from '@/features/community/components/LiveRefresh';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Messages' };

export default async function MessagesRoute({ params }: PageProps<'/[space]/community/[community]/messages'>) {
  const { space, community } = await params;
  const viewer = await currentViewer(space);
  if (!viewer) notFound();
  const repo = getRepo();
  const now = new Date();
  const shell = await communityShell(repo, viewer, community, now);
  if (!shell?.nav.dms) notFound();
  const items = await dmInbox(repo, viewer, shell.community, now);
  if (!items) notFound();
  return (
    <CommunityFrame community={shell.community} channels={shell.channels} activeId="messages" extras={shell.nav}>
      <Stack gap="loose">
        <LiveRefresh />
        <Heading level={1} variant="title">
          Messages
        </Heading>
        <DmInbox community={shell.community.slug} items={items} />
      </Stack>
    </CommunityFrame>
  );
}
