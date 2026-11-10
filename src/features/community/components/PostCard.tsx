// One post in a channel feed or on its own page. Moderation buttons only for those allowed.
import type { FormAction } from '@/components/ActionForm/ActionForm';
import { ActionForm } from '@/components/ActionForm/ActionForm';
import { AppLink } from '@/components/ui/links';
import { Badge, Card, CardBody, Inline, Stack, Text } from '@/components/ui/mds';
import { formatDate } from '@/lib/format/date';
import type { PostItem } from '../api/feed';
import { MentionBody } from './MentionBody';
import { ReactionBar } from './ReactionBar';

type Props = {
  post: PostItem;
  action: FormAction;
  /** Link to the post page; null when already on it. */
  href: string | null;
  moderate: boolean;
  signedIn: boolean;
  /** Where to go after deleting (the post page itself would 404). */
  afterDelete?: string;
};

const commentsLabel = (n: number): string => (n === 1 ? '1 comment' : `${n} comments`);

export function PostCard({ post, action, href, moderate, signedIn, afterDelete }: Props) {
  const id = { postId: post.id };
  return (
    <Card>
      <CardBody>
        <Stack gap="tight">
          <Inline gap="tight" justify="between">
            <Text variant="label">{post.author.name}</Text>
            <Inline gap="tight">
              {post.pinned ? <Badge tone="accent">Pinned</Badge> : null}
              {post.hidden ? <Badge tone="warning">Hidden</Badge> : null}
              <Text variant="meta" tone="muted">
                {formatDate(post.createdAt)}
              </Text>
            </Inline>
          </Inline>
          <MentionBody body={post.body} />
          <ReactionBar action={action} targetType="post" targetId={post.id} reactions={post.reactions} enabled={signedIn} />
          <Inline gap="tight">
            {href ? <AppLink href={href}>{commentsLabel(post.commentCount)}</AppLink> : null}
            {moderate ? (
              <>
                <ActionForm action={action} inline variant="ghost" submit={post.pinned ? 'Unpin' : 'Pin'} fields={{ op: 'pinPost', ...id, pinned: String(!post.pinned) }} />
                <ActionForm action={action} inline variant="ghost" submit={post.hidden ? 'Unhide' : 'Hide'} fields={{ op: 'hidePost', ...id, hidden: String(!post.hidden) }} />
              </>
            ) : null}
            {post.canDelete ? (
              <ActionForm
                action={action}
                inline
                variant="ghost"
                submit="Delete"
                confirm="Delete this post and its comments?"
                fields={{ op: 'deletePost', ...id, ...(afterDelete ? { redirectTo: afterDelete } : {}) }}
              />
            ) : null}
          </Inline>
        </Stack>
      </CardBody>
    </Card>
  );
}
