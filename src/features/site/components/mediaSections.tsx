// Photo-led sections: hero, image and text, about me, cards, highlights.
import NextLink from 'next/link';
import { Text } from '@/components/ui/mds';
import type { SectionRefs } from '../api/site';
import { Body, Cta, Eyebrow, Photo, Title, type Fields, type Ink } from './sectionParts';
import styles from './Sections.module.css';

type Props = { fields: Fields; refs: SectionRefs; ink: Ink };
type HeroProps = Props & { level: 1 | 2; layout: string; eager: boolean };

export function Hero({ fields, refs, ink, level, layout, eager }: HeroProps) {
  const text = (
    <div className={styles.heroText}>
      <Eyebrow text={fields.eyebrow} ink={ink} />
      <Title text={fields.heading} level={level} ink={ink} />
      <Body text={fields.subheading} ink={ink} quiet />
      <Cta fields={fields} ink={ink} />
    </div>
  );
  const photoClass = layout === 'split' ? styles.heroPhoto : styles.backdrop;
  return (
    <>
      <Photo row={fields} refs={refs} sizes={layout === 'split' ? '(min-width: 48rem) 50vw, 100vw' : '100vw'} className={photoClass} eager={eager} />
      {text}
    </>
  );
}

export function ImageText({ fields, refs, ink }: Props) {
  return (
    <div className={styles.split}>
      <Photo row={fields} refs={refs} sizes="(min-width: 48rem) 50vw, 100vw" className={styles.panel} />
      <div className={styles.copy}>
        <Eyebrow text={fields.eyebrow} ink={ink} />
        <Title text={fields.heading} ink={ink} />
        <Body text={fields.body} ink={ink} />
        <Cta fields={fields} ink={ink} />
      </div>
    </div>
  );
}

export function Bio({ fields, refs, ink }: Props) {
  return (
    <div className={styles.split}>
      <Photo row={fields} refs={refs} sizes="(min-width: 48rem) 40vw, 100vw" className={styles.portrait} />
      <div className={styles.copy}>
        <Eyebrow text={fields.eyebrow} ink={ink} />
        <Title text={fields.heading} ink={ink} />
        <Body text={fields.body} ink={ink} />
        {fields.signature ? (
          <Text tone={ink === 'default' ? 'accent' : ink} className={styles.signature}>
            {fields.signature}
          </Text>
        ) : null}
      </div>
    </div>
  );
}

export function Cards({ fields, items, refs, ink }: Props & { items: Fields[] }) {
  return (
    <>
      <Title text={fields.heading} ink={ink} />
      <ul className={styles.cards}>
        {items.map((item, i) => {
          const card = (
            <>
              <Photo row={item} refs={refs} sizes="(min-width: 48rem) 33vw, 100vw" className={styles.cardPhoto} />
              <div className={styles.cardText}>
                <Title text={item.title} level={3} />
                <Body text={item.body} quiet />
              </div>
            </>
          );
          return (
            <li key={i} className={styles.card}>
              {item.href ? (
                <NextLink href={item.href} className={styles.cardLink}>
                  {card}
                </NextLink>
              ) : (
                card
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function Highlights({ fields, items, ink }: Props & { items: Fields[] }) {
  return (
    <>
      <Title text={fields.heading} ink={ink} />
      <ul className={styles.chips}>
        {items.map((item, i) => (
          <li key={i} className={styles.chip}>
            {item.text}
          </li>
        ))}
      </ul>
    </>
  );
}
