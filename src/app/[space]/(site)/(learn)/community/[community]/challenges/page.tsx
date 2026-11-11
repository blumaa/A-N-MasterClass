// Challenges of a community (Kajabi gamification), while the viewer's access group has them on.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { challengeList } from '@/features/community/api/challenges';
import { communityShell } from '@/features/community/api/shell';
import { ChallengeList } from '@/features/community/components/Challenges';
import { CommunityFrame } from '@/features/community/components/CommunityFrame';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Challenges' };

export default async function ChallengesRoute({ params }: PageProps<'/[space]/community/[community]/challenges'>) {
  const { space, community } = await params;
  const viewer = await currentViewer(space);
  if (!viewer) notFound();
  const repo = getRepo();
  const now = new Date();
  const shell = await communityShell(repo, viewer, community, now);
  const challenges = shell && (await challengeList(repo, viewer, shell.community, shell.access, now));
  if (!shell || !challenges) notFound();
  return (
    <CommunityFrame community={shell.community} channels={shell.channels} activeId="challenges" extras={shell.nav}>
      <Stack gap="loose">
        <Heading level={1} variant="title">
          Challenges
        </Heading>
        <ChallengeList community={shell.community.slug} challenges={challenges} />
      </Stack>
    </CommunityFrame>
  );
}
