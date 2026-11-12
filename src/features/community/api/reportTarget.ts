// Reportable content (post, comment on a post, channel chat line) as one shape. No permission
// checks here: callers pair it with the viewer's ChannelAccess (readable / removable).
// Mirrors report_target_channel() and can_read_report_target() in SQL.
import type { Repo } from '@/lib/data/repo';
import type { ReportTarget } from '@/lib/data/types';
import type { FileStore } from '@/lib/storage/fileStore';
import type { ChannelAccess } from './access';
import { postFilePaths, removeFiles } from './files';

export type ReportContent = {
  type: ReportTarget;
  id: string;
  channelId: string;
  /** Post the content sits on (itself for a post); null for chat lines. */
  postId: string | null;
  authorId: string;
  body: string;
  postHidden: boolean;
  commentHidden: boolean;
};

export async function reportContent(repo: Repo, type: ReportTarget, id: string): Promise<ReportContent | null> {
  const base = { type, id, postHidden: false, commentHidden: false };
  if (type === 'message') {
    const m = await repo.message(id);
    if (!m?.channelId) return null;
    return { ...base, channelId: m.channelId, postId: null, authorId: m.authorId, body: m.body };
  }
  const comment = type === 'comment' ? await repo.comment(id) : null;
  if (type === 'comment' && comment?.targetType !== 'post') return null;
  const post = await repo.post(comment ? comment.targetId : id);
  if (!post) return null;
  const { authorId, body } = comment ?? post;
  return {
    ...base,
    channelId: post.channelId,
    postId: post.id,
    authorId,
    body,
    postHidden: post.hiddenAt !== null,
    commentHidden: comment !== null && comment.hiddenAt !== null,
  };
}

/** Hidden content stays visible to its moderators only. */
export const readsContent = (rules: ChannelAccess, c: ReportContent): boolean =>
  rules.read && (!c.postHidden || rules.moderatePosts) && (!c.commentHidden || rules.moderateComments);

/** Comments need comment moderation; posts and chat lines need post moderation. */
export const removesContent = (rules: ChannelAccess, c: ReportContent): boolean =>
  c.type === 'comment' ? rules.moderateComments : rules.moderatePosts;

/** Deletes the content, then its files (post photos, chat attachment). */
export async function removeContent(repo: Repo, files: FileStore, c: ReportContent): Promise<void> {
  if (c.type === 'comment') return repo.deleteComment(c.id);
  if (c.type === 'post') {
    const paths = await postFilePaths(repo, [c.id]);
    await repo.deletePost(c.id);
    return removeFiles(files, paths);
  }
  const attachment = (await repo.message(c.id))?.attachment;
  await repo.deleteMessage(c.id);
  await removeFiles(files, attachment ? [attachment.path] : []);
}
