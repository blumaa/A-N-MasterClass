// Library section: the products of one kind the viewer holds, as linked cover cards.
import { ProductCard, ProductCardGrid } from '@/components/ProductCard/ProductCard';
import { Heading, Stack } from '@/components/ui/mds';
import type { Product } from '@/lib/data/types';

type Props = {
  heading: string;
  products: Product[];
  href: (slug: string) => string;
  imageSrc: (path: string) => string;
};

export function ProductTiles({ heading, products, href, imageSrc }: Props) {
  if (products.length === 0) return null;
  return (
    <Stack gap="base">
      <Heading level={2} variant="subtitle">
        {heading}
      </Heading>
      <ProductCardGrid label={heading}>
        {products.map((p) => (
          <ProductCard
            key={p.id}
            title={p.title}
            subtitle={p.subtitle}
            coverSrc={p.coverPath ? imageSrc(p.coverPath) : undefined}
            href={href(p.slug)}
            headingLevel={3}
          />
        ))}
      </ProductCardGrid>
    </Stack>
  );
}
