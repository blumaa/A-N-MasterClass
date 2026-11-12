// One channel: composer (when the viewer may post) above the posts, pinned first (repo order).
import type { FormAction } from '@/components/ActionForm/ActionForm';
import { EmptyState, Heading, Stack, Text } from '@/components/ui/mds';
import { POST_PHOTOS_MAX } from '@/lib/storage/communityFiles';
import type { CommunityPage } from '../api/feed';
import { postHref } from '../paths';
import { Composer } from './Composer';
import { PostCard } from './PostCard';

type Props = { page: Extract<CommunityPage, { kind: 'open' }>; action: FormAction; report: FormAction; signedIn: boolean };

export function ChannelFeed({ page, action, report, signedIn }: Props) {
  const { community, channel, rules, posts, members } = page;
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        {channel.title}
      </Heading>
      {rules.post ? (
        <Composer
          action={action}
          fields={{ op: 'createPost', channelId: channel.id }}
          members={members}
          submit="Post"
          label={`Write in ${channel.title}`}
          placeholder="Share something…"
          rows={4}
          files={{ kind: 'photo', target: 'channel', id: channel.id, max: POST_PHOTOS_MAX }}
        />
      ) : channel.readOnly ? (
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
            moderate={rules.moderatePosts}
            signedIn={signedIn}
            report={report}
          />
        ))
      )}
    </Stack>
  );
}
