// Studio > Offers > one offer.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BackLink } from '@/components/ui/links';
import { Heading, Stack } from '@/components/ui/mds';
import { studioOffer } from '@/features/checkout/api/offers';
import { OfferEditor } from '@/features/checkout/components/studio/OfferEditor';
import { studioOffersHref } from '@/features/checkout/paths';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Offer' };

export default async function StudioOfferPage({ params }: PageProps<'/[space]/studio/offers/[id]'>) {
  const { space, id } = await params;
  const viewer = await currentViewer(space);
  const detail = viewer ? await studioOffer(getRepo(), viewer, id) : null;
  if (!detail) notFound();
  return (
    <Stack gap="loose">
      <BackLink href={studioOffersHref}>offers</BackLink>
      <Heading level={1} variant="title">
        {detail.offer.title}
      </Heading>
      <OfferEditor detail={detail} />
    </Stack>
  );
}
