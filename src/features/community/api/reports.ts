// Reports (G12, G15): a member reports a post, a comment on a post or a channel chat line they
// can read, once. Moderators of the channel (staff with community.moderate, or a picked channel
// moderator) dismiss it or remove the content. Resolved reports stay, signed. Only staff see
// who reported. Mirrored in SQL by the reports policies and report_reporters().
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import { ConstraintError } from '@/lib/data/errors';
import { spaceNames } from '@/lib/data/names';
import type { Repo } from '@/lib/data/repo';
import type { Product, Report, ReportStatus, ReportTarget } from '@/lib/data/types';
import { getPlainText } from '@/lib/mentions/markup';
import type { FileStore } from '@/lib/storage/fileStore';
import { channelHref, postHref } from '../paths';
import { channelScope, communityAccess, moderatedChannels } from './access';
import { authorOf } from './present';
import { editable } from './studio';
import { readsContent, removeContent, removesContent, reportContent, type ReportContent } from './reportTarget';

export type ReportCommand =
  | { op: 'report'; targetType: ReportTarget; targetId: string; reason: string | null }
  | { op: 'resolveReport'; reportId: string; action: 'dismiss' | 'remove' };

const OK: CommandResult = { ok: true };
const FORBIDDEN: CommandResult = { ok: false, error: 'forbidden' };
const NOT_FOUND: CommandResult = { ok: false, error: 'not_found' };

type Ctx = { repo: Repo; files: FileStore; viewer: Viewer; me: string; now: Date };

async function report(ctx: Ctx, cmd: Extract<ReportCommand, { op: 'report' }>): Promise<CommandResult> {
  const content = await reportContent(ctx.repo, cmd.targetType, cmd.targetId);
  const scope = content ? await channelScope(ctx.repo, ctx.viewer, content.channelId, ctx.now) : null;
  if (!content || !scope || !readsContent(scope.rules, content)) return NOT_FOUND;
  if (content.authorId === ctx.me) return FORBIDDEN;
  const reason = cmd.reason?.trim() || null;
  await ctx.repo.createReport({ targetType: content.type, targetId: content.id, reporterId: ctx.me, reason, createdAt: ctx.now });
  return OK;
}

async function resolve(ctx: Ctx, cmd: Extract<ReportCommand, { op: 'resolveReport' }>): Promise<CommandResult> {
  const row = await ctx.repo.report(cmd.reportId);
  const scope = row ? await channelScope(ctx.repo, ctx.viewer, row.channelId, ctx.now) : null;
  if (!row || !scope) return NOT_FOUND;
  if (!scope.rules.moderatePosts) return FORBIDDEN;
  if (row.status !== 'open') return { ok: false, error: 'invalid', message: 'This report is already resolved.' };
  const signed = { resolvedBy: ctx.me, resolvedAt: ctx.now };
  if (cmd.action === 'dismiss') {
    await ctx.repo.resolveReports([row.id], { status: 'dismissed', ...signed });
    return OK;
  }
  const content = await reportContent(ctx.repo, row.targetType, row.targetId);
  if (content) {
    if (!removesContent(scope.rules, content)) return FORBIDDEN;
    await removeContent(ctx.repo, ctx.files, content);
  }
  // Every open report on the same content closes with it.
  const same = (await ctx.repo.reports(row.communityId)).filter(
    (r) => r.status === 'open' && r.targetType === row.targetType && r.targetId === row.targetId,
  );
  await ctx.repo.resolveReports(
    same.map((r) => r.id),
    { status: 'removed', ...signed },
  );
  return OK;
}

export async function reportCommand(repo: Repo, files: FileStore, viewer: Viewer, cmd: ReportCommand, now: Date): Promise<CommandResult> {
  if (!viewer.profile) return FORBIDDEN;
  const ctx = { repo, files, viewer, me: viewer.profile.id, now };
  try {
    return cmd.op === 'report' ? await report(ctx, cmd) : await resolve(ctx, cmd);
  } catch (e) {
    if (e instanceof ConstraintError) return { ok: false, error: 'invalid', message: e.message };
    throw e;
  }
}

/** Preview length in the queue. */
export const PREVIEW_MAX = 280;

export type ReportEntry = {
  id: string;
  targetType: ReportTarget;
  channel: string;
  /** Where the content lives (post page or chat channel). */
  href: string;
  /** Null once the content is gone. */
  preview: { author: string; body: string } | null;
  reason: string | null;
  createdAt: Date;
  /** Staff only; null for channel moderators. */
  reporter: string | null;
  status: ReportStatus;
  resolvedBy: string | null;
  resolvedAt: Date | null;
};

export type ReportQueue = { community: Product; reporters: boolean; open: ReportEntry[]; resolved: ReportEntry[] };

const cut = (text: string): string => (text.length > PREVIEW_MAX ? `${text.slice(0, PREVIEW_MAX - 1)}…` : text);

/** Reports in the channels the viewer moderates, newest first. Null when they moderate none. */
export async function reportQueue(repo: Repo, viewer: Viewer, community: Product, now: Date): Promise<ReportQueue | null> {
  const me = viewer.profile?.id;
  if (!me) return null;
  const access = await communityAccess(repo, viewer, community, now);
  if (!access.read) return null;
  const channels = await moderatedChannels(repo, access, await repo.channels(community.id), me);
  const moderated = new Map(channels.map((c) => [c.id, c]));
  if (moderated.size === 0) return null;
  const [rows, reporters, names] = await Promise.all([
    repo.reports(community.id),
    access.moderatePosts ? repo.reportReporters(community.id) : Promise.resolve<Record<string, string>>({}),
    spaceNames(repo, community.spaceId),
  ]);
  const name = (id: string | null | undefined) => (id ? authorOf(names, id).name : null);
  const entry = async (r: Report): Promise<ReportEntry> => {
    const content: ReportContent | null = await reportContent(repo, r.targetType, r.targetId);
    return {
      id: r.id,
      targetType: r.targetType,
      channel: moderated.get(r.channelId)!.title,
      href: content?.postId ? postHref(community.slug, content.postId) : channelHref(community.slug, r.channelId),
      preview: content ? { author: authorOf(names, content.authorId).name, body: cut(getPlainText(content.body)) } : null,
      reason: r.reason,
      createdAt: r.createdAt,
      reporter: name(reporters[r.id]),
      status: r.status,
      resolvedBy: name(r.resolvedBy),
      resolvedAt: r.resolvedAt,
    };
  };
  const entries = await Promise.all(rows.filter((r) => moderated.has(r.channelId)).map(entry));
  return {
    community,
    reporters: access.moderatePosts,
    open: entries.filter((e) => e.status === 'open'),
    resolved: entries.filter((e) => e.status !== 'open'),
  };
}

/** Studio queue: staff with community.moderate, a community of the viewer's space. */
export async function studioReportQueue(repo: Repo, viewer: Viewer, communityId: string, now: Date): Promise<ReportQueue | null> {
  if (!viewerCan(viewer, 'community.moderate')) return null;
  const community = await editable(repo, viewer, communityId);
  return community ? reportQueue(repo, viewer, community, now) : null;
}
