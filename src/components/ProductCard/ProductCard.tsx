// Product card for library grids: cover (or a lettered placeholder in the brand accent),
// title, subtitle and optional extra content. With href the title link stretches over the card.
import Image from 'next/image';
import NextLink from 'next/link';
import type { ReactNode } from 'react';
import { Heading, Text } from '@/components/ui/mds';
import styles from './ProductCard.module.css';

type Props = {
  title: string;
  subtitle?: string | null;
  coverSrc?: string;
  href?: string;
  headingLevel: 2 | 3;
  children?: ReactNode;
};

export function ProductCard({ title, subtitle, coverSrc, href, headingLevel, children }: Props) {
  return (
    <li className={styles.card} data-linked={href ? '' : undefined}>
      <div className={styles.cover}>
        {coverSrc ? (
          <Image src={coverSrc} alt="" fill sizes="(min-width: 48rem) 33vw, 100vw" className={styles.image} />
        ) : (
          <span aria-hidden="true" className={styles.letter}>
            {title.trim().charAt(0).toUpperCase()}
          </span>
        )}
      </div>
      <div className={styles.body}>
        <Heading level={headingLevel} variant="subtitle">
          {href ? (
            <NextLink href={href} className={styles.link}>
              {title}
            </NextLink>
          ) : (
            title
          )}
        </Heading>
        {subtitle ? <Text tone="muted">{subtitle}</Text> : null}
        {children}
      </div>
    </li>
  );
}

export function ProductCardGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul aria-label={label} className={styles.grid}>
      {children}
    </ul>
  );
}
