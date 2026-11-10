// Studio > Program curriculum.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { programHref } from '@/features/programs/paths';
import { curriculum } from '@/features/studio/api/curriculum';
import { CurriculumEditor } from '@/features/studio/components/CurriculumEditor';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

type Props = PageProps<'/[space]/studio/programs/[program]'>;

async function load(params: Props['params']) {
  const { space, program } = await params;
  const viewer = await currentViewer(space);
  return viewer ? curriculum(getRepo(), viewer, program) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await load(params);
  return data ? { title: `Edit ${data.program.title}` } : {};
}

export default async function StudioProgramPage({ params }: Props) {
  const data = await load(params);
  if (!data) notFound();
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        {data.program.title}
      </Heading>
      <CurriculumEditor curriculum={data} previewHref={programHref(data.program.slug)} />
    </Stack>
  );
}
