// One direct message thread of the viewer. Opening it marks it read.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { communityNav, dmThreadPage } from '@/features/community/api/dms';
import { communityShell } from '@/features/community/api/shell';
import { chatAction } from '@/features/community/chatActions';
import { CommunityFrame } from '@/features/community/components/CommunityFrame';
import { DmThread } from '@/features/community/components/DmThread';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Messages' };

export default async function DmThreadRoute({ params }: PageProps<'/[space]/community/[community]/messages/[thread]'>) {
  const { space, community, thread } = await params;
  const viewer = await currentViewer(space);
  if (!viewer) notFound();
  const repo = getRepo();
  const now = new Date();
  const shell = await communityShell(repo, viewer, community, now);
  if (!shell) notFound();
  const page = await dmThreadPage(repo, viewer, shell.community, thread, now);
  if (!page) notFound();
  // Opening the thread marked it read: count unread again so the nav badge is current.
  const nav = await communityNav(repo, viewer, shell.community, shell.access.directory, now);
  return (
    <CommunityFrame community={shell.community} channels={shell.channels} activeId="messages" extras={nav}>
      <DmThread communityId={shell.community.id} page={page} action={chatAction} />
    </CommunityFrame>
  );
}
