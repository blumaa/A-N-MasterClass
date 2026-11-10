// Studio > Offers.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { studioOffers } from '@/features/checkout/api/offers';
import { OffersOverview } from '@/features/checkout/components/studio/OffersOverview';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Offers' };

export default async function StudioOffersPage({ params }: PageProps<'/[space]/studio/offers'>) {
  const viewer = await currentViewer((await params).space);
  const offers = viewer ? await studioOffers(getRepo(), viewer) : null;
  if (!viewer || !offers) notFound();
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Offers
      </Heading>
      <OffersOverview offers={offers} locale={viewer.space.locale} />
    </Stack>
  );
}
