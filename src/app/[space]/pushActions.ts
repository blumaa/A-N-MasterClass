'use server';
// Browser push subscription <-> push_subscriptions. Space from the request Host (actionViewer).
import { headers } from 'next/headers';
import { actionViewer } from '@/lib/auth/actionViewer';
import { getRepo } from '@/lib/data/getRepo';
import { forgetPush, isPushSaved, parsePushKeys, savePush, type PushSaveResult } from './pushSubscription';

export async function savePushAction(subscription: unknown): Promise<PushSaveResult> {
  const keys = parsePushKeys(subscription);
  if (!keys) return { ok: false, message: 'This browser gave an invalid push subscription.' };
  const viewer = await actionViewer();
  if (!viewer) return { ok: false, message: 'Sign in to turn on push.' };
  return savePush(getRepo(), viewer, keys, (await headers()).get('user-agent'));
}

export async function forgetPushAction(endpoint: string): Promise<void> {
  const viewer = await actionViewer();
  if (viewer && typeof endpoint === 'string') await forgetPush(getRepo(), viewer, endpoint);
}

export async function isPushSavedAction(endpoint: string): Promise<boolean> {
  const viewer = await actionViewer();
  return viewer !== null && typeof endpoint === 'string' ? isPushSaved(getRepo(), viewer, endpoint) : false;
}
