// Studio form -> CurriculumCommand. Every editor form posts `op` plus its fields.
// Only fields present in the form go into a patch; blank optional fields become null.
import type { Direction } from '@/lib/data/repo';
import { FormError, formReader, optional, parseForm, type FormReader as Reader } from '@/lib/forms/formReader';
import { titleAndSlug } from '@/lib/forms/commands';
import { PART_KINDS, PUBLISH_STATUSES, type PartKind } from '@/lib/data/types';
import { vimeoIdOf } from '@/lib/video/vimeo';
import type { CurriculumCommand } from './api/curriculum';

export type Parsed = { ok: true; command: CurriculumCommand } | { ok: false; message: string };

const TABLES = ['modules', 'steps', 'parts'] as const;
const DIRECTIONS: readonly Direction[] = ['up', 'down'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const asText = (v: string): string => v;
function asDays(v: string): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new FormError('Days must be a whole number, 0 or more.');
  return n;
}
function asDate(v: string): Date {
  if (!DATE.test(v)) throw new FormError('Use a date like 2026-12-01.');
  return new Date(`${v}T00:00:00Z`);
}
function asVimeoId(v: string): string {
  const id = vimeoIdOf(v);
  if (!id) throw new FormError('Paste a Vimeo link or video id.');
  return id;
}

function statusField(r: Reader) {
  return r.raw('status') === undefined ? {} : { status: r.oneOf('status', PUBLISH_STATUSES) };
}
function titleField(r: Reader) {
  return r.raw('title') === undefined ? {} : { title: r.required('title') };
}

const PARSERS: Record<CurriculumCommand['op'], (r: Reader) => CurriculumCommand> = {
  createProgram: (r) => ({ op: 'createProgram', ...titleAndSlug(r) }),
  updateProgram: (r) => ({
    op: 'updateProgram',
    programId: r.required('programId'),
    patch: { ...titleField(r), ...optional(r, 'subtitle', asText), ...statusField(r) },
  }),
  createModule: (r) => ({ op: 'createModule', programId: r.required('programId'), title: r.required('title') }),
  updateModule: (r) => ({
    op: 'updateModule',
    moduleId: r.required('moduleId'),
    patch: {
      ...titleField(r),
      ...optional(r, 'description', asText),
      ...statusField(r),
      ...optional(r, 'unlockAfterStepId', asText),
      ...optional(r, 'releaseAfterDays', asDays),
      ...optional(r, 'releaseAt', asDate),
    },
  }),
  deleteModule: (r) => ({ op: 'deleteModule', moduleId: r.required('moduleId') }),
  createStep: (r) => ({ op: 'createStep', moduleId: r.required('moduleId'), title: r.required('title') }),
  updateStep: (r) => ({
    op: 'updateStep',
    stepId: r.required('stepId'),
    patch: { ...titleField(r), ...optional(r, 'description', asText), ...statusField(r) },
  }),
  deleteStep: (r) => ({ op: 'deleteStep', stepId: r.required('stepId') }),
  createPart: (r) => ({ op: 'createPart', stepId: r.required('stepId'), kind: r.oneOf<PartKind>('kind', PART_KINDS) }),
  updatePart: (r) => {
    const video = r.raw('video');
    return {
      op: 'updatePart',
      partId: r.required('partId'),
      patch: {
        ...optional(r, 'title', asText),
        ...optional(r, 'text', asText),
        ...optional(r, 'filePath', asText),
        ...(video === undefined ? {} : { vimeoId: video === '' ? null : asVimeoId(video) }),
      },
    };
  },
  deletePart: (r) => ({ op: 'deletePart', partId: r.required('partId') }),
  move: (r) => ({
    op: 'move',
    table: r.oneOf('table', TABLES),
    id: r.required('id'),
    direction: r.oneOf('direction', DIRECTIONS),
  }),
};

const OPS = Object.keys(PARSERS) as CurriculumCommand['op'][];

export function commandFromForm(form: FormData): Parsed {
  const r = formReader(form);
  const parsed = parseForm(() => PARSERS[r.oneOf('op', OPS)](r));
  return parsed.ok ? { ok: true, command: parsed.value } : parsed;
}
