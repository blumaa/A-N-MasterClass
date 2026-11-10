// Thank-you page after checkout. Reads only ?status (no order lookup), so the URL leaks nothing.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack, Text } from '@/components/ui/mds';
import { ButtonLink } from '@/components/ui/links';
import { currentViewer } from '@/lib/auth/currentViewer';

export const metadata: Metadata = { title: 'Thank you', robots: { index: false } };

export default async function ThanksPage({ params, searchParams }: PageProps<'/[space]/checkout/[offer]/thanks'>) {
  const [{ space }, query] = await Promise.all([params, searchParams]);
  const viewer = await currentViewer(space);
  if (!viewer) notFound();
  const pending = query.status === 'pending';
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
      {!pending && viewer.profile ? <ButtonLink href="/library">Go to your library</ButtonLink> : null}
    </Stack>
  );
}
