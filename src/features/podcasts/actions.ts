'use server';
// Podcast writes. Studio edits (products.edit) and the listener's own feed reset.
// Space from Host (actionViewer), never from the form.
import { refresh } from 'next/cache';
import { actionViewer } from '@/lib/auth/actionViewer';
import { failureMessage } from '@/lib/data/commandResult';
import { getRepo } from '@/lib/data/getRepo';
import { getFileStore } from '@/lib/storage/getFileStore';
import { formReader } from '@/lib/forms/formReader';
import { resetFeed } from './api/listen';
import { editPodcasts } from './api/studio';
import { podcastCommandFromForm } from './podcastsFromForm';

export type PodcastState = { message: string } | null;

const NO_EDIT = 'You do not have permission to edit podcasts.';
const SIGN_IN = 'Sign in to manage your feed.';

export async function editPodcastsAction(_prev: PodcastState, form: FormData): Promise<PodcastState> {
  const parsed = podcastCommandFromForm(form);
  if (!parsed.ok) return { message: parsed.message };
  const viewer = await actionViewer();
  if (!viewer) return { message: NO_EDIT };
  const result = await editPodcasts(getRepo(), getFileStore(), viewer, parsed.command, new Date());
  if (!result.ok) return { message: failureMessage(result, NO_EDIT) };
  refresh();
  return null;
}

export async function resetFeedAction(_prev: PodcastState, form: FormData): Promise<PodcastState> {
  const productId = formReader(form).raw('productId');
  if (!productId) return { message: 'Missing productId.' };
  const viewer = await actionViewer();
  if (!viewer) return { message: SIGN_IN };
  const result = await resetFeed(getRepo(), viewer, productId, new Date());
  if (!result.ok) return { message: failureMessage(result, SIGN_IN) };
  refresh();
  return null;
}
