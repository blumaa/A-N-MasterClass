// Leaderboard (Kajabi gamification): week / month / all-time tabs as links, top rows, and the
// viewer's own rank under the board.
import { ButtonLink } from '@/components/ui/links';
import { Badge, EmptyState, Inline, ListGroup, ListItem, Stack, Text } from '@/components/ui/mds';
import { LEADERBOARD_PERIODS, type Leaderboard, type LeaderboardPeriod } from '../api/points';
import { leaderboardHref } from '../paths';

const PERIOD_LABELS: Record<LeaderboardPeriod, string> = { week: 'This week', month: 'This month', all: 'All time' };
const pointsLabel = (n: number): string => (n === 1 ? '1 point' : `${n} points`);

export function LeaderboardTable({ community, board }: { community: string; board: Leaderboard }) {
  return (
    <Stack gap="base">
      <Inline gap="tight" aria-label="Period">
        {LEADERBOARD_PERIODS.map((p) => (
          <ButtonLink key={p} href={leaderboardHref(community, p)} variant={p === board.period ? 'primary' : 'ghost'}>
            {PERIOD_LABELS[p]}
          </ButtonLink>
        ))}
      </Inline>
      {board.rows.length === 0 ? (
        <EmptyState title="No points yet" />
      ) : (
        <ListGroup aria-label={`Leaderboard, ${PERIOD_LABELS[board.period].toLowerCase()}`}>
          {board.rows.map((r) => (
            <ListItem key={r.author.id} leading={<Badge tone={r.rank <= 3 ? 'highlight' : 'neutral'}>{r.rank}</Badge>} title={r.author.name} trailing={<Text variant="meta">{pointsLabel(r.points)}</Text>} />
          ))}
        </ListGroup>
      )}
      <Text tone="muted">
        {board.mine.rank ? `You are #${board.mine.rank} with ${pointsLabel(board.mine.points)}.` : 'You have no points in this period yet.'}
      </Text>
    </Stack>
  );
}
