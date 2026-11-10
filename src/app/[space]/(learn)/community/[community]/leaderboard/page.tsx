// Leaderboard of a community: ?period=week|month (default all time).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { LEADERBOARD_PERIODS, leaderboard, type LeaderboardPeriod } from '@/features/community/api/points';
import { communityShell } from '@/features/community/api/shell';
import { CommunityFrame } from '@/features/community/components/CommunityFrame';
import { LeaderboardTable } from '@/features/community/components/Leaderboard';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Leaderboard' };

const periodOf = (raw: string | string[] | undefined): LeaderboardPeriod =>
  LEADERBOARD_PERIODS.find((p) => p === raw) ?? 'all';

export default async function LeaderboardRoute({ params, searchParams }: PageProps<'/[space]/community/[community]/leaderboard'>) {
  const [{ space, community }, query] = await Promise.all([params, searchParams]);
  const viewer = await currentViewer(space);
  if (!viewer) notFound();
  const repo = getRepo();
  const now = new Date();
  const shell = await communityShell(repo, viewer, community, now);
  const board = shell && (await leaderboard(repo, viewer, shell.community, shell.access, periodOf(query.period), now));
  if (!shell || !board) notFound();
  return (
    <CommunityFrame community={shell.community} channels={shell.channels} activeId="leaderboard" extras={shell.nav}>
      <Stack gap="loose">
        <Heading level={1} variant="title">
          Leaderboard
        </Heading>
        <LeaderboardTable community={shell.community.slug} board={board} />
      </Stack>
    </CommunityFrame>
  );
}
