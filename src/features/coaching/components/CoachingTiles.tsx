// Library section: the coaching products the viewer holds.
import { LinkRow } from '@/components/ui/links';
import { Heading, ListGroup, Stack } from '@/components/ui/mds';
import type { Product } from '@/lib/data/types';
import { coachingHref } from '../paths';

export function CoachingTiles({ coaching }: { coaching: Product[] }) {
  if (coaching.length === 0) return null;
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        Coaching
      </Heading>
      <ListGroup>
        {coaching.map((c) => (
          <LinkRow key={c.id} href={coachingHref(c.slug)} title={c.title} description={c.subtitle ?? undefined} />
        ))}
      </ListGroup>
    </Stack>
  );
}
