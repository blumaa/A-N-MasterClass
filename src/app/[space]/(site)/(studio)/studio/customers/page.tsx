// Studio > Customers: orders + contacts.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { studioCustomers } from '@/features/checkout/api/customers';
import { CustomersTables } from '@/features/checkout/components/studio/CustomersTables';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';

export const metadata: Metadata = { title: 'Customers' };

export default async function StudioCustomersPage({ params }: PageProps<'/[space]/studio/customers'>) {
  const viewer = await currentViewer((await params).space);
  const view = viewer ? await studioCustomers(getRepo(), viewer) : null;
  if (!viewer || !view) notFound();
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Customers
      </Heading>
      <CustomersTables view={view} locale={viewer.space.locale} />
    </Stack>
  );
}
