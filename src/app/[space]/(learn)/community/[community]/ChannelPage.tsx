// Shared body of the community home (first channel) and a channel route.
import { notFound } from 'next/navigation';
import { EmptyState } from '@/components/ui/mds';
import { communityNav } from '@/features/community/api/nav';
import { communityPage } from '@/features/community/api/feed';
import { ChannelChat } from '@/features/community/components/ChannelChat';
import { ChannelFeed } from '@/features/community/components/ChannelFeed';
import { CommunityFrame } from '@/features/community/components/CommunityFrame';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { chatAction } from '@/features/community/chatActions';
import { communityAction } from '@/app/[space]/communityActions';

export async function loadChannel(space: string, community: string, channelId: string | null) {
  const viewer = await currentViewer(space);
  if (!viewer) return null;
  const page = await communityPage(getRepo(), viewer, community, channelId, new Date());
  return page ? { page, viewer } : null;
}

export async function ChannelPage({ space, community, channelId }: { space: string; community: string; channelId: string | null }) {
  const data = await loadChannel(space, community, channelId);
  if (!data) notFound();
  const { page, viewer } = data;
  if (page.kind === 'locked') {
    return <EmptyState title={page.community.title} description="This community is for members. Get access through one of its offers." />;
  }
  const nav = await communityNav(getRepo(), viewer, page.community, page.access, new Date());
  return (
    <CommunityFrame community={page.community} channels={page.channels} activeId={page.channel.id} extras={nav}>
      {page.channel.kind === 'chat' ? (
        <ChannelChat page={page} action={chatAction} />
      ) : (
        <ChannelFeed page={page} action={communityAction} signedIn={viewer.profile !== null} />
      )}
    </CommunityFrame>
  );
}
