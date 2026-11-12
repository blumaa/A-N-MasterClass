// Server renderers for published page sections (G11). One renderer per SECTION_KINDS entry;
// fields were validated on save (lib/site/sections), so links here are already safe.
// Each section is a full-width band (tone) with a centred inner column.
import type { ReactNode } from 'react';
import { Container, Text } from '@/components/ui/mds';
import { ButtonLink } from '@/components/ui/links';
import { VimeoEmbed } from '@/components/VimeoEmbed/VimeoEmbed';
import { choiceOf, type SiteSection } from '@/lib/site/sections';
import { vimeoPlayerUrl } from '@/lib/video/vimeo';
import type { SectionRefs } from '../api/site';
import { Bio, Cards, Hero, Highlights, ImageText } from './mediaSections';
import { Body, Cta, Title, type Ink } from './sectionParts';
import styles from './Sections.module.css';

type Level = 1 | 2;
type Props = { sections: SiteSection[]; refs: SectionRefs; headingLevel?: Level };
type BodyProps = { section: SiteSection; refs: SectionRefs; level: Level; first: boolean; ink: Ink };

function SectionBody({ section, refs, level, first, ink }: BodyProps) {
  const { fields, items } = section;
  const base = { fields, refs, ink };
  switch (section.kind) {
    case 'hero':
      return <Hero {...base} level={level} layout={choiceOf(section, 'layout')} eager={first} />;
    case 'imageText':
      return <ImageText {...base} />;
    case 'bio':
      return <Bio {...base} />;
    case 'cards':
      return <Cards {...base} items={items} />;
    case 'highlights':
      return <Highlights {...base} items={items} />;
    case 'cta':
      return (
        <div className={styles.centered}>
          <Title text={fields.heading} ink={ink} />
          <Body text={fields.body} ink={ink} quiet />
          <Cta fields={fields} ink={ink} />
        </div>
      );
    case 'text':
      return (
        <div className={styles.prose}>
          <Title text={fields.heading} ink={ink} />
          <Body text={fields.body} ink={ink} />
        </div>
      );
    case 'video':
      return fields.vimeoId ? (
        <>
          <Title text={fields.heading} ink={ink} />
          <VimeoEmbed src={vimeoPlayerUrl(fields.vimeoId)} title={fields.heading || 'Video'} aspect={16 / 9} />
        </>
      ) : null;
    case 'curriculum': {
      const program = refs.curricula[fields.programSlug ?? ''];
      if (!program) return null;
      return (
        <div className={styles.prose}>
          <Title text={fields.heading || program.title} ink={ink} />
          <ol className={styles.modules}>
            {program.modules.map((m, i) => (
              <li key={i} className={styles.module}>
                <Text variant="label">{m.title}</Text>
                <ul className={styles.steps}>
                  {m.steps.map((step, j) => (
                    <li key={j}>
                      <Text tone="secondary">{step}</Text>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      );
    }
    case 'offer': {
      const offer = refs.offers[fields.offerSlug ?? ''];
      if (!offer) return null;
      return (
        <div className={styles.centered}>
          <Title text={fields.heading} ink={ink} />
          <div className={styles.offer}>
            <Title text={offer.title} level={3} />
            <Body text={offer.description ?? undefined} quiet />
            <Text variant="label" className={styles.price}>
              {offer.price}
            </Text>
            <ButtonLink href={offer.href}>Buy now</ButtonLink>
          </div>
        </div>
      );
    }
    case 'testimonials':
      return (
        <>
          <Title text={fields.heading} ink={ink} />
          <div className={styles.quotes}>
            {items.map((item, i) => (
              <figure key={i} className={styles.quote}>
                <blockquote>
                  <Text className={styles.text}>{item.quote}</Text>
                </blockquote>
                <figcaption>
                  <Text variant="eyebrow" tone="secondary">
                    {item.name}
                  </Text>
                </figcaption>
              </figure>
            ))}
          </div>
        </>
      );
    case 'faq':
      return (
        <div className={styles.prose}>
          <Title text={fields.heading} ink={ink} />
          <div className={styles.faq}>
            {items.map((item, i) => (
              <details key={i} className={styles.question}>
                <summary>
                  <Text as="span" className={styles.ask}>
                    {item.question}
                  </Text>
                </summary>
                <Text className={styles.text}>{item.answer}</Text>
              </details>
            ))}
          </div>
        </div>
      );
    default:
      return section.kind satisfies never;
  }
}

/** Band attributes the stylesheet keys on. Overlay hero text sits on the photo only when it has one. */
function band(section: SiteSection, refs: SectionRefs) {
  const tone = choiceOf(section, 'tone');
  const layout = section.kind === 'hero' ? choiceOf(section, 'layout') : undefined;
  const side = section.kind === 'imageText' ? choiceOf(section, 'side') : undefined;
  const onPhoto = layout === 'overlay' && Boolean(refs.images[section.fields.image ?? '']);
  const ink: Ink = onPhoto ? 'on-media' : tone === 'dark' ? 'inverse' : 'default';
  return { tone, layout: onPhoto ? 'overlay' : layout === 'split' ? 'split' : undefined, side, ink };
}

/** headingLevel 1 = a leading hero owns the page h1; 2 = the route already rendered one. */
export function Sections({ sections, refs, headingLevel = 1 }: Props) {
  return sections.map((section, i) => {
    const { ink, ...attrs } = band(section, refs);
    const body = SectionBody({ section, refs, level: i === 0 ? headingLevel : 2, first: i === 0, ink });
    return body ? (
      <Band key={section.id} kind={section.kind} {...attrs}>
        {body}
      </Band>
    ) : null;
  });
}

type BandProps = { kind: string; tone?: string; layout?: string; side?: string; children: ReactNode };

/** One full-width band with the shared content column. Page titles use it too, so all text lines up. */
export function Band({ kind, tone, layout, side, children }: BandProps) {
  return (
    <section className={styles.section} data-kind={kind} data-tone={tone} data-layout={layout} data-side={side}>
      <Container width="wide" className={styles.inner}>
        {children}
      </Container>
    </section>
  );
}
