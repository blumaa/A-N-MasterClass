// Server renderers for published page sections (G11). One renderer per SECTION_KINDS entry;
// fields were validated on save (lib/site/sections), so links here are already safe.
import { Heading, Stack, Text } from '@/components/ui/mds';
import { ButtonLink } from '@/components/ui/links';
import { VimeoEmbed } from '@/components/VimeoEmbed/VimeoEmbed';
import type { SiteSection } from '@/lib/site/sections';
import { vimeoPlayerUrl } from '@/lib/video/vimeo';
import type { SectionRefs } from '../api/site';
import styles from './Sections.module.css';

type Level = 1 | 2;
type Props = { sections: SiteSection[]; refs: SectionRefs; headingLevel?: Level };

function Cta({ fields }: { fields: Record<string, string> }) {
  return fields.ctaLabel && fields.ctaHref ? <ButtonLink href={fields.ctaHref}>{fields.ctaLabel}</ButtonLink> : null;
}

function Title({ text, level = 2 }: { text: string | undefined; level?: 1 | 2 | 3 }) {
  return text ? (
    <Heading level={level} variant={level === 1 ? 'display' : 'title'}>
      {text}
    </Heading>
  ) : null;
}

function Body({ text }: { text: string | undefined }) {
  return text ? <Text className={styles.text}>{text}</Text> : null;
}

function SectionBody({ section, refs, headingLevel }: { section: SiteSection } & Required<Omit<Props, 'sections'>>) {
  const { fields, items } = section;
  switch (section.kind) {
    case 'hero':
      return (
        <div className={styles.hero}>
          <Title text={fields.heading} level={headingLevel} />
          <Body text={fields.subheading} />
          <Cta fields={fields} />
        </div>
      );
    case 'cta':
      return (
        <div className={styles.cta}>
          <Title text={fields.heading} />
          <Body text={fields.body} />
          <Cta fields={fields} />
        </div>
      );
    case 'text':
      return (
        <>
          <Title text={fields.heading} />
          <Body text={fields.body} />
        </>
      );
    case 'video':
      return fields.vimeoId ? (
        <>
          <Title text={fields.heading} />
          <VimeoEmbed src={vimeoPlayerUrl(fields.vimeoId)} title={fields.heading || 'Video'} aspect={16 / 9} />
        </>
      ) : null;
    case 'curriculum': {
      const program = refs.curricula[fields.programSlug ?? ''];
      if (!program) return null;
      return (
        <>
          <Title text={fields.heading || program.title} />
          <ol className={styles.modules}>
            {program.modules.map((m, i) => (
              <li key={i}>
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
        </>
      );
    }
    case 'offer': {
      const offer = refs.offers[fields.offerSlug ?? ''];
      if (!offer) return null;
      return (
        <>
          <Title text={fields.heading} />
          <div className={styles.offer}>
            <Title text={offer.title} level={3} />
            <Body text={offer.description ?? undefined} />
            <Text variant="label" className={styles.price}>
              {offer.price}
            </Text>
            <ButtonLink href={offer.href}>Buy now</ButtonLink>
          </div>
        </>
      );
    }
    case 'testimonials':
      return (
        <>
          <Title text={fields.heading} />
          <div className={styles.quotes}>
            {items.map((item, i) => (
              <figure key={i} className={styles.quote}>
                <blockquote>
                  <Text className={styles.text}>{item.quote}</Text>
                </blockquote>
                <figcaption>
                  <Text variant="meta" tone="secondary">
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
        <>
          <Title text={fields.heading} />
          <div className={styles.faq}>
            {items.map((item, i) => (
              <details key={i} className={styles.question}>
                <summary>
                  <Text as="span" variant="label">
                    {item.question}
                  </Text>
                </summary>
                <Text className={styles.text}>{item.answer}</Text>
              </details>
            ))}
          </div>
        </>
      );
  }
}

/** headingLevel 1 = a leading hero owns the page h1; 2 = the route already rendered one. */
export function Sections({ sections, refs, headingLevel = 1 }: Props) {
  return sections.map((section, i) => {
    const body = SectionBody({ section, refs, headingLevel: i === 0 ? headingLevel : 2 });
    return body ? (
      <section key={section.id} className={styles.section}>
        <Stack gap="base">{body}</Stack>
      </section>
    ) : null;
  });
}
