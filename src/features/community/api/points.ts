// Leaderboard (Kajabi gamification): weekly, monthly and all-time rankings. Kajabi resets the
// weekly board at 08:00 UTC every Monday and the monthly board at 08:00 UTC on the 1st, so
// periods are calendar-based, not rolling 7/30 days.
import type { Viewer } from '@/lib/auth/viewer';
import type { Repo } from '@/lib/data/repo';
import type { CommunitySettings, Product } from '@/lib/data/types';
import type { CommunityAccess } from './access';
import { spaceNames } from '@/lib/data/names';
import { authorOf, type Author } from './present';

export const LEADERBOARD_PERIODS = ['week', 'month', 'all'] as const;
export type LeaderboardPeriod = (typeof LEADERBOARD_PERIODS)[number];
export const LEADERBOARD_LIMIT = 50;
const RESET_HOUR_UTC = 8;
const DAY_MS = 86_400_000;

export type LeaderboardRow = { rank: number; author: Author; points: number };
export type Leaderboard = {
  period: LeaderboardPeriod;
  rows: LeaderboardRow[];
  mine: { rank: number | null; points: number };
};

/** Start of the current period (last reset at or before now); null = all time. */
export function periodStart(period: LeaderboardPeriod, now: Date): Date | null {
  if (period === 'all') return null;
  if (period === 'month') {
    const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, RESET_HOUR_UTC);
    return new Date(start <= now.getTime() ? start : Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, RESET_HOUR_UTC));
  }
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), RESET_HOUR_UTC);
  const sinceMonday = (now.getUTCDay() + 6) % 7; // Monday = 0
  const monday = today - sinceMonday * DAY_MS;
  return new Date(monday <= now.getTime() ? monday : monday - 7 * DAY_MS);
}

/** Kajabi: leaderboard shown to members, staff only, or off; members also need it in their group. */
export const seesLeaderboard = (settings: CommunitySettings, access: CommunityAccess): boolean => {
  if (!settings.pointsEnabled || settings.leaderboard === 'off' || !access.read) return false;
  return access.staff || (settings.leaderboard === 'members' && access.leaderboard);
};

export async function leaderboard(
  repo: Repo,
  viewer: Viewer,
  community: Product,
  access: CommunityAccess,
  period: LeaderboardPeriod,
  now: Date,
): Promise<Leaderboard | null> {
  if (!seesLeaderboard(await repo.communitySettings(community.id), access)) return null;
  const [totals, names] = await Promise.all([
    repo.pointTotals(community.id, periodStart(period, now)),
    spaceNames(repo, community.spaceId),
  ]);
  // Competition ranking: ties share a rank, the next rank skips (1, 2, 2, 4).
  const ranked = totals.map((t) => ({ ...t, rank: 0 }));
  ranked.forEach((t, i) => {
    t.rank = i > 0 && ranked[i - 1].points === t.points ? ranked[i - 1].rank : i + 1;
  });
  const me = ranked.find((t) => t.profileId === viewer.profile?.id);
  return {
    period,
    rows: ranked.slice(0, LEADERBOARD_LIMIT).map((t) => ({ rank: t.rank, author: authorOf(names, t.profileId), points: t.points })),
    mine: { rank: me?.rank ?? null, points: me?.points ?? 0 },
  };
}
