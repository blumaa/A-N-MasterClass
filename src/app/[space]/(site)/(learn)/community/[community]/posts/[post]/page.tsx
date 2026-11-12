// One post with its comment thread.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Stack } from '@/components/ui/mds';
import { communityNav } from '@/features/community/api/nav';
import { postPage } from '@/features/community/api/feed';
import { CommentThread } from '@/features/community/components/CommentThread';
import { CommunityFrame } from '@/features/community/components/CommunityFrame';
import { PostCard } from '@/features/community/components/PostCard';
import { communityHref } from '@/features/community/paths';
import { LiveRefresh } from '@/components/LiveRefresh/LiveRefresh';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { liveTopic } from '@/lib/realtime/topics';
import { communityAction } from '@/app/[space]/communityActions';

type Props = PageProps<'/[space]/community/[community]/posts/[post]'>;

async function load(params: Props['params']) {
  const { space, community, post } = await params;
  const viewer = await currentViewer(space);
  if (!viewer) return null;
  const page = await postPage(getRepo(), viewer, community, post, new Date());
  return page ? { page, viewer } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  return data ? { title: `${data.page.post.author.name} · ${data.page.community.title}` } : {};
}

export default async function PostRoute({ params }: Props) {
  const data = await load(params);
  if (!data) notFound();
  const { page, viewer } = data;
  const { community, access, rules, channels, channel, post, open, comments, members } = page;
  const signedIn = viewer.profile !== null;
  const nav = await communityNav(getRepo(), viewer, community, access, new Date());
  return (
    <CommunityFrame community={community} channels={channels} activeId={channel.id} extras={nav}>
      <Stack gap="loose">
        <LiveRefresh topics={signedIn ? [liveTopic.post(post.id)] : []} />
        <PostCard
          post={post}
          action={communityAction}
          href={null}
          moderate={rules.moderatePosts}
          signedIn={signedIn}
          afterDelete={communityHref(community.slug)}
          addPhotos={post.mine && rules.post}
        />
        <CommentThread
          action={communityAction}
          target={{ type: 'post', id: post.id }}
          comments={comments}
          members={members}
          canComment={signedIn}
          closed={!open}
          moderate={rules.moderateComments}
        />
      </Stack>
    </CommunityFrame>
  );
}
