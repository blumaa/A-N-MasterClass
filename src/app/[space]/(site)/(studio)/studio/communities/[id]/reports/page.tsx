// Studio > one community > reports queue (staff with community.moderate).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/ui/links';
import { Heading, Stack } from '@/components/ui/mds';
import { studioReportQueue } from '@/features/community/api/reports';
import { ReportQueue } from '@/features/community/components/ReportQueue';
import { studioCommunityHref } from '@/features/community/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Reports' };

export default async function StudioReportsPage({ params }: PageProps<'/[space]/studio/communities/[id]/reports'>) {
  const { space, id } = await params;
  const viewer = await currentViewer(space);
  const queue = viewer && (await studioReportQueue(getRepo(), viewer, id, new Date()));
  if (!queue) notFound();
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Reports
      </Heading>
      <div>
        <ButtonLink href={studioCommunityHref(id)} variant="ghost">
          Back to community settings
        </ButtonLink>
      </div>
      <ReportQueue queue={queue} />
    </Stack>
  );
}
