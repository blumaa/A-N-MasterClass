// Member directory of a community; staff carry a badge. With `dm`, people the viewer may
// message get a Message button (targets come from the API, never decided here).
import { ActionForm, type FormAction } from '@/components/ActionForm/ActionForm';
import { Badge, EmptyState, ListGroup, ListItem } from '@/components/ui/mds';
import type { DirectoryEntry } from '../api/feed';

type Dm = { communityId: string; targets: readonly string[]; action: FormAction };

export function MemberList({ members, dm }: { members: DirectoryEntry[]; dm?: Dm }) {
  if (members.length === 0) return <EmptyState title="No members yet" />;
  const targets = new Set(dm?.targets);
  return (
    <ListGroup aria-label="Members">
      {members.map((m) => (
        <ListItem
          key={m.id}
          title={m.name}
          trailing={m.staff ? <Badge tone="accent">Staff</Badge> : undefined}
          actions={
            dm && targets.has(m.id) ? (
              <ActionForm
                action={dm.action}
                inline
                variant="secondary"
                submit="Message"
                fields={{ op: 'startDm', communityId: dm.communityId, recipientId: m.id }}
              />
            ) : undefined
          }
        />
      ))}
    </ListGroup>
  );
}
