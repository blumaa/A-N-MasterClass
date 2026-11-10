// Space library: programs the viewer can see, with progress. Drafts only for editors.
import type { Viewer } from '@/lib/auth/viewer';
import type { Repo } from '@/lib/data/repo';
import { programOutline, type Outline } from './outline';

export type LibraryItem = Pick<Outline, 'program' | 'completed' | 'total' | 'continueStepId' | 'hasAccess'>;

export async function library(repo: Repo, viewer: Viewer, now: Date): Promise<LibraryItem[]> {
  const programs = (await repo.products(viewer.space.id)).filter((p) => p.kind === 'program');
  const outlines = await Promise.all(programs.map((p) => programOutline(repo, viewer, p.slug, now)));
  return outlines
    .filter((o): o is Outline => o !== null)
    .map(({ program, completed, total, continueStepId, hasAccess }) => ({ program, completed, total, continueStepId, hasAccess }));
}
