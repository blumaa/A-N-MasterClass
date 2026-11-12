// Thank-you page after checkout. Reads only ?status (no order lookup), so the URL leaks nothing.
// A paid order may show the offer's upsell (G23).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack, Text } from '@/components/ui/mds';
import { ButtonLink } from '@/components/ui/links';
import { upsellFor } from '@/features/checkout/api/upsell';
import { UpsellCard } from '@/features/checkout/components/UpsellCard';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { libraryHref, setPasswordHref } from '@/lib/routes';

export const metadata: Metadata = { title: 'Thank you', robots: { index: false } };

export default async function ThanksPage({ params, searchParams }: PageProps<'/[space]/checkout/[offer]/thanks'>) {
  const [{ space, offer }, query] = await Promise.all([params, searchParams]);
  const viewer = await currentViewer(space);
  if (!viewer) notFound();
  const pending = query.status === 'pending';
  const upsell = pending ? null : await upsellFor(getRepo(), viewer.space.id, offer, viewer.profile?.id ?? null, new Date());
  return (
    <Stack gap="base">
      <Heading level={1} variant="title">
        {pending ? 'Payment received, waiting for PayPal' : 'Thank you!'}
      </Heading>
      <Text>
        {pending
          ? 'PayPal is still confirming your payment. Your access starts as soon as it does; we email you then.'
          : 'Your access is ready. We also email you a receipt with a link to your account.'}
      </Text>
      {query.status === 'welcome' && viewer.profile ? (
        <>
          <Text tone="secondary">Set a password now so you can sign in again later.</Text>
          <ButtonLink href={setPasswordHref}>Set your password</ButtonLink>
        </>
      ) : !pending && viewer.profile && !upsell ? (
        <ButtonLink href={libraryHref}>Go to your library</ButtonLink>
      ) : null}
      {upsell ? <UpsellCard upsell={upsell} locale={viewer.space.locale} declineHref={libraryHref} /> : null}
    </Stack>
  );
}
