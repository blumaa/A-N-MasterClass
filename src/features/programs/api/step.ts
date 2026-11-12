// Step page data + Complete & Continue (G6, G7). Parts only leave the server when the step is open.
import type { Viewer } from '@/lib/auth/viewer';
import type { Repo } from '@/lib/data/repo';
import type { Part } from '@/lib/data/types';
import type { StepAccess } from '@/lib/programs/access';
import { downloadName } from '@/lib/format/bytes';
import { programOutline, type Outline, type OutlineStep } from './outline';
import { quizViews, type QuizView } from './quizView';

export type StepView = {
  outline: Outline;
  step: OutlineStep & { moduleId: string; description: string | null };
  access: StepAccess;
  parts: Part[];
  /** Quiz parts by id: questions (no key) and the viewer's latest attempt. */
  quizzes: Record<string, QuizView>;
  prevStepId: string | null;
  nextStepId: string | null;
};

export async function stepView(
  repo: Repo,
  viewer: Viewer,
  programSlug: string,
  stepId: string,
  now: Date,
): Promise<StepView | null> {
  const outline = await programOutline(repo, viewer, programSlug, now);
  if (!outline) return null;
  const flat = outline.modules.flatMap((m) => m.steps.map((s) => ({ ...s, moduleId: m.id })));
  const at = flat.findIndex((s) => s.id === stepId);
  const found = flat[at];
  if (!found) return null;
  const row = await repo.step(stepId);
  const parts = found.access.kind === 'open' ? await repo.parts(stepId) : [];
  const quizzes = await quizViews(repo, viewer.profile?.id ?? null, parts);
  return {
    outline,
    step: { ...found, description: row?.description ?? null },
    access: found.access,
    parts,
    quizzes,
    prevStepId: flat[at - 1]?.id ?? null,
    nextStepId: flat[at + 1]?.id ?? null,
  };
}

/** Whether the viewer may open a step, found by id alone (the community StepGate). */
export async function stepOpen(repo: Repo, viewer: Viewer, stepId: string, now: Date): Promise<boolean> {
  const step = await repo.step(stepId);
  const mod = step ? await repo.module(step.moduleId) : null;
  const program = mod ? await repo.product(mod.programId) : null;
  if (!program || program.spaceId !== viewer.space.id) return false;
  return (await stepView(repo, viewer, program.slug, stepId, now))?.access.kind === 'open';
}

/**
 * Storage path + save-as name of a download part, or null unless the viewer may read its step
 * (same rule as the step page: stepView gives parts only for an open step; RLS can_read_step again).
 */
export async function partDownload(
  repo: Repo,
  viewer: Viewer,
  programSlug: string,
  stepId: string,
  partId: string,
  now: Date,
): Promise<{ path: string; name: string } | null> {
  const view = await stepView(repo, viewer, programSlug, stepId, now);
  const part = view?.parts.find((p) => p.id === partId);
  if (part?.kind !== 'download' || !part.filePath) return null;
  return { path: part.filePath, name: downloadName(part.title ?? 'Download', part.filePath) };
}

export type CompleteResult = { ok: true; nextStepId: string | null } | { ok: false; error: 'signed_out' | 'not_found' | 'not_open' };

export async function completeStep(
  repo: Repo,
  viewer: Viewer,
  programSlug: string,
  stepId: string,
  done: boolean,
  now: Date,
): Promise<CompleteResult> {
  if (!viewer.profile) return { ok: false, error: 'signed_out' };
  const view = await stepView(repo, viewer, programSlug, stepId, now);
  if (!view) return { ok: false, error: 'not_found' };
  if (view.access.kind !== 'open') return { ok: false, error: 'not_open' };
  await repo.setStepComplete(viewer.profile.id, stepId, done);
  return { ok: true, nextStepId: view.nextStepId };
}
