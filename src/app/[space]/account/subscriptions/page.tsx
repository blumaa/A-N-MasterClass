// Member's own subscriptions and payment plans, with self-cancel (G5).
import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { Heading, Stack } from '@/components/ui/mds';
import { cancelSubscriptionAction } from '@/features/checkout/actions';
import { memberSubscriptions } from '@/features/checkout/api/memberSubscriptions';
import { MemberSubscriptions } from '@/features/checkout/components/MemberSubscriptions';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { signInHref } from '@/lib/routes';

export const metadata: Metadata = { title: 'Subscriptions', robots: { index: false } };

export default async function SubscriptionsPage({ params }: PageProps<'/[space]/account/subscriptions'>) {
  const viewer = await currentViewer((await params).space);
  if (!viewer) notFound();
  if (!viewer.profile) redirect(signInHref);
  const rows = await memberSubscriptions(getRepo(), viewer.space.id, viewer.profile.id);
  return (
    <Stack gap="loose">
      <Heading level={1} variant="title">
        Subscriptions
      </Heading>
      <MemberSubscriptions rows={rows} locale={viewer.space.locale} cancelAction={cancelSubscriptionAction} />
    </Stack>
  );
}
