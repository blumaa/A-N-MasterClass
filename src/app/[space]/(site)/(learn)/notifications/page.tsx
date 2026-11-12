// The viewer's notifications, newest first, with mark-all-read and push settings.
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/ActionForm/ActionForm';
import { Heading, Inline, Stack } from '@/components/ui/mds';
import { markAllReadAction, savePushTypesAction } from '@/features/community/actions';
import { notificationFeed } from '@/features/community/api/notifications';
import { pushTypeSettings } from '@/features/community/api/pushSettings';
import { NotificationList } from '@/features/community/components/NotificationList';
import { PushTypeSettings } from '@/features/community/components/PushTypeSettings';
import { currentViewer } from '@/lib/auth/currentViewer';
import { getRepo } from '@/lib/data/getRepo';
import { pushPublicKey } from '@/lib/push/getPushSender';
import { notificationHref } from './notificationHref';
import { PushSwitch } from './PushSwitch';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage({ params }: PageProps<'/[space]/notifications'>) {
  const viewer = await currentViewer((await params).space);
  if (!viewer?.profile) notFound();
  // No VAPID keys: push is off for the platform, so no switches.
  const pushKey = pushPublicKey();
  const repo = getRepo();
  const [items, pushTypes] = await Promise.all([notificationFeed(repo, viewer), pushKey ? pushTypeSettings(repo, viewer) : []]);
  const linked = items.map((n) => ({ ...n, href: notificationHref(n.link) }));
  return (
    <Stack gap="loose">
      <Inline gap="base" justify="between">
        <Heading level={1} variant="title">
          Notifications
        </Heading>
        {items.some((n) => n.unread) ? <ActionForm action={markAllReadAction} fields={{}} submit="Mark all read" inline /> : null}
      </Inline>
      {pushKey ? <PushSwitch publicKey={pushKey} profileId={viewer.profile.id} /> : null}
      {pushKey ? <PushTypeSettings settings={pushTypes} action={savePushTypesAction} /> : null}
      <NotificationList items={linked} />
    </Stack>
  );
}
