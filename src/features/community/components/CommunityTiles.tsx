// Library section: the communities the viewer can open.
import { LinkRow } from '@/components/ui/links';
import { Heading, ListGroup, Stack } from '@/components/ui/mds';
import type { Product } from '@/lib/data/types';
import { communityHref } from '../paths';

export function CommunityTiles({ communities }: { communities: Product[] }) {
  if (communities.length === 0) return null;
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Communities
      </Heading>
      <ListGroup>
        {communities.map((c) => (
          <LinkRow key={c.id} href={communityHref(c.slug)} title={c.title} description={c.subtitle ?? undefined} />
        ))}
      </ListGroup>
    </Stack>
  );
}
