'use server';
// Download studio writes (products.edit). Space from Host (actionViewer), never from the form.
import { refresh } from 'next/cache';
import { actionViewer } from '@/lib/auth/actionViewer';
import { failureMessage } from '@/lib/data/commandResult';
import { getRepo } from '@/lib/data/getRepo';
import { drainSoon } from '@/lib/storage/cleanup';
import { editDownloads } from './api/studio';
import { downloadCommandFromForm } from './downloadsFromForm';

export type DownloadState = { message: string } | null;

const NO_EDIT = 'You do not have permission to edit downloads.';

export async function editDownloadsAction(_prev: DownloadState, form: FormData): Promise<DownloadState> {
  const parsed = downloadCommandFromForm(form);
  if (!parsed.ok) return { message: parsed.message };
  const viewer = await actionViewer();
  if (!viewer) return { message: NO_EDIT };
  const result = await editDownloads(getRepo(), viewer, parsed.command, new Date());
  if (!result.ok) return { message: failureMessage(result, NO_EDIT) };
  drainSoon();
  refresh();
  return null;
}
