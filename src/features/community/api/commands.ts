// Community writes: posts, comments (post + step), reactions, and the notifications they cause.
// One entry point; every op resolves its scope (community or step), then checks the rule.
import { can } from '@/lib/auth/capabilities';
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import { ConstraintError } from '@/lib/data/errors';
import type { Repo } from '@/lib/data/repo';
import { REACTION_EMOJIS, type Comment, type Post, type Product, type ReactionEmoji } from '@/lib/data/types';
import { mentionIdsFromBody } from '@/lib/mentions/parse';
import { POST_PHOTOS_MAX } from '@/lib/storage/communityFiles';
import type { FileStore } from '@/lib/storage/fileStore';
import { inFolder } from '@/lib/storage/uploadPath';
import { channelScope as findChannel, type ChannelAccess } from './access';
import { directory } from './feed';
import { channelFolderOf, postFilePaths, removeFiles } from './files';
import { buildNotifications, type Candidate, type NotificationBase } from './notify';

/** Whether the viewer may open a step (programs feature decides; the app injects it). */
export type StepGate = (stepId: string) => Promise<boolean>;

export type CommunityCommand =
  | { op: 'createPost'; channelId: string; body: string; photos?: string[] }
  | { op: 'addPostPhotos'; postId: string; photos: string[] }
  | { op: 'removePostPhoto'; postId: string; photoId: string }
  | { op: 'deletePost'; postId: string }
  | { op: 'hidePost'; postId: string; hidden: boolean }
  | { op: 'pinPost'; postId: string; pinned: boolean }
  | { op: 'createComment'; target: { type: 'post' | 'step'; id: string }; parentId: string | null; body: string }
  | { op: 'deleteComment'; commentId: string }
  | { op: 'hideComment'; commentId: string; hidden: boolean }
  | { op: 'react'; target: { type: 'post' | 'comment'; id: string }; emoji: string; on: boolean };

const OK: CommandResult = { ok: true };
const FORBIDDEN: CommandResult = { ok: false, error: 'forbidden' };
const NOT_FOUND: CommandResult = { ok: false, error: 'not_found' };

type Ctx = { repo: Repo; files: FileStore; viewer: Viewer; me: string; now: Date; gate: StepGate };

/** Where a comment lives: a post of a community, or a step of a program. */
type Scope =
  | { kind: 'post'; post: Post; community: Product; rules: ChannelAccess }
  | { kind: 'step'; stepId: string; moderate: boolean };

type Found<T> = { ok: true; value: T } | { ok: false; result: CommandResult };
const fail = <T>(result: CommandResult): Found<T> => ({ ok: false, result });

const channelScope = (ctx: Ctx, channelId: string) => findChannel(ctx.repo, ctx.viewer, channelId, ctx.now);

async function postScope(ctx: Ctx, postId: string): Promise<Found<Extract<Scope, { kind: 'post' }>>> {
  const post = await ctx.repo.post(postId);
  const found = post ? await channelScope(ctx, post.channelId) : null;
  if (!post || !found) return fail(NOT_FOUND);
  if (!found.rules.read) return fail(FORBIDDEN);
  if (post.hiddenAt !== null && !found.rules.moderatePosts) return fail(NOT_FOUND);
  return { ok: true, value: { kind: 'post', post, community: found.community, rules: found.rules } };
}

async function targetScope(ctx: Ctx, type: 'post' | 'step', id: string): Promise<Found<Scope>> {
  if (type === 'post') return postScope(ctx, id);
  if (!(await ctx.gate(id))) return fail(FORBIDDEN);
  return { ok: true, value: { kind: 'step', stepId: id, moderate: viewerCan(ctx.viewer, 'comments.moderate') } };
}

async function commentScope(ctx: Ctx, commentId: string): Promise<Found<{ comment: Comment; scope: Scope }>> {
  const comment = await ctx.repo.comment(commentId);
  if (!comment || comment.spaceId !== ctx.viewer.space.id) return fail(NOT_FOUND);
  const scope = await targetScope(ctx, comment.targetType, comment.targetId);
  if (!scope.ok) return scope;
  if (comment.hiddenAt !== null && !moderatesComments(scope.value)) return fail(NOT_FOUND);
  return { ok: true, value: { comment, scope: scope.value } };
}

const moderatesComments = (scope: Scope): boolean => (scope.kind === 'post' ? scope.rules.moderateComments : scope.moderate);

const notificationBase = (ctx: Ctx, scope: Scope): NotificationBase => ({
  spaceId: ctx.viewer.space.id,
  actorId: ctx.me,
  postId: scope.kind === 'post' ? scope.post.id : null,
  stepId: scope.kind === 'step' ? scope.stepId : null,
  createdAt: ctx.now,
});

/** Who may receive a notification in this scope: community = directory; step = anyone already involved. */
async function receivers(ctx: Ctx, scope: Scope): Promise<(id: string) => boolean> {
  if (scope.kind === 'step') return () => true;
  const ids = new Set((await directory(ctx.repo, scope.community, ctx.now)).map((m) => m.id));
  return (id) => ids.has(id);
}

async function notify(ctx: Ctx, scope: Scope, candidates: readonly Candidate[]): Promise<void> {
  const rows = buildNotifications(notificationBase(ctx, scope), candidates, await receivers(ctx, scope));
  if (rows.length > 0) await ctx.repo.addNotifications(rows);
}

const mentions = (body: string): Candidate[] => mentionIdsFromBody(body).map((recipientId) => ({ recipientId, type: 'mention' }));

async function stepModerators(ctx: Ctx): Promise<Candidate[]> {
  return (await ctx.repo.members(ctx.viewer.space.id))
    .filter((m) => can(m.role, 'comments.moderate'))
    .map((m) => ({ recipientId: m.profileId, type: 'step_comment' }));
}

/** Photo paths must be uploaded into the post's channel folder (the DB checks again). */
function photoProblem(community: Product, channelId: string, photos: readonly string[], had = 0): CommandResult | null {
  if (had + photos.length > POST_PHOTOS_MAX) return { ok: false, error: 'invalid', message: `A post takes up to ${POST_PHOTOS_MAX} photos.` };
  const folder = channelFolderOf(community, channelId);
  if (photos.some((p) => !inFolder(p, folder))) return { ok: false, error: 'invalid', message: 'This photo does not belong to the post.' };
  return null;
}

async function editPhotos(ctx: Ctx, cmd: Extract<CommunityCommand, { op: 'addPostPhotos' | 'removePostPhoto' }>): Promise<CommandResult> {
  const found = await postScope(ctx, cmd.postId);
  if (!found.ok) return found.result;
  const { post, community, rules } = found.value;
  const current = await ctx.repo.postPhotos([post.id]);
  if (cmd.op === 'addPostPhotos') {
    if (post.authorId !== ctx.me || !rules.post) return FORBIDDEN;
    const problem = photoProblem(community, post.channelId, cmd.photos, current.length);
    if (problem) return problem;
    await ctx.repo.addPostPhotos(post.id, cmd.photos);
    return OK;
  }
  const photo = current.find((p) => p.id === cmd.photoId);
  if (!photo) return NOT_FOUND;
  if (post.authorId !== ctx.me && !rules.moderatePosts) return FORBIDDEN;
  await ctx.repo.deletePostPhoto(photo.id);
  await removeFiles(ctx.files, [photo.path]);
  return OK;
}

const isEmoji = (value: string): value is ReactionEmoji => (REACTION_EMOJIS as readonly string[]).includes(value);

async function run(ctx: Ctx, cmd: CommunityCommand): Promise<CommandResult> {
  const { repo } = ctx;
  switch (cmd.op) {
    case 'createPost': {
      const found = await channelScope(ctx, cmd.channelId);
      if (!found) return NOT_FOUND;
      if (found.channel.kind !== 'feed') return { ok: false, error: 'invalid', message: 'Chat channels take messages.' };
      if (!found.rules.post) return FORBIDDEN;
      const photos = cmd.photos ?? [];
      const problem = photoProblem(found.community, found.channel.id, photos);
      if (problem) return problem;
      const post = await repo.createPost({ channelId: cmd.channelId, authorId: ctx.me, body: cmd.body, createdAt: ctx.now });
      if (photos.length > 0) await repo.addPostPhotos(post.id, photos);
      await notify(ctx, { kind: 'post', post, community: found.community, rules: found.rules }, mentions(cmd.body));
      return { ok: true, id: post.id };
    }
    case 'addPostPhotos':
    case 'removePostPhoto':
      return editPhotos(ctx, cmd);
    case 'deletePost':
    case 'hidePost':
    case 'pinPost': {
      const found = await postScope(ctx, cmd.postId);
      if (!found.ok) return found.result;
      const { post, rules } = found.value;
      if (cmd.op === 'deletePost') {
        if (!rules.moderatePosts && post.authorId !== ctx.me) return FORBIDDEN;
        const paths = await postFilePaths(repo, [post.id]);
        await repo.deletePost(post.id);
        await removeFiles(ctx.files, paths);
        return OK;
      }
      if (!rules.moderatePosts) return FORBIDDEN;
      await repo.updatePost(post.id, cmd.op === 'pinPost' ? { pinned: cmd.pinned } : { hiddenAt: cmd.hidden ? ctx.now : null });
      return OK;
    }
    case 'createComment': {
      const found = await targetScope(ctx, cmd.target.type, cmd.target.id);
      if (!found.ok) return found.result;
      const scope = found.value;
      const parent = cmd.parentId ? await repo.comment(cmd.parentId) : null;
      const comment = await repo.createComment({
        spaceId: ctx.viewer.space.id,
        targetType: cmd.target.type,
        targetId: cmd.target.id,
        parentId: cmd.parentId,
        authorId: ctx.me,
        body: cmd.body,
        createdAt: ctx.now,
      });
      const reply: Candidate[] = parent ? [{ recipientId: parent.authorId, type: 'reply' }] : [];
      const rest: Candidate[] =
        scope.kind === 'post'
          ? [{ recipientId: scope.post.authorId, type: 'comment' }, ...mentions(cmd.body)]
          : await stepModerators(ctx);
      await notify(ctx, scope, [...reply, ...rest]);
      return { ok: true, id: comment.id };
    }
    case 'deleteComment':
    case 'hideComment': {
      const found = await commentScope(ctx, cmd.commentId);
      if (!found.ok) return found.result;
      const { comment, scope } = found.value;
      const moderate = moderatesComments(scope);
      if (cmd.op === 'deleteComment') {
        if (!moderate && comment.authorId !== ctx.me) return FORBIDDEN;
        await repo.deleteComment(comment.id);
        return OK;
      }
      if (!moderate) return FORBIDDEN;
      await repo.updateComment(comment.id, { hiddenAt: cmd.hidden ? ctx.now : null });
      return OK;
    }
    case 'react': {
      if (!isEmoji(cmd.emoji)) return { ok: false, error: 'invalid', message: 'Unknown reaction.' };
      let scope: Scope;
      let authorId: string;
      if (cmd.target.type === 'post') {
        const found = await postScope(ctx, cmd.target.id);
        if (!found.ok) return found.result;
        scope = found.value;
        authorId = found.value.post.authorId;
      } else {
        const found = await commentScope(ctx, cmd.target.id);
        if (!found.ok) return found.result;
        scope = found.value.scope;
        authorId = found.value.comment.authorId;
      }
      const before = await repo.reactions(cmd.target.type, [cmd.target.id]);
      const first = cmd.on && !before.some((r) => r.profileId === ctx.me);
      await repo.setReaction(
        { targetType: cmd.target.type, targetId: cmd.target.id, profileId: ctx.me, emoji: cmd.emoji, createdAt: ctx.now },
        cmd.on,
      );
      if (first) await notify(ctx, scope, [{ recipientId: authorId, type: 'reaction' }]);
      return OK;
    }
  }
}

export async function communityCommand(
  repo: Repo,
  files: FileStore,
  viewer: Viewer,
  cmd: CommunityCommand,
  now: Date,
  gate: StepGate,
): Promise<CommandResult> {
  if (!viewer.profile) return FORBIDDEN;
  try {
    return await run({ repo, files, viewer, me: viewer.profile.id, now, gate }, cmd);
  } catch (e) {
    if (e instanceof ConstraintError) return { ok: false, error: 'invalid', message: e.message };
    throw e;
  }
}
