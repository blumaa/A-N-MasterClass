// Studio curriculum: reads + one command entry point. Every command checks capability
// (G15) and that the target row lives in the viewer's space (tenant wall before RLS).
// Download parts: the file is uploaded first (FileUpload, kind program); a new path must sit in the
// program's folder (isProductPath). Objects of deleted or replaced files go after the DB write.
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import { ConstraintError } from '@/lib/data/errors';
import type { Direction, ModulePatch, PartPatch, ProductPatch, Repo, StepPatch } from '@/lib/data/repo';
import type { Module, Part, PartKind, Product, Step } from '@/lib/data/types';
import type { FileStore } from '@/lib/storage/fileStore';
import { isProductPath } from '@/lib/storage/uploadPath';

export type CurriculumStep = Step & { parts: Part[] };
export type CurriculumModule = Module & { steps: CurriculumStep[] };
export type Curriculum = { program: Product; modules: CurriculumModule[] };

export async function studioPrograms(repo: Repo, viewer: Viewer): Promise<Product[] | null> {
  if (!viewerCan(viewer, 'products.edit')) return null;
  return (await repo.products(viewer.space.id)).filter((p) => p.kind === 'program');
}

export async function curriculum(repo: Repo, viewer: Viewer, programSlug: string): Promise<Curriculum | null> {
  if (!viewerCan(viewer, 'products.edit')) return null;
  const program = await repo.productBySlug(viewer.space.id, programSlug);
  if (!program || program.kind !== 'program') return null;
  const modules = await repo.modules(program.id);
  const steps = await repo.steps(modules.map((m) => m.id));
  const parts = await Promise.all(steps.map((s) => repo.parts(s.id)));
  const withParts = steps.map((s, i) => ({ ...s, parts: parts[i] ?? [] }));
  return {
    program,
    modules: modules.map((m) => ({ ...m, steps: withParts.filter((s) => s.moduleId === m.id) })),
  };
}

export type CurriculumCommand =
  | { op: 'createProgram'; title: string; slug: string }
  | { op: 'updateProgram'; programId: string; patch: ProductPatch }
  | { op: 'createModule'; programId: string; title: string }
  | { op: 'updateModule'; moduleId: string; patch: ModulePatch }
  | { op: 'deleteModule'; moduleId: string }
  | { op: 'createStep'; moduleId: string; title: string }
  | { op: 'updateStep'; stepId: string; patch: StepPatch }
  | { op: 'deleteStep'; stepId: string }
  | { op: 'createPart'; stepId: string; kind: PartKind }
  | { op: 'updatePart'; partId: string; patch: PartPatch }
  | { op: 'deletePart'; partId: string }
  | { op: 'move'; table: 'modules' | 'steps' | 'parts'; id: string; direction: Direction };


// Walk up to the owning program. null = row missing.
async function programOfModule(repo: Repo, moduleId: string): Promise<Product | null> {
  const m = await repo.module(moduleId);
  return m ? repo.product(m.programId) : null;
}
async function programOfStep(repo: Repo, stepId: string): Promise<Product | null> {
  const s = await repo.step(stepId);
  return s ? programOfModule(repo, s.moduleId) : null;
}
async function programOfPart(repo: Repo, partId: string): Promise<Product | null> {
  const p = await repo.part(partId);
  return p ? programOfStep(repo, p.stepId) : null;
}

const targetOf: { [K in CurriculumCommand['op']]: (repo: Repo, c: Extract<CurriculumCommand, { op: K }>) => Promise<Product | null> | null } = {
  createProgram: () => null,
  updateProgram: (repo, c) => repo.product(c.programId),
  createModule: (repo, c) => repo.product(c.programId),
  updateModule: (repo, c) => programOfModule(repo, c.moduleId),
  deleteModule: (repo, c) => programOfModule(repo, c.moduleId),
  createStep: (repo, c) => programOfModule(repo, c.moduleId),
  updateStep: (repo, c) => programOfStep(repo, c.stepId),
  deleteStep: (repo, c) => programOfStep(repo, c.stepId),
  createPart: (repo, c) => programOfStep(repo, c.stepId),
  updatePart: (repo, c) => programOfPart(repo, c.partId),
  deletePart: (repo, c) => programOfPart(repo, c.partId),
  move: (repo, c) =>
    c.table === 'modules' ? programOfModule(repo, c.id) : c.table === 'steps' ? programOfStep(repo, c.id) : programOfPart(repo, c.id),
};

/** Stored files of parts in these steps (to remove once their rows are gone). */
async function stepFiles(repo: Repo, stepIds: string[]): Promise<string[]> {
  const parts = (await Promise.all(stepIds.map((id) => repo.parts(id)))).flat();
  return parts.flatMap((p) => (p.filePath ? [p.filePath] : []));
}

/** Runs the DB write, then removes the objects it orphaned. Storage errors propagate. */
async function thenRemove(files: FileStore, paths: string[], write: () => Promise<unknown>): Promise<undefined> {
  await write();
  if (paths.length > 0) await files.remove(paths);
  return undefined;
}

/** A changed file path must be an upload in the program's folder; an unchanged (legacy) one may stay. */
async function partPathOk(repo: Repo, spaceId: string, program: Product | null, c: CurriculumCommand): Promise<boolean> {
  if (c.op !== 'updatePart' || !c.patch.filePath || !program) return true;
  if (isProductPath(c.patch.filePath, spaceId, program.id)) return true;
  return (await repo.part(c.partId))?.filePath === c.patch.filePath;
}

async function run(repo: Repo, files: FileStore, viewer: Viewer, c: CurriculumCommand, program: Product | null): Promise<string | undefined> {
  switch (c.op) {
    case 'createProgram':
      return (await repo.createProduct({ spaceId: viewer.space.id, kind: 'program', slug: c.slug, title: c.title })).id;
    case 'updateProgram':
      await repo.updateProduct(c.programId, c.patch);
      return;
    case 'createModule':
      return (await repo.createModule({ programId: c.programId, title: c.title })).id;
    case 'updateModule':
      if (c.patch.unlockAfterStepId && program) {
        const gate = await programOfStep(repo, c.patch.unlockAfterStepId);
        if (gate?.id !== program.id) throw new ConstraintError('gate step must belong to this program');
      }
      await repo.updateModule(c.moduleId, c.patch);
      return;
    case 'deleteModule': {
      const steps = await repo.steps([c.moduleId]);
      return thenRemove(files, await stepFiles(repo, steps.map((s) => s.id)), () => repo.deleteModule(c.moduleId));
    }
    case 'createStep':
      return (await repo.createStep({ moduleId: c.moduleId, title: c.title })).id;
    case 'updateStep':
      return void (await repo.updateStep(c.stepId, c.patch));
    case 'deleteStep':
      return thenRemove(files, await stepFiles(repo, [c.stepId]), () => repo.deleteStep(c.stepId));
    case 'createPart':
      return (await repo.createPart({ stepId: c.stepId, kind: c.kind })).id;
    case 'updatePart': {
      const old = (await repo.part(c.partId))?.filePath;
      const replaced = old && c.patch.filePath !== undefined && c.patch.filePath !== old;
      return thenRemove(files, replaced ? [old] : [], () => repo.updatePart(c.partId, c.patch));
    }
    case 'deletePart': {
      const old = (await repo.part(c.partId))?.filePath;
      return thenRemove(files, old ? [old] : [], () => repo.deletePart(c.partId));
    }
    case 'move':
      return void (await repo.move(c.table, c.id, c.direction));
  }
}

export async function editCurriculum(repo: Repo, files: FileStore, viewer: Viewer, c: CurriculumCommand): Promise<CommandResult> {
  if (!viewerCan(viewer, 'products.edit')) return { ok: false, error: 'forbidden' };
  const resolve = targetOf[c.op] as (repo: Repo, c: CurriculumCommand) => Promise<Product | null> | null;
  const pending = resolve(repo, c);
  const program = pending ? await pending : null;
  if (pending && (!program || program.spaceId !== viewer.space.id || program.kind !== 'program')) {
    return { ok: false, error: 'not_found' };
  }
  if (!(await partPathOk(repo, viewer.space.id, program, c))) return { ok: false, error: 'not_found' };
  try {
    return { ok: true, id: await run(repo, files, viewer, c, program) };
  } catch (e) {
    if (e instanceof ConstraintError) return { ok: false, error: 'invalid', message: e.message };
    throw e;
  }
}
