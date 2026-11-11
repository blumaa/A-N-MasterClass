// Program overview: progress, outline, Continue.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ButtonLink } from '@/components/ui/links';
import { EmptyState, Heading, Stack, Text } from '@/components/ui/mds';
import { programOutline } from '@/features/programs/api/outline';
import { ProgramOutline } from '@/features/programs/components/ProgramOutline';
import { stepHref } from '@/features/programs/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

type Props = PageProps<'/[space]/programs/[program]'>;

async function load(params: Props['params']) {
  const { space, program } = await params;
  const viewer = await currentViewer(space);
  if (!viewer) return null;
  const now = new Date();
  const outline = await programOutline(getRepo(), viewer, program, now);
  return outline ? { outline, now } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  return data ? { title: data.outline.program.title } : {};
}

export default async function ProgramPage({ params }: Props) {
  const data = await load(params);
  if (!data) notFound();
  const { outline, now } = data;
  const { program, hasAccess, continueStepId, completed } = outline;
  return (
    <Stack gap="loose">
      <Stack gap="tight">
        <Heading level={1} variant="title">
          {program.title}
        </Heading>
        {program.subtitle ? <Text tone="secondary">{program.subtitle}</Text> : null}
      </Stack>
      {hasAccess && continueStepId ? (
        <div>
          <ButtonLink href={stepHref(program.slug, continueStepId)}>{completed > 0 ? 'Continue' : 'Start'}</ButtonLink>
        </div>
      ) : null}
      {hasAccess ? null : (
        <EmptyState title="Not enrolled" description="Buying will arrive with checkout. Ask the instructor for access meanwhile." />
      )}
      <ProgramOutline outline={outline} now={now} />
    </Stack>
  );
}
