// Studio > Lesson editor.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { stepHref } from '@/features/programs/paths';
import { curriculum } from '@/features/studio/api/curriculum';
import { StepEditor } from '@/features/studio/components/StepEditor';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

type Props = PageProps<'/[space]/studio/programs/[program]/steps/[step]'>;

async function load(params: Props['params']) {
  const { space, program, step } = await params;
  const viewer = await currentViewer(space);
  const data = viewer ? await curriculum(getRepo(), viewer, program) : null;
  const found = data?.modules.flatMap((m) => m.steps).find((s) => s.id === step);
  return data && found ? { program: data.program, step: found } : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  return data ? { title: `Edit ${data.step.title}` } : {};
}

export default async function StudioStepPage({ params }: Props) {
  const data = await load(params);
  if (!data) notFound();
  const { program, step } = data;
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        {step.title}
      </Heading>
      <StepEditor programSlug={program.slug} step={step} previewHref={stepHref(program.slug, step.id)} />
    </Stack>
  );
}
