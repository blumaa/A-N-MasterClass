// Review feed for channel moderators (and staff) beside the channels: reports, pending, rejected,
// hidden and locked posts, and the moderation log (?tab=, log filters ?action=&from=&to=).
// Only the channels they moderate; never who reported unless they are staff.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { communityAction } from '@/app/[space]/communityActions';
import { reportAction } from '@/app/[space]/reportActions';
import { Heading, Stack } from '@/components/ui/mds';
import { logFilterOf, review, reviewTabOf } from '@/features/community/api/review';
import { communityShell } from '@/features/community/api/shell';
import { CommunityFrame } from '@/features/community/components/CommunityFrame';
import { ReviewFeed } from '@/features/community/components/ReviewFeed';
import { reportsHref } from '@/features/community/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Review feed' };

export default async function ReportsRoute({ params, searchParams }: PageProps<'/[space]/community/[community]/reports'>) {
  const [{ space, community }, query] = await Promise.all([params, searchParams]);
  const viewer = await currentViewer(space);
  if (!viewer) notFound();
  const repo = getRepo();
  const now = new Date();
  const shell = await communityShell(repo, viewer, community, now);
  const feed = shell && (await review(repo, viewer, shell.community, reviewTabOf(query.tab), logFilterOf(query), now));
  if (!shell || !feed) notFound();
  return (
    <CommunityFrame community={shell.community} channels={shell.channels} activeId="reports" extras={shell.nav}>
      <Stack gap="loose">
        <Heading level={1} variant="title">
          Review feed
        </Heading>
        <ReviewFeed review={feed} page={reportsHref(shell.community.slug)} action={communityAction} report={reportAction} />
      </Stack>
    </CommunityFrame>
  );
}
