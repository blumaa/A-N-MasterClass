// The viewer's notifications, newest first, with mark-all-read.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm/ActionForm';
import { Heading, Inline, Stack } from '@/components/ui/mds';
import { markAllReadAction } from '@/features/community/actions';
import { notificationFeed } from '@/features/community/api/notifications';
import { NotificationList } from '@/features/community/components/NotificationList';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { pushPublicKey } from '@/lib/push/getPushSender';
import { notificationHref } from './notificationHref';
import { PushSwitch } from './PushSwitch';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage({ params }: PageProps<'/[space]/notifications'>) {
  const viewer = await currentViewer((await params).space);
  if (!viewer?.profile) notFound();
  const items = await notificationFeed(getRepo(), viewer);
  const linked = items.map((n) => ({ ...n, href: notificationHref(n.link) }));
  // No VAPID keys: push is off for the platform, so no switch.
  const pushKey = pushPublicKey();
  return (
    <Stack gap="loose">
      <Inline gap="base" justify="between">
        <Heading level={1} variant="title">
          Notifications
        </Heading>
        {items.some((n) => n.unread) ? <ActionForm action={markAllReadAction} fields={{}} submit="Mark all read" inline /> : null}
      </Inline>
      {pushKey ? <PushSwitch publicKey={pushKey} profileId={viewer.profile.id} /> : null}
      <NotificationList items={linked} />
    </Stack>
  );
}
