// Supabase Repo: channel moderators and reports.
// Semantics mirror src/lib/data/fake/fakeModerationRepo.ts; rules live in *_moderation.sql.
import type { Repo } from '@/lib/data/repo';
import type { Report, ReportStatus, ReportTarget } from '@/lib/data/types';
import { check, toDate, toDateOrNull, unwrap, unwrapMaybe, type RepoCtx, type Tables } from './context';

export type ModerationRepo = Pick<
  Repo,
  | 'channelModerators'
  | 'setChannelModerator'
  | 'reports'
  | 'report'
  | 'createReport'
  | 'resolveReports'
  | 'reportReporters'
>;

// reporter_id is left out: members have no select grant on it (report_reporters gives it to staff).
const REPORT_COLUMNS = 'id, community_id, channel_id, target_type, target_id, reason, status, created_at, resolved_by, resolved_at';
type ReportRow = Omit<Tables['reports']['Row'], 'reporter_id'>;
// channel_id and community_id are set by the reports_target trigger (no insert grant on them).
type ReportInsert = Omit<Tables['reports']['Insert'], 'channel_id' | 'community_id'>;

const toReport = (r: ReportRow): Report => ({
  id: r.id,
  communityId: r.community_id,
  channelId: r.channel_id,
  targetType: r.target_type as ReportTarget,
  targetId: r.target_id,
  reason: r.reason,
  status: r.status as ReportStatus,
  createdAt: toDate(r.created_at),
  resolvedBy: r.resolved_by,
  resolvedAt: toDateOrNull(r.resolved_at),
});

// No admin(): every method runs as the caller; RLS decides.
export function createModerationRepo({ db }: RepoCtx): ModerationRepo {
  return {
    async channelModerators(channelId) {
      return unwrap(await (await db()).from('channel_moderators').select('profile_id').eq('channel_id', channelId)).map(
        (r) => r.profile_id,
      );
    },
    async setChannelModerator(channelId, profileId, on) {
      const table = (await db()).from('channel_moderators');
      if (on) {
        check(
          await table.upsert(
            { channel_id: channelId, profile_id: profileId },
            { onConflict: 'channel_id,profile_id', ignoreDuplicates: true },
          ),
        );
        return;
      }
      check(await table.delete().eq('channel_id', channelId).eq('profile_id', profileId));
    },

    async reports(communityId) {
      const rows = unwrap(
        await (await db())
          .from('reports')
          .select(REPORT_COLUMNS)
          .eq('community_id', communityId)
          .order('created_at', { ascending: false })
          .order('id'),
      );
      return rows.map(toReport);
    },
    async report(id) {
      const row = unwrapMaybe(await (await db()).from('reports').select(REPORT_COLUMNS).eq('id', id).maybeSingle());
      return row && toReport(row);
    },
    // No returning: members cannot select reports.
    async createReport(input) {
      const row: ReportInsert = {
        target_type: input.targetType,
        target_id: input.targetId,
        reporter_id: input.reporterId,
        reason: input.reason,
        created_at: input.createdAt.toISOString(),
      };
      check(await (await db()).from('reports').insert(row as Tables['reports']['Insert']));
    },
    async resolveReports(ids, { status, resolvedBy, resolvedAt }) {
      if (ids.length === 0) return;
      check(
        await (await db())
          .from('reports')
          .update({ status, resolved_by: resolvedBy, resolved_at: resolvedAt.toISOString() })
          .in('id', [...ids])
          .eq('status', 'open'),
      );
    },
    async reportReporters(communityId) {
      const rows = unwrap(await (await db()).rpc('report_reporters', { target_community: communityId }));
      return Object.fromEntries(rows.map((r) => [r.report_id, r.reporter_id]));
    },
  };
}
