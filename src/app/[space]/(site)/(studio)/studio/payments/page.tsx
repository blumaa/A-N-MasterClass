// Studio > Payments (G28): owner only.
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { studioPayments } from '@/features/checkout/api/payments';
import { PaymentsSettings } from '@/features/checkout/components/studio/PaymentsSettings';
import { paypalWebhookPath } from '@/features/checkout/paths';
import { paymentsEnv } from '@/config/payments';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { headersOrigin } from '@/lib/tenancy/origin';

export const metadata: Metadata = { title: 'Payments' };

export default async function StudioPaymentsPage({ params }: PageProps<'/[space]/studio/payments'>) {
  const viewer = await currentViewer((await params).space);
  const view = viewer ? await studioPayments(getRepo(), viewer) : null;
  if (!viewer || !view) notFound();
  const h = await headers();
  const webhookUrl = headersOrigin(h) + paypalWebhookPath(viewer.space.slug);
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Payments
      </Heading>
      <PaymentsSettings view={view} activeEnv={paymentsEnv()} webhookUrl={webhookUrl} />
    </Stack>
  );
}
