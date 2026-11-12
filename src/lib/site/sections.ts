// Page builder sections (G11): pages -> sections -> fields/items. One spec per kind drives
// the generic Studio editor, the server-side validation and the stored JSON shape.
// Stored in pages.draft / pages.published (jsonb).
import { isSiteImagePath } from '@/lib/storage/siteImages';
import { vimeoIdOf } from '@/lib/video/vimeo';

export const SECTION_KINDS = [
  'hero',
  'text',
  'imageText',
  'bio',
  'cards',
  'highlights',
  'video',
  'curriculum',
  'offer',
  'testimonials',
  'faq',
  'cta',
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** Field types that point at another record of the space by slug (checked on save). */
export const REF_TYPES = ['program', 'offer'] as const;
export type RefType = (typeof REF_TYPES)[number];
export const isRefType = (v: string): v is RefType => REF_TYPES.includes(v as RefType);

/** Records a ref field may point at, per ref type (Studio select options). */
export type RefChoice = { slug: string; title: string };
export type SectionChoices = Record<RefType, readonly RefChoice[]>;

export type FieldType = 'text' | 'textarea' | 'href' | 'vimeo' | 'image' | 'choice' | RefType;
export type ChoiceOption = { value: string; label: string };
/** `options` only for 'choice' fields; blank = first option. */
export type FieldSpec = {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: readonly ChoiceOption[];
};
export type SectionSpec = {
  label: string;
  fields: readonly FieldSpec[];
  item?: { label: string; fields: readonly FieldSpec[] };
};

export type SiteSection = {
  id: string;
  kind: SectionKind;
  hidden: boolean;
  fields: Record<string, string>;
  items: Record<string, string>[];
};

const heading: FieldSpec = { name: 'heading', label: 'Heading', type: 'text' };
const eyebrow: FieldSpec = { name: 'eyebrow', label: 'Small line above heading', type: 'text' };
const body: FieldSpec = { name: 'body', label: 'Text', type: 'textarea' };
const button: FieldSpec[] = [
  { name: 'ctaLabel', label: 'Button text', type: 'text' },
  { name: 'ctaHref', label: 'Button link', type: 'href' },
];

/** Image field plus its paired description (alt text) field `<name>Alt`. */
const image = (name = 'image', label = 'Image'): FieldSpec[] => [
  { name, label, type: 'image' },
  { name: `${name}Alt`, label: 'Image description', type: 'text' },
];

const choice = (name: string, label: string, options: [string, string][]): FieldSpec => ({
  name,
  label,
  type: 'choice',
  options: options.map(([value, text]) => ({ value, label: text })),
});

/** Background band of every section. */
export const TONES = ['plain', 'soft', 'dark'] as const;
export type Tone = (typeof TONES)[number];
const tone = choice('tone', 'Background', [
  ['plain', 'Plain'],
  ['soft', 'Soft'],
  ['dark', 'Dark'],
]);

/** Spec with the shared background choice appended. */
const spec = (label: string, fields: FieldSpec[], item?: SectionSpec['item']): SectionSpec =>
  item ? { label, fields: [...fields, tone], item } : { label, fields: [...fields, tone] };

export const SECTION_SPECS: Readonly<Record<SectionKind, SectionSpec>> = {
  hero: spec('Hero', [
    eyebrow,
    { ...heading, required: true },
    { name: 'subheading', label: 'Subheading', type: 'textarea' },
    ...image(),
    choice('layout', 'Layout', [
      ['overlay', 'Text over photo'],
      ['split', 'Photo beside text'],
    ]),
    ...button,
  ]),
  text: spec('Text', [heading, { ...body, required: true }]),
  imageText: spec('Image and text', [
    eyebrow,
    heading,
    body,
    ...image(),
    choice('side', 'Image side', [
      ['left', 'Left'],
      ['right', 'Right'],
    ]),
    ...button,
  ]),
  bio: spec('About me', [
    eyebrow,
    heading,
    { ...body, required: true },
    ...image('image', 'Photo'),
    { name: 'signature', label: 'Signature', type: 'text' },
  ]),
  cards: spec('Cards', [heading], {
    label: 'Card',
    fields: [
      ...image(),
      { name: 'title', label: 'Title', type: 'text', required: true },
      body,
      { name: 'href', label: 'Link', type: 'href' },
    ],
  }),
  highlights: spec('Highlights', [heading], {
    label: 'Highlight',
    fields: [{ name: 'text', label: 'Text', type: 'text', required: true }],
  }),
  video: spec('Video', [heading, { name: 'vimeoId', label: 'Vimeo link', type: 'vimeo', required: true }]),
  curriculum: spec('Curriculum', [heading, { name: 'programSlug', label: 'Program', type: 'program', required: true }]),
  offer: spec('Offer', [heading, { name: 'offerSlug', label: 'Offer', type: 'offer', required: true }]),
  testimonials: spec('Testimonials', [heading], {
    label: 'Testimonial',
    fields: [
      { name: 'quote', label: 'Quote', type: 'textarea', required: true },
      { name: 'name', label: 'Name', type: 'text', required: true },
    ],
  }),
  faq: spec('FAQ', [heading], {
    label: 'Question',
    fields: [
      { name: 'question', label: 'Question', type: 'text', required: true },
      { name: 'answer', label: 'Answer', type: 'textarea', required: true },
    ],
  }),
  cta: spec('Call to action', [{ ...heading, required: true }, body, ...button]),
};

/** Stored choice value, or the first option when blank. */
export function choiceOf(section: SiteSection, name: string): string {
  const options = SECTION_SPECS[section.kind].fields.find((f) => f.name === name)?.options ?? [];
  return section.fields[name] || (options[0]?.value ?? '');
}

export type AccentPart = { text: string; accent: boolean };
const ACCENT = /\*(\S(?:[^*]*\S)?)\*/g;

/** Splits a heading on `*word*` pairs; accent parts render in italics. */
export function splitAccent(text: string): AccentPart[] {
  const parts: AccentPart[] = [];
  let at = 0;
  for (const m of text.matchAll(ACCENT)) {
    if (m.index > at) parts.push({ text: text.slice(at, m.index), accent: false });
    parts.push({ text: m[1], accent: true });
    at = m.index + m[0].length;
  }
  if (at < text.length) parts.push({ text: text.slice(at), accent: false });
  return parts;
}

export const isSectionKind = (v: unknown): v is SectionKind => SECTION_KINDS.includes(v as SectionKind);

/** Links on public pages: site paths or https only (no javascript:, no protocol-relative). */
export function isSafeHref(href: string): boolean {
  if (href.startsWith('/')) return !href.startsWith('//');
  try {
    return new URL(href).protocol === 'https:';
  } catch {
    return false;
  }
}

const blank = (fields: readonly FieldSpec[]) => Object.fromEntries(fields.map((f) => [f.name, '']));

export function newSection(kind: SectionKind, id: string): SiteSection {
  return { id, kind, hidden: false, fields: blank(SECTION_SPECS[kind].fields), items: [] };
}

class Invalid extends Error {}

function readFields(
  specs: readonly FieldSpec[],
  raw: Record<string, string>,
  where: string,
  spaceId: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const spec of specs) {
    let value = (raw[spec.name] ?? '').trim();
    if (!value) {
      if (spec.required) throw new Invalid(`${where}${spec.label} is required.`);
    } else if (spec.type === 'href' && !isSafeHref(value)) {
      throw new Invalid(`${where}${spec.label} must start with / or https://.`);
    } else if (spec.type === 'vimeo') {
      const id = vimeoIdOf(value);
      if (!id) throw new Invalid(`${where}${spec.label}: paste a Vimeo link or video id.`);
      value = id;
    } else if (spec.type === 'image' && !isSiteImagePath(value, spaceId)) {
      throw new Invalid(`${where}${spec.label}: upload the image again.`);
    } else if (spec.type === 'choice' && !spec.options?.some((o) => o.value === value)) {
      throw new Invalid(`${where}${spec.label}: choose one of the options.`);
    }
    out[spec.name] = value;
  }
  return out;
}

export type SectionResult = { ok: true; section: SiteSection } | { ok: false; message: string };

/** New fields/items for an existing section, checked against its spec. Blank item rows are dropped.
 * Images must sit in the space's site folder. */
export function validateSection(
  section: SiteSection,
  fields: Record<string, string>,
  items: Record<string, string>[],
  spaceId: string,
): SectionResult {
  const spec = SECTION_SPECS[section.kind];
  try {
    const itemSpec = spec.item;
    const filled = itemSpec ? items.filter((row) => itemSpec.fields.some((f) => (row[f.name] ?? '').trim())) : [];
    return {
      ok: true,
      section: {
        ...section,
        fields: readFields(spec.fields, fields, '', spaceId),
        items: itemSpec ? filled.map((row, i) => readFields(itemSpec.fields, row, `${itemSpec.label} ${i + 1}: `, spaceId)) : [],
      },
    };
  } catch (err) {
    if (err instanceof Invalid) return { ok: false, message: err.message };
    throw err;
  }
}

const isStringRecord = (v: unknown): v is Record<string, string> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && Object.values(v).every((x) => typeof x === 'string');

function isSection(v: unknown): v is SiteSection {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.id === 'string' &&
    isSectionKind(s.kind) &&
    typeof s.hidden === 'boolean' &&
    isStringRecord(s.fields) &&
    Array.isArray(s.items) &&
    s.items.every(isStringRecord)
  );
}

/** Type guard for stored jsonb (Supabase rows). null = corrupt. */
export function parseSections(v: unknown): SiteSection[] | null {
  return Array.isArray(v) && v.every(isSection) ? v : null;
}
