// The viewer's notifications. Hrefs come from the app (links cross features: posts + lessons).
import { EmptyState, ListGroup, ListItem } from '@/components/ui/mds';
import { LinkRow } from '@/components/ui/links';
import { formatDate } from '@/lib/format/date';
import type { NotificationItem } from '../api/notifications';

export type LinkedNotification = NotificationItem & { href: string | null };

export function NotificationList({ items }: { items: readonly LinkedNotification[] }) {
  if (items.length === 0) return <EmptyState title="Nothing new" description="Replies, mentions and reactions show up here." />;
  return (
    <ListGroup>
      {items.map((n) => {
        const title = n.unread ? <strong>{n.text}</strong> : n.text;
        const description = formatDate(n.createdAt);
        return n.href ? (
          <LinkRow key={n.id} href={n.href} title={title} description={description} />
        ) : (
          <ListItem key={n.id} title={title} description={description} />
        );
      })}
    </ListGroup>
  );
}
