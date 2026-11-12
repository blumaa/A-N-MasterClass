// Moderation part of the fake repo: channel moderators and reports. Same rules as
// supabase/migrations/*_moderation.sql (reports_once, reports_reason, reports_target trigger).
import { ALREADY_REPORTED, ConstraintError, REPORT_TARGET_MISSING } from '../errors';
import { REPORT_REASON_MAX, REPORT_REASON_RANGE } from '../limits';
import type { Repo } from '../repo';
import type { Report, ReportTarget } from '../types';
import type { Db } from './db';

type ModerationRepo = Pick<
  Repo,
  | 'channelModerators'
  | 'setChannelModerator'
  | 'reports'
  | 'report'
  | 'createReport'
  | 'resolveReports'
  | 'reportReporters'
>;

/** Stored row: the reporter stays out of Report (SQL: no column grant). */
export type FakeReport = Report & { reporterId: string };

const withoutReporter = ({ reporterId: _, ...row }: FakeReport): Report => ({ ...row });

export function createFakeModerationRepo(db: Db, id: (prefix: string) => string): ModerationRepo {
  const postChannel = (postId: string | undefined) => db.posts.find((p) => p.id === postId)?.channelId;
  const targetChannel: Record<ReportTarget, (targetId: string) => string | null | undefined> = {
    post: (targetId) => postChannel(targetId),
    comment: (targetId) => {
      const c = db.comments.find((row) => row.id === targetId);
      return c?.targetType === 'post' ? postChannel(c.targetId) : undefined;
    },
    message: (targetId) => db.messages.find((m) => m.id === targetId)?.channelId,
  };

  return {
    channelModerators: async (channelId) =>
      db.channelModerators.filter((m) => m.channelId === channelId).map((m) => m.profileId),
    async setChannelModerator(channelId, profileId, on) {
      if (!db.channels.some((c) => c.id === channelId)) throw new Error('channel not found');
      db.channelModerators = db.channelModerators.filter((m) => !(m.channelId === channelId && m.profileId === profileId));
      if (on) db.channelModerators.push({ channelId, profileId });
    },

    reports: async (communityId) =>
      db.reports
        .filter((r) => r.communityId === communityId)
        .toSorted((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .map(withoutReporter),
    async report(rid) {
      const row = db.reports.find((r) => r.id === rid);
      return row ? withoutReporter(row) : null;
    },
    async createReport(input) {
      const channel = db.channels.find((c) => c.id === targetChannel[input.targetType](input.targetId));
      if (!channel) throw new ConstraintError(REPORT_TARGET_MISSING);
      if (input.reason !== null && (input.reason.trim().length === 0 || input.reason.length > REPORT_REASON_MAX)) {
        throw new ConstraintError(REPORT_REASON_RANGE);
      }
      const same = (r: FakeReport) =>
        r.reporterId === input.reporterId && r.targetType === input.targetType && r.targetId === input.targetId;
      if (db.reports.some(same)) throw new ConstraintError(ALREADY_REPORTED);
      db.reports.push({
        ...input,
        id: id('report'),
        communityId: channel.communityId,
        channelId: channel.id,
        status: 'open',
        resolvedBy: null,
        resolvedAt: null,
      });
    },
    async resolveReports(ids, resolution) {
      const wanted = new Set(ids);
      for (const r of db.reports) if (wanted.has(r.id) && r.status === 'open') Object.assign(r, resolution);
    },
    reportReporters: async (communityId) =>
      Object.fromEntries(db.reports.filter((r) => r.communityId === communityId).map((r) => [r.id, r.reporterId])),
  };
}
