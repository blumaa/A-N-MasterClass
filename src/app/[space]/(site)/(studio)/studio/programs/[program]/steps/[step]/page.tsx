// Studio > Lesson editor.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { stepHref } from '@/features/programs/paths';
import { curriculum, quizEditor } from '@/features/studio/api/curriculum';
import { StepEditor } from '@/features/studio/components/StepEditor';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

type Props = PageProps<'/[space]/studio/programs/[program]/steps/[step]'>;

async function load(params: Props['params']) {
  const { space, program, step } = await params;
  const viewer = await currentViewer(space);
  if (!viewer) return null;
  const repo = getRepo();
  const data = await curriculum(repo, viewer, program);
  const found = data?.modules.flatMap((m) => m.steps).find((s) => s.id === step);
  const quizzes = found ? await quizEditor(repo, viewer, found.parts) : null;
  return data && found && quizzes ? { program: data.program, step: found, quizzes } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  return data ? { title: `Edit ${data.step.title}` } : {};
}

export default async function StudioStepPage({ params }: Props) {
  const data = await load(params);
  if (!data) notFound();
  const { program, step, quizzes } = data;
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        {step.title}
      </Heading>
      <StepEditor
        programId={program.id} programSlug={program.slug} step={step} previewHref={stepHref(program.slug, step.id)}
        quizzes={quizzes}
      />
    </Stack>
  );
}
