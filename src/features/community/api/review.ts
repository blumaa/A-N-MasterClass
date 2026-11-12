// Review feed (Kajabi): tabs for reports, pending, rejected, hidden and locked posts, and the
// moderation log (filter by action and date range). Only the channels the viewer moderates;
// the log also shows everything to comment moderators. Mirrors moderation_log_read in SQL.
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import { spaceNames } from '@/lib/data/names';
import type { Repo } from '@/lib/data/repo';
import { MODERATION_ACTIONS, type ModerationAction, type ModerationLogEntry, type Post, type Product } from '@/lib/data/types';
import { getPlainText } from '@/lib/mentions/markup';
import { postHref } from '../paths';
import { channelAccess, communityAccess, type CommunityAccess } from './access';
import { postItems, type PostItem } from './feed';
import { authorOf } from './present';
import { reportContent } from './reportTarget';
import { PREVIEW_MAX, reportQueue, type ReportQueue } from './reports';
import { editable } from './studio';

export const REVIEW_TABS = ['reports', 'pending', 'rejected', 'hidden', 'locked', 'log'] as const;
export type ReviewTab = (typeof REVIEW_TABS)[number];
type PostTab = Exclude<ReviewTab, 'reports' | 'log'>;

/** Dates are YYYY-MM-DD (UTC days), both ends included. */
export type LogFilter = { action: ModerationAction | null; from: string | null; to: string | null };

export type LogItem = {
  id: string;
  /** 'Someone' once the moderator is erased. */
  actor: string;
  action: ModerationAction;
  targetType: 'post' | 'comment';
  channel: string;
  /** Null once the content is gone. */
  preview: string | null;
  href: string | null;
  createdAt: Date;
};

export type Review = { community: Product } & (
  | { tab: 'reports'; queue: ReportQueue }
  | { tab: PostTab; posts: PostItem[] }
  | { tab: 'log'; filter: LogFilter; entries: LogItem[] }
);

type Query = Readonly<Record<string, string | string[] | undefined>>;

export const reviewTabOf = (raw: Query[string]): ReviewTab => REVIEW_TABS.find((t) => t === raw) ?? 'reports';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
/** A real calendar day, else null. */
const dayOf = (raw: Query[string]): string | null =>
  typeof raw === 'string' && DAY.test(raw) && new Date(`${raw}T00:00:00Z`).toISOString().startsWith(raw) ? raw : null;

export const logFilterOf = (query: Query): LogFilter => ({
  action: MODERATION_ACTIONS.find((a) => a === query.action) ?? null,
  from: dayOf(query.from),
  to: dayOf(query.to),
});

const IN_TAB: Record<PostTab, (p: Post) => boolean> = {
  pending: (p) => p.status === 'pending',
  rejected: (p) => p.status === 'rejected',
  hidden: (p) => p.hiddenAt !== null,
  locked: (p) => p.lockedAt !== null,
};

const cut = (text: string): string => (text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1)}…` : text);

const NEXT_DAY = 24 * 60 * 60 * 1000;
const matches = (f: LogFilter) => (e: ModerationLogEntry): boolean =>
  (!f.action || e.action === f.action) &&
  (!f.from || e.createdAt >= new Date(`${f.from}T00:00:00Z`)) &&
  (!f.to || e.createdAt.getTime() < new Date(`${f.to}T00:00:00Z`).getTime() + NEXT_DAY);

async function logItems(repo: Repo, community: Product, access: CommunityAccess, moderated: ReadonlySet<string>, filter: LogFilter): Promise<LogItem[]> {
  const [rows, names, channels] = await Promise.all([repo.moderationLog(community.id), spaceNames(repo, community.spaceId), repo.channels(community.id)]);
  const titles = new Map(channels.map((c) => [c.id, c.title]));
  const shown = rows.filter((e) => access.moderateComments || moderated.has(e.channelId)).filter(matches(filter));
  return Promise.all(
    shown.map(async (e) => {
      const content = await reportContent(repo, e.targetType, e.targetId);
      return {
        id: e.id,
        actor: e.actorId ? authorOf(names, e.actorId).name : 'Someone',
        action: e.action,
        targetType: e.targetType,
        channel: titles.get(e.channelId) ?? '',
        preview: content ? cut(getPlainText(content.body)) : null,
        href: content?.postId ? postHref(community.slug, content.postId) : null,
        createdAt: e.createdAt,
      };
    }),
  );
}

/** One review tab. Null when the viewer moderates no channel here. */
export async function review(repo: Repo, viewer: Viewer, community: Product, tab: ReviewTab, filter: LogFilter, now: Date): Promise<Review | null> {
  const me = viewer.profile?.id;
  if (!me) return null;
  const access = await communityAccess(repo, viewer, community, now);
  if (!access.read) return null;
  const all = await repo.channels(community.id);
  const rules = await Promise.all(all.map((c) => channelAccess(repo, access, c, me)));
  const moderated = all.flatMap((c, i) => (rules[i]!.moderatePosts ? [{ channel: c, rules: rules[i]! }] : []));
  if (moderated.length === 0) return null;
  if (tab === 'reports') {
    const queue = await reportQueue(repo, viewer, community, now);
    return queue && { community, tab, queue };
  }
  if (tab === 'log') {
    const ids = new Set(moderated.map((m) => m.channel.id));
    return { community, tab, filter, entries: await logItems(repo, community, access, ids, filter) };
  }
  const lists = await Promise.all(
    moderated.map(async (m) => postItems(repo, viewer, community, (await repo.posts(m.channel.id)).filter(IN_TAB[tab]), m.rules)),
  );
  return { community, tab, posts: lists.flat() };
}

/** Studio review feed: staff with community.moderate, a community of the viewer's space. */
export async function studioReview(repo: Repo, viewer: Viewer, communityId: string, tab: ReviewTab, filter: LogFilter, now: Date): Promise<Review | null> {
  if (!viewerCan(viewer, 'community.moderate')) return null;
  const community = await editable(repo, viewer, communityId);
  return community ? review(repo, viewer, community, tab, filter, now) : null;
}
