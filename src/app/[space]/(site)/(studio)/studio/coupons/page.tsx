// Studio > Coupons (G23).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { studioCoupons } from '@/features/checkout/api/coupons';
import { CouponsOverview } from '@/features/checkout/components/studio/CouponsOverview';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Coupons' };

export default async function StudioCouponsPage({ params }: PageProps<'/[space]/studio/coupons'>) {
  const viewer = await currentViewer((await params).space);
  const coupons = viewer ? await studioCoupons(getRepo(), viewer) : null;
  if (!viewer || !coupons) notFound();
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Coupons
      </Heading>
      <CouponsOverview coupons={coupons} locale={viewer.space.locale} now={new Date()} />
    </Stack>
  );
}
