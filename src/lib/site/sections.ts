// Page builder sections (G11): pages -> sections -> fields/items. One spec per kind drives
// the generic Studio editor, the server-side validation and the stored JSON shape.
// Stored in pages.draft / pages.published (jsonb).
import { vimeoIdOf } from '@/lib/video/vimeo';

export const SECTION_KINDS = ['hero', 'text', 'video', 'curriculum', 'offer', 'testimonials', 'faq', 'cta'] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

/** Field types that point at another record of the space by slug (checked on save). */
export const REF_TYPES = ['program', 'offer'] as const;
export type RefType = (typeof REF_TYPES)[number];
export const isRefType = (v: string): v is RefType => REF_TYPES.includes(v as RefType);

/** Records a ref field may point at, per ref type (Studio select options). */
export type RefChoice = { slug: string; title: string };
export type SectionChoices = Record<RefType, readonly RefChoice[]>;

export type FieldType = 'text' | 'textarea' | 'href' | 'vimeo' | RefType;
export type FieldSpec = { name: string; label: string; type: FieldType; required?: boolean };
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
const button: FieldSpec[] = [
  { name: 'ctaLabel', label: 'Button text', type: 'text' },
  { name: 'ctaHref', label: 'Button link', type: 'href' },
];

export const SECTION_SPECS: Readonly<Record<SectionKind, SectionSpec>> = {
  hero: {
    label: 'Hero',
    fields: [{ ...heading, required: true }, { name: 'subheading', label: 'Subheading', type: 'textarea' }, ...button],
  },
  text: { label: 'Text', fields: [heading, { name: 'body', label: 'Text', type: 'textarea', required: true }] },
  video: { label: 'Video', fields: [heading, { name: 'vimeoId', label: 'Vimeo link', type: 'vimeo', required: true }] },
  curriculum: {
    label: 'Curriculum',
    fields: [heading, { name: 'programSlug', label: 'Program', type: 'program', required: true }],
  },
  offer: {
    label: 'Offer',
    fields: [heading, { name: 'offerSlug', label: 'Offer', type: 'offer', required: true }],
  },
  testimonials: {
    label: 'Testimonials',
    fields: [heading],
    item: {
      label: 'Testimonial',
      fields: [
        { name: 'quote', label: 'Quote', type: 'textarea', required: true },
        { name: 'name', label: 'Name', type: 'text', required: true },
      ],
    },
  },
  faq: {
    label: 'FAQ',
    fields: [heading],
    item: {
      label: 'Question',
      fields: [
        { name: 'question', label: 'Question', type: 'text', required: true },
        { name: 'answer', label: 'Answer', type: 'textarea', required: true },
      ],
    },
  },
  cta: {
    label: 'Call to action',
    fields: [{ ...heading, required: true }, { name: 'body', label: 'Text', type: 'textarea' }, ...button],
  },
};

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

function readFields(specs: readonly FieldSpec[], raw: Record<string, string>, where: string): Record<string, string> {
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
    }
    out[spec.name] = value;
  }
  return out;
}

export type SectionResult = { ok: true; section: SiteSection } | { ok: false; message: string };

/** New fields/items for an existing section, checked against its spec. Blank item rows are dropped. */
export function validateSection(
  section: SiteSection,
  fields: Record<string, string>,
  items: Record<string, string>[],
): SectionResult {
  const spec = SECTION_SPECS[section.kind];
  try {
    const itemSpec = spec.item;
    const filled = itemSpec ? items.filter((row) => itemSpec.fields.some((f) => (row[f.name] ?? '').trim())) : [];
    return {
      ok: true,
      section: {
        ...section,
        fields: readFields(spec.fields, fields, ''),
        items: itemSpec ? filled.map((row, i) => readFields(itemSpec.fields, row, `${itemSpec.label} ${i + 1}: `)) : [],
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
