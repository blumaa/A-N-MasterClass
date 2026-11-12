// One direct message thread of the viewer. Opening it marks it read.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { dmThreadPage } from '@/features/community/api/dms';
import { communityNav } from '@/features/community/api/nav';
import { communityShell } from '@/features/community/api/shell';
import { chatAction } from '@/features/community/chatActions';
import { CommunityFrame } from '@/features/community/components/CommunityFrame';
import { DmThread } from '@/features/community/components/DmThread';
import { LiveRefresh } from '@/components/LiveRefresh/LiveRefresh';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { liveTopic, typingTopic } from '@/lib/realtime/topics';
import { typingConfig } from '@/components/Typing/typingConfig';

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
  const nav = await communityNav(repo, viewer, shell.community, shell.access, now);
  return (
    <CommunityFrame community={shell.community} channels={shell.channels} activeId="messages" extras={nav}>
      <LiveRefresh topics={[liveTopic.dm(page.threadId)]} />
      <DmThread
        communityId={shell.community.id}
        page={page}
        action={chatAction}
        typing={typingConfig(typingTopic.dm(page.threadId), viewer.profile?.id ?? null, [page.other])}
      />
    </CommunityFrame>
  );
}
