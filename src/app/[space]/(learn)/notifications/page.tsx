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
import { notificationHref } from './notificationHref';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage({ params }: PageProps<'/[space]/notifications'>) {
  const viewer = await currentViewer((await params).space);
  if (!viewer?.profile) notFound();
  const items = await notificationFeed(getRepo(), viewer);
  const linked = items.map((n) => ({ ...n, href: notificationHref(n.link) }));
  return (
    <Stack gap="loose">
      <Inline gap="base" justify="between">
        <Heading level={1} variant="title">
          Notifications
        </Heading>
        {items.some((n) => n.unread) ? <ActionForm action={markAllReadAction} fields={{}} submit="Mark all read" inline /> : null}
      </Inline>
      <NotificationList items={linked} />
    </Stack>
  );
}
