// Studio > Communities: list + create (a new community starts as a draft with a General channel).
import { LinkRow } from '@/components/ui/links';
import { Badge, EmptyState, Field, Input, ListGroup, Stack } from '@/components/ui/mds';
import type { Product } from '@/lib/data/types';
import { communityHref, studioCommunityHref } from '../paths';
import { CommunityForm } from './CommunityForm';

const status = (c: Product) =>
  c.status === 'published' ? <Badge tone="success">Published</Badge> : <Badge tone="warning">Draft</Badge>;

export function CommunityList({ communities }: { communities: Product[] }) {
  return (
    <Stack gap="loose">
      {communities.length === 0 ? (
        <EmptyState title="No communities yet" />
      ) : (
        <ListGroup>
          {communities.map((c) => (
            <LinkRow
              key={c.id}
              href={studioCommunityHref(c.id)}
              title={c.title}
              description={communityHref(c.slug)}
              trailing={status(c)}
            />
          ))}
        </ListGroup>
      )}
      <CommunityForm inline fields={{ op: 'createCommunity' }} submit="Add community">
        <Field label="New community title">
          <Input name="title" required />
        </Field>
      </CommunityForm>
    </Stack>
  );
}
