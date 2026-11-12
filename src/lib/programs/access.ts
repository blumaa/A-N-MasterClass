// Step access: publish state, grant, module lock (G7), quiz lock (G26), drip (G8). SQL mirror: can_read_step().
export const PUBLISH_STATUSES = ['draft', 'published'] as const;
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

export type AccessInput = {
  productStatus: PublishStatus;
  moduleStatus: PublishStatus;
  stepStatus: PublishStatus;
  unlockAfterStepId: string | null;
  unlockQuizPartId: string | null;
  releaseAfterDays: number | null;
  releaseAt: Date | null;
  grantedAt: Date | null;
  completedStepIds: ReadonlySet<string>;
  /** Quiz parts with at least one passed attempt. */
  passedQuizPartIds: ReadonlySet<string>;
  isEditor: boolean;
  now: Date;
};

export type StepAccess =
  | { kind: 'open' }
  | { kind: 'hidden' }
  | { kind: 'no_grant' }
  | { kind: 'locked'; afterStepId: string }
  | { kind: 'quiz_locked'; quizPartId: string }
  | { kind: 'drip'; opensAt: Date };

const DAY_MS = 86_400_000;

export function opensAt(input: Pick<AccessInput, 'releaseAfterDays' | 'releaseAt' | 'grantedAt'>): Date | null {
  const fromGrant =
    input.releaseAfterDays !== null && input.grantedAt
      ? input.grantedAt.getTime() + input.releaseAfterDays * DAY_MS
      : null;
  const fixed = input.releaseAt?.getTime() ?? null;
  const latest = Math.max(fromGrant ?? -Infinity, fixed ?? -Infinity);
  return Number.isFinite(latest) ? new Date(latest) : null;
}

export function stepAccess(input: AccessInput): StepAccess {
  if (input.isEditor) return { kind: 'open' };
  const published = [input.productStatus, input.moduleStatus, input.stepStatus].every((s) => s === 'published');
  if (!published) return { kind: 'hidden' };
  if (!input.grantedAt) return { kind: 'no_grant' };
  if (input.unlockAfterStepId && !input.completedStepIds.has(input.unlockAfterStepId)) {
    return { kind: 'locked', afterStepId: input.unlockAfterStepId };
  }
  if (input.unlockQuizPartId && !input.passedQuizPartIds.has(input.unlockQuizPartId)) {
    return { kind: 'quiz_locked', quizPartId: input.unlockQuizPartId };
  }
  const opens = opensAt(input);
  if (opens && opens > input.now) return { kind: 'drip', opensAt: opens };
  return { kind: 'open' };
}
