// One post in a channel feed or on its own page. Moderation buttons only for those allowed.
import type { FormAction } from '@/components/ActionForm/ActionForm';
import { ActionForm } from '@/components/ActionForm/ActionForm';
import { AppLink } from '@/components/ui/links';
import { Badge, Card, CardBody, Inline, Stack, Text } from '@/components/ui/mds';
import { formatDate } from '@/lib/format/date';
import { POST_PHOTOS_MAX } from '@/lib/storage/communityFiles';
import type { PostItem } from '../api/feed';
import { MentionBody } from './MentionBody';
import { PhotoAdder } from './PhotoAdder';
import { PostPhotos } from './PostPhotos';
import { ReactionBar } from './ReactionBar';
import { ReportForm } from './ReportForm';

type Props = {
  post: PostItem;
  action: FormAction;
  /** Link to the post page; null when already on it. */
  href: string | null;
  moderate: boolean;
  signedIn: boolean;
  /** Report action (app/: it pushes to moderators). None: no Report button. */
  report?: FormAction;
  /** Where to go after deleting (the post page itself would 404). */
  afterDelete?: string;
  /** Post page, author who may still post: room to add photos. */
  addPhotos?: boolean;
};

const STATUS_BADGE = { pending: 'Waiting for approval', rejected: 'Not approved' } as const;

const commentsLabel = (n: number): string => (n === 1 ? '1 comment' : `${n} comments`);

export function PostCard({ post, action, href, moderate, signedIn, report, afterDelete, addPhotos = false }: Props) {
  const id = { postId: post.id };
  const room = POST_PHOTOS_MAX - post.photos.length;
  return (
    <Card>
      <CardBody>
        <Stack gap="tight">
          <Inline gap="tight" justify="between">
            <Text variant="label">{post.author.name}</Text>
            <Inline gap="tight">
              {post.pinned ? <Badge tone="accent">Pinned</Badge> : null}
              {post.hidden ? <Badge tone="warning">Hidden</Badge> : null}
              {post.locked ? <Badge tone="neutral">Locked</Badge> : null}
              {post.status === 'published' ? null : <Badge tone="warning">{STATUS_BADGE[post.status]}</Badge>}
              <Text variant="meta" tone="muted">
                {formatDate(post.createdAt)}
              </Text>
            </Inline>
          </Inline>
          <MentionBody body={post.body} />
          <PostPhotos postId={post.id} photos={post.photos} action={action} remove={href === null && post.canDelete} />
          {addPhotos && room > 0 ? <PhotoAdder action={action} postId={post.id} channelId={post.channelId} room={room} /> : null}
          <ReactionBar action={action} targetType="post" targetId={post.id} reactions={post.reactions} enabled={signedIn} />
          <Inline gap="tight">
            {href ? <AppLink href={href}>{commentsLabel(post.commentCount)}</AppLink> : null}
            {moderate ? (
              <>
                <ActionForm action={action} inline variant="ghost" submit={post.pinned ? 'Unpin' : 'Pin'} fields={{ op: 'pinPost', ...id, pinned: String(!post.pinned) }} />
                <ActionForm action={action} inline variant="ghost" submit={post.hidden ? 'Unhide' : 'Hide'} fields={{ op: 'hidePost', ...id, hidden: String(!post.hidden) }} />
                <ActionForm action={action} inline variant="ghost" submit={post.locked ? 'Unlock' : 'Lock'} fields={{ op: 'lockPost', ...id, locked: String(!post.locked) }} />
                {post.status === 'published' ? null : (
                  <ActionForm action={action} inline variant="ghost" submit="Approve" fields={{ op: 'reviewPost', ...id, decision: 'approve' }} />
                )}
                {post.status === 'pending' ? (
                  <ActionForm action={action} inline variant="ghost" submit="Reject" fields={{ op: 'reviewPost', ...id, decision: 'reject' }} />
                ) : null}
              </>
            ) : null}
            {post.canDelete ? (
              <ActionForm
                action={action}
                inline
                variant="ghost"
                submit="Delete"
                confirm={{ title: 'Delete this post?', description: 'Its comments are deleted too.' }}
                fields={{ op: 'deletePost', ...id, ...(afterDelete ? { redirectTo: afterDelete } : {}) }}
              />
            ) : null}
            {report && signedIn && !post.mine ? <ReportForm targetType="post" targetId={post.id} action={report} /> : null}
          </Inline>
        </Stack>
      </CardBody>
    </Card>
  );
}
