// Studio curriculum: reads + one command entry point. Every command checks capability
// (G15) and that the target row lives in the viewer's space (tenant wall before RLS).
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import { ConstraintError } from '@/lib/data/errors';
import type { Direction, ModulePatch, PartPatch, ProductPatch, Repo, StepPatch } from '@/lib/data/repo';
import type { Module, Part, PartKind, Product, Step } from '@/lib/data/types';

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

async function run(repo: Repo, viewer: Viewer, c: CurriculumCommand, program: Product | null): Promise<string | undefined> {
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
    case 'deleteModule':
      return void (await repo.deleteModule(c.moduleId));
    case 'createStep':
      return (await repo.createStep({ moduleId: c.moduleId, title: c.title })).id;
    case 'updateStep':
      return void (await repo.updateStep(c.stepId, c.patch));
    case 'deleteStep':
      return void (await repo.deleteStep(c.stepId));
    case 'createPart':
      return (await repo.createPart({ stepId: c.stepId, kind: c.kind })).id;
    case 'updatePart':
      return void (await repo.updatePart(c.partId, c.patch));
    case 'deletePart':
      return void (await repo.deletePart(c.partId));
    case 'move':
      return void (await repo.move(c.table, c.id, c.direction));
  }
}

export async function editCurriculum(repo: Repo, viewer: Viewer, c: CurriculumCommand): Promise<CommandResult> {
  if (!viewerCan(viewer, 'products.edit')) return { ok: false, error: 'forbidden' };
  const resolve = targetOf[c.op] as (repo: Repo, c: CurriculumCommand) => Promise<Product | null> | null;
  const pending = resolve(repo, c);
  const program = pending ? await pending : null;
  if (pending && (!program || program.spaceId !== viewer.space.id || program.kind !== 'program')) {
    return { ok: false, error: 'not_found' };
  }
  try {
    return { ok: true, id: await run(repo, viewer, c, program) };
  } catch (e) {
    if (e instanceof ConstraintError) return { ok: false, error: 'invalid', message: e.message };
    throw e;
  }
}
