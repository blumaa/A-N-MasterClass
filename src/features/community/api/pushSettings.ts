// Per-type push settings (Group 2 push). A member turns push off per notification type, per
// space; all on by default (Kajabi). Only push is gated: the in-app notification always lands.
import type { Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import type { Repo } from '@/lib/data/repo';
import { NOTIFICATION_TYPES, type NotificationType } from '@/lib/data/types';

export type PushTypeSetting = { type: NotificationType; on: boolean };

const isType = (value: unknown): value is NotificationType => NOTIFICATION_TYPES.includes(value as NotificationType);

/** Every type in NOTIFICATION_TYPES order; none for a visitor. */
export async function pushTypeSettings(repo: Repo, viewer: Viewer): Promise<PushTypeSetting[]> {
  if (!viewer.profile) return [];
  const muted = new Set((await repo.pushMutes(viewer.space.id, [viewer.profile.id])).map((m) => m.type));
  return NOTIFICATION_TYPES.map((type) => ({ type, on: !muted.has(type) }));
}

/** Types in `onTypes` push; every other type is muted. */
export async function savePushTypes(repo: Repo, viewer: Viewer, onTypes: readonly unknown[]): Promise<CommandResult> {
  const profile = viewer.profile;
  if (!profile) return { ok: false, error: 'forbidden' };
  if (!onTypes.every(isType)) return { ok: false, error: 'invalid', message: 'Unknown notification type.' };
  const on = new Set(onTypes);
  await Promise.all(NOTIFICATION_TYPES.map((type) => repo.setPushMute(viewer.space.id, profile.id, type, !on.has(type))));
  return { ok: true };
}
