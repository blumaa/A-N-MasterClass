// Member directory of a community; staff carry a badge.
import { Badge, EmptyState, ListGroup, ListItem } from '@/components/ui/mds';
import type { DirectoryEntry } from '../api/feed';

export function MemberList({ members }: { members: DirectoryEntry[] }) {
  if (members.length === 0) return <EmptyState title="No members yet" />;
  return (
    <ListGroup>
      {members.map((m) => (
        <ListItem key={m.id} title={m.name} trailing={m.staff ? <Badge tone="accent">Staff</Badge> : undefined} />
      ))}
    </ListGroup>
  );
}
