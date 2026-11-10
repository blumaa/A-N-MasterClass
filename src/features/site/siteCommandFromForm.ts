// Studio site form -> SiteCommand. Section editors post fields as `f.<name>` and item rows
// as `i.<row>.<name>`; the navigation form posts `header.<row>.label|href` (same for footer).
import type { Direction } from '@/lib/data/repo';
import { LEGAL_KINDS, PAGE_KINDS, type LegalKind, type NavItem } from '@/lib/data/types';
import { formReader, parseForm, type FormReader as Reader } from '@/lib/forms/formReader';
import { SECTION_KINDS } from '@/lib/site/sections';
import { titleAndSlug } from '@/lib/forms/commands';
import type { SiteCommand } from './api/site';

export type Parsed = { ok: true; command: SiteCommand } | { ok: false; message: string };

const DIRECTIONS: readonly Direction[] = ['up', 'down'];
const OPS: readonly SiteCommand['op'][] = [
  'createPage',
  'updatePage',
  'deletePage',
  'addSection',
  'updateSection',
  'removeSection',
  'duplicateSection',
  'toggleSection',
  'moveSection',
  'publish',
  'unpublish',
  'restoreVersion',
  'saveNav',
];

const ROW = /^([a-z]+)\.(\d+)\.([A-Za-z]+)$/;

/** Rows posted as `<prefix>.<index>.<name>`, ordered by index. */
function rows(form: FormData, prefix: string): Record<string, string>[] {
  const byIndex = new Map<number, Record<string, string>>();
  for (const [key, value] of form.entries()) {
    const m = ROW.exec(key);
    if (!m || m[1] !== prefix || typeof value !== 'string') continue;
    const i = Number(m[2]);
    byIndex.set(i, { ...byIndex.get(i), [m[3]!]: value.trim() });
  }
  return [...byIndex.entries()].toSorted(([a], [b]) => a - b).map(([, row]) => row);
}

function fields(form: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of form.entries()) {
    if (key.startsWith('f.') && typeof value === 'string') out[key.slice(2)] = value.trim();
  }
  return out;
}

const nav = (form: FormData, prefix: string): NavItem[] =>
  rows(form, prefix).map((r) => ({ label: r.label ?? '', href: r.href ?? '' }));

const blankToNull = (v: string | undefined): string | null => v || null;

function parse(form: FormData): SiteCommand {
  const r: Reader = formReader(form);
  const op = r.oneOf('op', OPS);
  const pageId = () => r.required('pageId');
  const sectionId = () => r.required('sectionId');
  switch (op) {
    case 'createPage':
      return { op, kind: r.oneOf('kind', PAGE_KINDS), ...titleAndSlug(r) };
    case 'updatePage': {
      const legal = r.raw('legalKind');
      return {
        op,
        pageId: pageId(),
        title: r.required('title'),
        slug: r.required('slug'),
        seoTitle: blankToNull(r.raw('seoTitle')),
        seoDescription: blankToNull(r.raw('seoDescription')),
        isHome: r.raw('isHome') === 'on',
        legalKind: legal ? r.oneOf<LegalKind>('legalKind', LEGAL_KINDS) : null,
      };
    }
    case 'addSection':
      return { op, pageId: pageId(), kind: r.oneOf('kind', SECTION_KINDS) };
    case 'updateSection':
      return { op, pageId: pageId(), sectionId: sectionId(), fields: fields(form), items: rows(form, 'i') };
    case 'removeSection':
    case 'duplicateSection':
    case 'toggleSection':
      return { op, pageId: pageId(), sectionId: sectionId() };
    case 'moveSection':
      return { op, pageId: pageId(), sectionId: sectionId(), direction: r.oneOf('direction', DIRECTIONS) };
    case 'restoreVersion':
      return { op, pageId: pageId(), versionId: r.required('versionId') };
    case 'saveNav':
      return { op, header: nav(form, 'header'), footer: nav(form, 'footer') };
    case 'deletePage':
    case 'publish':
    case 'unpublish':
      return { op, pageId: pageId() };
  }
}

export function siteCommandFromForm(form: FormData): Parsed {
  const parsed = parseForm(() => parse(form));
  return parsed.ok ? { ok: true, command: parsed.value } : parsed;
}
