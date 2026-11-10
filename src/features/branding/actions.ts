'use server';
// Branding Server Actions. Space from Host (actionViewer), never from the form.
import { refresh } from 'next/cache';
import { actionViewer } from '@/lib/auth/actionViewer';
import type { Viewer } from '@/lib/auth/viewer';
import { failureMessage, type CommandResult } from '@/lib/data/commandResult';
import { getRepo } from '@/lib/data/getRepo';
import { saveBranding, saveProgramTheme } from './api/branding';
import { brandingFromForm, colorsFromForm } from './formInput';

export type BrandingState = { message: string; saved: boolean } | null;

async function run(forbidden: string, command: (viewer: Viewer) => Promise<CommandResult>): Promise<BrandingState> {
  const viewer = await actionViewer();
  if (!viewer) return { message: forbidden, saved: false };
  const result = await command(viewer);
  if (!result.ok) return { message: failureMessage(result, forbidden), saved: false };
  refresh();
  return { message: 'Saved.', saved: true };
}

export async function saveBrandingAction(_prev: BrandingState, form: FormData): Promise<BrandingState> {
  return run('You do not have permission to change branding.', (viewer) =>
    saveBranding(getRepo(), viewer, brandingFromForm(form)),
  );
}

export async function saveProgramThemeAction(_prev: BrandingState, form: FormData): Promise<BrandingState> {
  const productId = form.get('productId');
  return run('You do not have permission to edit programs.', (viewer) =>
    saveProgramTheme(getRepo(), viewer, typeof productId === 'string' ? productId : '', colorsFromForm(form)),
  );
}
