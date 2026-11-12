// Comments on a post or a lesson step: top-level comments, one reply level (Kajabi), composer.
import type { FormAction } from '@/components/ActionForm/ActionForm';
import { ActionForm } from '@/components/ActionForm/ActionForm';
import { Badge, Heading, Inline, Stack, Text } from '@/components/ui/mds';
import { formatDate } from '@/lib/format/date';
import type { MentionOption } from '@/lib/mentions/markup';
import type { CommentItem, CommentNode } from '../api/present';
import { Composer } from './Composer';
import { MentionBody } from './MentionBody';
import { ReactionBar } from './ReactionBar';
import { ReportForm } from './ReportForm';
import styles from './community.module.css';

type Props = {
  action: FormAction;
  target: { type: 'post' | 'step'; id: string };
  comments: readonly CommentNode[];
  members: readonly MentionOption[];
  canComment: boolean;
  /** Locked or unpublished post: no new comments (postOpen). */
  closed?: boolean;
  moderate: boolean;
  /** Report action (app/: it pushes to moderators). None: no Report button. */
  report?: FormAction;
};

type ItemProps = Omit<Props, 'comments' | 'target'> & { comment: CommentItem; target: Props['target'] };

function Comment({ comment, action, moderate, canComment, target, report }: ItemProps) {
  const id = { commentId: comment.id };
  return (
    <Stack gap="tight">
      <Inline gap="tight">
        <Text variant="label">{comment.author.name}</Text>
        <Text variant="meta" tone="muted">
          {formatDate(comment.createdAt)}
        </Text>
        {comment.hidden ? <Badge tone="warning">Hidden</Badge> : null}
      </Inline>
      <MentionBody body={comment.body} />
      <Inline gap="tight">
        <ReactionBar action={action} targetType="comment" targetId={comment.id} reactions={comment.reactions} enabled={canComment} />
        {moderate ? (
          <ActionForm action={action} inline variant="ghost" submit={comment.hidden ? 'Unhide' : 'Hide'} fields={{ op: 'hideComment', ...id, hidden: String(!comment.hidden) }} />
        ) : null}
        {comment.canDelete ? (
          <ActionForm action={action} inline variant="ghost" submit="Delete" confirm="Delete this comment?" fields={{ op: 'deleteComment', ...id }} />
        ) : null}
        {/* Only comments on posts are reportable (lesson comments have no channel). */}
        {report && target.type === 'post' && canComment && !comment.mine ? (
          <ReportForm targetType="comment" targetId={comment.id} action={report} />
        ) : null}
      </Inline>
    </Stack>
  );
}

export function CommentThread(props: Props) {
  const { action, target, comments, members, canComment, closed = false } = props;
  const write = canComment && !closed;
  const fields = { op: 'createComment', targetType: target.type, targetId: target.id };
  return (
    <Stack gap="loose" as="section" aria-label="Comments">
      <Heading level={2}>
        Comments
      </Heading>
      {comments.length === 0 ? <Text tone="muted">No comments yet.</Text> : null}
      {comments.map((c) => (
        <Stack key={c.id} gap="base">
          <Comment {...props} comment={c} />
          <div className={styles.replies}>
            <Stack gap="base">
              {c.replies.map((r) => (
                <Comment key={r.id} {...props} comment={r} />
              ))}
              {write ? (
                <Composer action={action} fields={{ ...fields, parentId: c.id }} members={members} submit="Reply" label={`Reply to ${c.author.name}`} rows={2} />
              ) : null}
            </Stack>
          </div>
        </Stack>
      ))}
      {write ? (
        <Composer action={action} fields={fields} members={members} submit="Comment" label="Write a comment" placeholder="Write a comment… use @ to mention" />
      ) : (
        <Text tone="muted">{closed ? 'Comments are closed.' : 'Sign in to comment.'}</Text>
      )}
    </Stack>
  );
}
