// Studio > one community > review feed (staff with community.moderate). Same tabs as the
// member-side page (?tab=, log filters ?action=&from=&to=).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { communityAction } from '@/app/[space]/communityActions';
import { BackLink } from '@/components/ui/links';
import { Heading, Stack } from '@/components/ui/mds';
import { logFilterOf, reviewTabOf, studioReview } from '@/features/community/api/review';
import { ReviewFeed } from '@/features/community/components/ReviewFeed';
import { studioCommunityHref, studioReportsHref } from '@/features/community/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Review feed' };

export default async function StudioReportsPage({ params, searchParams }: PageProps<'/[space]/studio/communities/[id]/reports'>) {
  const [{ space, id }, query] = await Promise.all([params, searchParams]);
  const viewer = await currentViewer(space);
  const feed = viewer && (await studioReview(getRepo(), viewer, id, reviewTabOf(query.tab), logFilterOf(query), new Date()));
  if (!feed) notFound();
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Review feed
      </Heading>
      <div>
        <BackLink href={studioCommunityHref(id)}>community settings</BackLink>
      </div>
      <ReviewFeed review={feed} page={studioReportsHref(id)} action={communityAction} />
    </Stack>
  );
}
