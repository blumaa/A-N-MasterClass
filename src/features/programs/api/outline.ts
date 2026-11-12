// Student view of a program: modules, steps, access state, progress (G6, G7, G8, G26 quiz lock and certificate).
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { Repo } from '@/lib/data/repo';
import type { Module, Product, Step } from '@/lib/data/types';
import { stepAccess, type StepAccess } from '@/lib/programs/access';

export type OutlineStep = Pick<Step, 'id' | 'title' | 'status'> & { done: boolean; access: StepAccess };
export type OutlineModule = Pick<Module, 'id' | 'title' | 'description' | 'status'> & {
  access: StepAccess;
  steps: OutlineStep[];
  completed: number;
};
export type Outline = {
  program: Product;
  modules: OutlineModule[];
  completed: number;
  total: number;
  continueStepId: string | null;
  hasAccess: boolean;
  isEditor: boolean;
  /** Certificates on, the viewer holds a grant and finished every counted step (G26). */
  certificateReady: boolean;
};

export async function programOutline(
  repo: Repo,
  viewer: Viewer,
  programSlug: string,
  now: Date,
): Promise<Outline | null> {
  const program = await repo.productBySlug(viewer.space.id, programSlug);
  if (!program || program.kind !== 'program') return null;
  const isEditor = viewerCan(viewer, 'products.edit');
  if (program.status !== 'published' && !isEditor) return null;

  const profileId = viewer.profile?.id ?? null;
  const [modules, grant] = await Promise.all([
    repo.modules(program.id),
    profileId ? repo.activeGrant(program.id, profileId, now) : null,
  ]);
  const steps = await repo.steps(modules.map((m) => m.id));
  const gateQuizIds = modules.flatMap((m) => (m.unlockQuizPartId ? [m.unlockQuizPartId] : []));
  const [done, attempts] = profileId
    ? await Promise.all([
        repo.completedStepIds(profileId, steps.map((s) => s.id)),
        repo.quizAttempts(profileId, gateQuizIds),
      ])
    : [new Set<string>(), []];
  const passedQuizPartIds = new Set(attempts.filter((a) => a.passed).map((a) => a.partId));

  const accessOf = (m: Module, stepStatus: Step['status']): StepAccess =>
    stepAccess({
      productStatus: program.status,
      moduleStatus: m.status,
      stepStatus,
      unlockAfterStepId: m.unlockAfterStepId,
      unlockQuizPartId: m.unlockQuizPartId,
      releaseAfterDays: m.releaseAfterDays,
      releaseAt: m.releaseAt,
      grantedAt: grant?.grantedAt ?? null,
      completedStepIds: done,
      passedQuizPartIds,
      isEditor,
      now,
    });

  const outlineModules: OutlineModule[] = [];
  for (const m of modules) {
    if (m.status !== 'published' && !isEditor) continue;
    const moduleSteps = steps
      .filter((s) => s.moduleId === m.id && (isEditor || s.status === 'published'))
      .map((s) => ({ id: s.id, title: s.title, status: s.status, done: done.has(s.id), access: accessOf(m, s.status) }));
    outlineModules.push({
      id: m.id,
      title: m.title,
      description: m.description,
      status: m.status,
      access: accessOf(m, 'published'),
      steps: moduleSteps,
      completed: moduleSteps.filter((s) => s.done).length,
    });
  }

  const flat = outlineModules.flatMap((m) => m.steps);
  const counted = outlineModules.flatMap((m) =>
    m.status === 'published' ? m.steps.filter((s) => s.status === 'published') : [],
  );
  const completed = counted.filter((s) => s.done).length;
  const firstOpenTodo = flat.find((s) => s.access.kind === 'open' && !s.done);
  return {
    program,
    modules: outlineModules,
    completed,
    total: counted.length,
    continueStepId: firstOpenTodo?.id ?? flat[0]?.id ?? null,
    hasAccess: isEditor || grant !== null,
    isEditor,
    certificateReady: program.certificates && grant !== null && counted.length > 0 && completed === counted.length,
  };
}
