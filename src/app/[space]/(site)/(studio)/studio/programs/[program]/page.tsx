// Studio > Program curriculum.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack, Text } from '@/components/ui/mds';
import { saveProgramThemeAction } from '@/features/branding/actions';
import { spaceTheme } from '@/features/branding/api/branding';
import { BrandingEditor } from '@/features/branding/components/BrandingEditor';
import { programHref } from '@/features/programs/paths';
import { curriculum } from '@/features/studio/api/curriculum';
import { CurriculumEditor } from '@/features/studio/components/CurriculumEditor';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { siteImageSrc } from '@/lib/storage/siteImageSrc';
import { DEFAULT_BRAND } from '@/tokens/resolveBrand';

type Props = PageProps<'/[space]/studio/programs/[program]'>;

async function load(params: Props['params']) {
  const { space, program } = await params;
  const viewer = await currentViewer(space);
  if (!viewer) return null;
  const [data, theme] = await Promise.all([curriculum(getRepo(), viewer, program), spaceTheme(getRepo(), viewer.space.id)]);
  return data && { ...data, spaceColors: theme.colors ?? DEFAULT_BRAND };
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
      <CurriculumEditor curriculum={data} previewHref={programHref(data.program.slug)} imageSrc={siteImageSrc} />
      <Stack gap="base">
        <Heading level={2} variant="subtitle">
          Program colours
        </Heading>
        <Text tone="secondary">Override the space colours on this program&apos;s pages only.</Text>
        <BrandingEditor
          action={saveProgramThemeAction}
          colors={data.program.themeOverride ?? data.spaceColors}
          productId={data.program.id}
        />
      </Stack>
    </Stack>
  );
}
