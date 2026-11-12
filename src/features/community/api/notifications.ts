// The viewer's notification feed, unread badge, mark-all-read, and step (lesson) comment threads.
import type { Viewer } from '@/lib/auth/viewer';
import { viewerCan } from '@/lib/auth/viewer';
import type { Repo } from '@/lib/data/repo';
import type { Notification, NotificationType } from '@/lib/data/types';
import type { StepGate } from './commands';
import { spaceNames } from '@/lib/data/names';
import { authorOf, buildThread, type CommentNode } from './present';

/** Where a notification leads. The app turns this into a URL (programs paths live in another feature). */
export type NotificationLink =
  | { kind: 'post'; community: string; postId: string }
  | { kind: 'step'; program: string; stepId: string }
  | { kind: 'reports'; community: string };

export type NotificationItem = {
  id: string;
  text: string;
  link: NotificationLink | null;
  createdAt: Date;
  unread: boolean;
};

export const FEED_LIMIT = 50;

const PHRASES: Record<NotificationType, (target: string) => string> = {
  comment: () => 'commented on your post',
  reply: () => 'replied to your comment',
  mention: () => 'mentioned you',
  reaction: () => 'reacted to your contribution',
  step_comment: (target) => `commented on ${target}`,
  report: (target) => `reported content in ${target}`,
};

type Target = { link: NotificationLink; title: string };

async function postTarget(repo: Repo, postId: string): Promise<Target | null> {
  const post = await repo.post(postId);
  const channel = post ? await repo.channel(post.channelId) : null;
  const community = channel ? await repo.product(channel.communityId) : null;
  return community ? { link: { kind: 'post', community: community.slug, postId }, title: community.title } : null;
}

async function stepTarget(repo: Repo, stepId: string): Promise<Target | null> {
  const step = await repo.step(stepId);
  const mod = step ? await repo.module(step.moduleId) : null;
  const program = mod ? await repo.product(mod.programId) : null;
  return step && program ? { link: { kind: 'step', program: program.slug, stepId }, title: step.title } : null;
}

async function reportsTarget(repo: Repo, communityId: string): Promise<Target | null> {
  const community = await repo.product(communityId);
  return community ? { link: { kind: 'reports', community: community.slug }, title: community.title } : null;
}

type Describable = Pick<Notification, 'recipientId' | 'actorId' | 'type' | 'postId' | 'stepId' | 'communityId'>;

const targetOf = (repo: Repo, n: Describable): Promise<Target | null> => {
  if (n.postId) return postTarget(repo, n.postId);
  if (n.stepId) return stepTarget(repo, n.stepId);
  return n.communityId ? reportsTarget(repo, n.communityId) : Promise.resolve(null);
};

export type NotificationText = { recipientId: string; text: string; link: NotificationLink | null };

/** Text and link of each notification. SSOT for the feed and web push. */
export async function describeNotifications(repo: Repo, spaceId: string, rows: readonly Describable[]): Promise<NotificationText[]> {
  const [names, targets] = await Promise.all([spaceNames(repo, spaceId), Promise.all(rows.map((n) => targetOf(repo, n)))]);
  return rows.map((n, i) => {
    const target = targets[i] ?? null;
    return {
      recipientId: n.recipientId,
      text: `${authorOf(names, n.actorId).name} ${PHRASES[n.type](target?.title ?? 'a lesson')}`,
      link: target?.link ?? null,
    };
  });
}

export async function notificationFeed(repo: Repo, viewer: Viewer): Promise<NotificationItem[]> {
  if (!viewer.profile) return [];
  const rows = await repo.notifications(viewer.space.id, viewer.profile.id, FEED_LIMIT);
  const texts = await describeNotifications(repo, viewer.space.id, rows);
  return rows.map((n, i) => ({
    id: n.id,
    text: texts[i]!.text,
    link: texts[i]!.link,
    createdAt: n.createdAt,
    unread: n.readAt === null,
  }));
}

export async function unreadCount(repo: Repo, viewer: Viewer): Promise<number> {
  return viewer.profile ? repo.unreadNotificationCount(viewer.space.id, viewer.profile.id) : 0;
}

export async function markAllRead(repo: Repo, viewer: Viewer, now: Date): Promise<void> {
  if (viewer.profile) await repo.markNotificationsRead(viewer.space.id, viewer.profile.id, now);
}

export type StepThread = { comments: CommentNode[]; canComment: boolean; moderate: boolean };

/** Lesson comments (polymorphic target 'step'). Null when the step is not open to the viewer. */
export async function stepThread(repo: Repo, viewer: Viewer, stepId: string, gate: StepGate): Promise<StepThread | null> {
  if (!(await gate(stepId))) return null;
  const moderate = viewerCan(viewer, 'comments.moderate');
  const [rows, names] = await Promise.all([repo.comments('step', [stepId]), spaceNames(repo, viewer.space.id)]);
  const mine = rows.filter((c) => c.spaceId === viewer.space.id);
  const reactions = await repo.reactions('comment', mine.map((c) => c.id));
  return {
    comments: buildThread(mine, reactions, names, viewer.profile?.id ?? null, moderate),
    canComment: viewer.profile !== null,
    moderate,
  };
}
