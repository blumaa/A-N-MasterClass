// Small building blocks shared by the section renderers. `ink` = text colour for the band
// the block sits on (plain/soft band, dark band, or text over a photo).
import Image from 'next/image';
import { Heading, Text } from '@/components/ui/mds';
import { ButtonLink } from '@/components/ui/links';
import { splitAccent } from '@/lib/site/sections';
import type { SectionRefs } from '../api/site';
import styles from './Sections.module.css';

export type Ink = 'default' | 'inverse' | 'on-media';
export type Fields = Record<string, string>;

const headingTone = (ink: Ink) => (ink === 'default' ? undefined : ink);
const textTone = (ink: Ink, quiet = false) => (ink === 'default' ? (quiet ? 'secondary' : undefined) : ink);

export function Accented({ text }: { text: string }) {
  return splitAccent(text).map((part, i) => (part.accent ? <em key={i}>{part.text}</em> : part.text));
}

export function Title({ text, level = 2, ink = 'default' }: { text: string | undefined; level?: 1 | 2 | 3; ink?: Ink }) {
  if (!text) return null;
  const variant = level === 1 ? 'display' : level === 2 ? 'title' : 'subtitle';
  return (
    <Heading level={level} variant={variant} tone={headingTone(ink)} className={styles.title}>
      <Accented text={text} />
    </Heading>
  );
}

export function Eyebrow({ text, ink = 'default' }: { text: string | undefined; ink?: Ink }) {
  return text ? (
    <Text variant="eyebrow" tone={ink === 'default' ? 'accent' : ink}>
      {text}
    </Text>
  ) : null;
}

export function Body({ text, ink = 'default', quiet }: { text: string | undefined; ink?: Ink; quiet?: boolean }) {
  return text ? (
    <Text tone={textTone(ink, quiet)} className={styles.text}>
      {text}
    </Text>
  ) : null;
}

/** On a dark band or photo the button is see-through with light ink (MDS onMedia). */
export function Cta({ fields, ink = 'default' }: { fields: Fields; ink?: Ink }) {
  if (!fields.ctaLabel || !fields.ctaHref) return null;
  const light = ink !== 'default';
  return (
    <ButtonLink href={fields.ctaHref} variant={light ? 'secondary' : 'primary'} onMedia={light}>
      {fields.ctaLabel}
    </ButtonLink>
  );
}

type PhotoProps = {
  row: Fields;
  refs: SectionRefs;
  sizes: string;
  className: string;
  name?: string;
  eager?: boolean;
};

/** Stored image path -> optimized image filling its positioned frame; null when the path has no URL. */
export function Photo({ row, refs, sizes, className, name = 'image', eager }: PhotoProps) {
  const src = refs.images[row[name] ?? ''];
  if (!src) return null;
  return (
    <div className={className}>
      <Image
        src={src}
        alt={row[`${name}Alt`] ?? ''}
        fill
        sizes={sizes}
        className={styles.cover}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : undefined}
      />
    </div>
  );
}
