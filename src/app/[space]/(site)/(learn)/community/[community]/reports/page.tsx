// Reports queue for channel moderators (and staff) beside the channels: only the channels they
// moderate, never who reported unless they are staff.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { reportQueue } from '@/features/community/api/reports';
import { communityShell } from '@/features/community/api/shell';
import { CommunityFrame } from '@/features/community/components/CommunityFrame';
import { ReportQueue } from '@/features/community/components/ReportQueue';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Reports' };

export default async function ReportsRoute({ params }: PageProps<'/[space]/community/[community]/reports'>) {
  const { space, community } = await params;
  const viewer = await currentViewer(space);
  if (!viewer) notFound();
  const repo = getRepo();
  const now = new Date();
  const shell = await communityShell(repo, viewer, community, now);
  const queue = shell && (await reportQueue(repo, viewer, shell.community, now));
  if (!shell || !queue) notFound();
  return (
    <CommunityFrame community={shell.community} channels={shell.channels} activeId="reports" extras={shell.nav}>
      <Stack gap="loose">
        <Heading level={1} variant="title">
          Reports
        </Heading>
        <ReportQueue queue={queue} />
      </Stack>
    </CommunityFrame>
  );
}
