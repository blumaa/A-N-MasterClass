// One channel: composer (when the viewer may post) above the posts, pinned first (repo order).
import type { FormAction } from '@/components/ActionForm/ActionForm';
import { EmptyState, Heading, Stack, Text } from '@/components/ui/mds';
import type { CommunityPage } from '../api/feed';
import { postHref } from '../paths';
import { Composer } from './Composer';
import { PostCard } from './PostCard';

type Props = { page: Extract<CommunityPage, { kind: 'open' }>; action: FormAction; signedIn: boolean };

export function ChannelFeed({ page, action, signedIn }: Props) {
  const { community, channel, canPost, posts, members, access } = page;
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        {channel.title}
      </Heading>
      {canPost ? (
        <Composer
          action={action}
          fields={{ op: 'createPost', channelId: channel.id }}
          members={members}
          submit="Post"
          label={`Write in ${channel.title}`}
          placeholder="Share something…"
          rows={4}
        />
      ) : channel.visibility === 'read_only' ? (
        <Text tone="muted">Only staff post in this channel.</Text>
      ) : null}
      {posts.length === 0 ? (
        <EmptyState title="No posts yet" />
      ) : (
        posts.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            action={action}
            href={postHref(community.slug, p.id)}
            moderate={access.moderatePosts}
            signedIn={signedIn}
          />
        ))
      )}
    </Stack>
  );
}
