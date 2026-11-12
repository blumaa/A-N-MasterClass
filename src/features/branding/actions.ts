'use server';
// Branding Server Actions. Space from Host (actionViewer), never from the form.
import { refresh } from 'next/cache';
import type { ActionState } from '@/components/ActionForm/ActionForm';
import { actionViewer } from '@/lib/auth/actionViewer';
import type { Viewer } from '@/lib/auth/viewer';
import { failureMessage, type CommandResult } from '@/lib/data/commandResult';
import { getRepo } from '@/lib/data/getRepo';
import { drainSoon } from '@/lib/storage/cleanup';
import { saveBranding, saveBrandMarks, saveProgramTheme } from './api/branding';
import { brandingFromForm, colorsFromForm, marksFromForm } from './formInput';

export type BrandingState = { message: string; saved: boolean } | null;

async function run(forbidden: string, command: (viewer: Viewer) => Promise<CommandResult>): Promise<NonNullable<BrandingState>> {
  const viewer = await actionViewer();
  if (!viewer) return { message: forbidden, saved: false };
  const result = await command(viewer);
  if (!result.ok) return { message: failureMessage(result, forbidden), saved: false };
  drainSoon();
  refresh();
  return { message: 'Saved.', saved: true };
}

export async function saveBrandingAction(_prev: BrandingState, form: FormData): Promise<BrandingState> {
  return run('You do not have permission to change branding.', (viewer) =>
    saveBranding(getRepo(), viewer, brandingFromForm(form)),
  );
}

/** ActionForm shape: success toasts, failure shows inline. */
export async function saveBrandMarksAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  const state = await run('You do not have permission to change branding.', (viewer) =>
    saveBrandMarks(getRepo(), viewer, marksFromForm(form)),
  );
  return state.saved ? { message: state.message, ok: true } : { message: state.message };
}

export async function saveProgramThemeAction(_prev: BrandingState, form: FormData): Promise<BrandingState> {
  const productId = form.get('productId');
  return run('You do not have permission to edit programs.', (viewer) =>
    saveProgramTheme(getRepo(), viewer, typeof productId === 'string' ? productId : '', colorsFromForm(form)),
  );
}
