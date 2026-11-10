// The viewer's DM threads in one community, newest first, unread marked.
import { Badge, EmptyState, ListGroup } from '@/components/ui/mds';
import { LinkRow } from '@/components/ui/links';
import type { InboxItem } from '../api/dms';
import { dmHref } from '../paths';

const lastLine = (last: InboxItem['last']): string | undefined => (last ? (last.mine ? `You: ${last.body}` : last.body) : undefined);

export function DmInbox({ community, items }: { community: string; items: readonly InboxItem[] }) {
  if (items.length === 0) {
    return <EmptyState title="No conversations yet" description="Start one from the Members page." />;
  }
  return (
    <ListGroup aria-label="Conversations">
      {items.map((t) => (
        <LinkRow
          key={t.id}
          href={dmHref(community, t.id)}
          title={t.unread ? <strong>{t.other.name}</strong> : t.other.name}
          description={lastLine(t.last)}
          trailing={t.unread ? <Badge tone="accent">New</Badge> : undefined}
        />
      ))}
    </ListGroup>
  );
}
