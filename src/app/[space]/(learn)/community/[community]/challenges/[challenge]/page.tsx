// One challenge: details, the viewer's entry, and (staff) every entry with a CSV export.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { challengePage } from '@/features/community/api/challenges';
import { communityShell } from '@/features/community/api/shell';
import { ChallengeDetail } from '@/features/community/components/Challenges';
import { CommunityFrame } from '@/features/community/components/CommunityFrame';
import { challengeAction } from '@/features/community/eventsActions';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

type Props = PageProps<'/[space]/community/[community]/challenges/[challenge]'>;

async function load(params: Props['params']) {
  const { space, community, challenge } = await params;
  const viewer = await currentViewer(space);
  if (!viewer) return null;
  const repo = getRepo();
  const now = new Date();
  const shell = await communityShell(repo, viewer, community, now);
  const page = shell && (await challengePage(repo, viewer, shell.community, shell.access, challenge, now));
  return shell && page ? { viewer, shell, page } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  return data ? { title: data.page.challenge.title } : {};
}

export default async function ChallengeRoute({ params }: Props) {
  const data = await load(params);
  if (!data) notFound();
  const { viewer, shell, page } = data;
  return (
    <CommunityFrame community={shell.community} channels={shell.channels} activeId="challenges" extras={shell.nav}>
      <ChallengeDetail community={shell.community.slug} page={page} action={challengeAction} signedIn={viewer.profile !== null} />
    </CommunityFrame>
  );
}
