// Studio > Branding: space colours + fonts (G15: branding.manage).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack, Text } from '@/components/ui/mds';
import { saveBrandingAction } from '@/features/branding/actions';
import { studioBranding } from '@/features/branding/api/branding';
import { BrandingEditor } from '@/features/branding/components/BrandingEditor';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { DEFAULT_BRAND } from '@/tokens/resolveBrand';

export const metadata: Metadata = { title: 'Branding' };

export default async function StudioBrandingPage({ params }: PageProps<'/[space]/studio/branding'>) {
  const viewer = await currentViewer((await params).space);
  const theme = viewer ? await studioBranding(getRepo(), viewer) : null;
  if (!theme) notFound();
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Branding
      </Heading>
      <Text tone="secondary">Seven colours drive every surface. Combinations that fail contrast cannot be saved.</Text>
      <BrandingEditor
        action={saveBrandingAction}
        colors={theme.colors ?? DEFAULT_BRAND}
        fonts={{ heading: theme.fontHeading, body: theme.fontBody }}
      />
    </Stack>
  );
}
