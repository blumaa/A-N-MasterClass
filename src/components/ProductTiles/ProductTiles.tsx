// Library section: the products of one kind the viewer holds, each linking to its page.
import { LinkRow } from '@/components/ui/links';
import { Heading, ListGroup, Stack } from '@/components/ui/mds';
import type { Product } from '@/lib/data/types';

type Props = { heading: string; products: Product[]; href: (slug: string) => string };

export function ProductTiles({ heading, products, href }: Props) {
  if (products.length === 0) return null;
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        {heading}
      </Heading>
      <ListGroup aria-label={heading}>
        {products.map((p) => (
          <LinkRow key={p.id} href={href(p.slug)} title={p.title} description={p.subtitle ?? undefined} />
        ))}
      </ListGroup>
    </Stack>
  );
}
