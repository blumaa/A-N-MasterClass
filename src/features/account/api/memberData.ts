// Member data export and delete (G25). Scope = the viewer's own data in this space. Delete erases
// this space first; the global account goes when no space is left. Orders stay for the seller's
// records without the profile link.
import type { Viewer } from '@/lib/auth/viewer';
import type { CommandFailure } from '@/lib/data/commandResult';
import type { MemberSpaceData, Repo } from '@/lib/data/repo';
import { removeFiles, type FileStore } from '@/lib/storage/fileStore';

export type MemberFiles = { site: FileStore; community: FileStore };
export type DeleteResult = { ok: true; accountDeleted: boolean } | CommandFailure;

export const OWNER_CANNOT_DELETE = 'Owners cannot delete their account here. Hand the space to another owner first.';

/** The viewer's data in this space, or null for a visitor. */
export async function exportMyData(repo: Repo, viewer: Viewer): Promise<MemberSpaceData | null> {
  if (!viewer.profile) return null;
  return repo.memberSpaceData(viewer.space.id, viewer.profile.id);
}

/** Erases the viewer from this space; deletes the global account when it was the last one. */
export async function deleteMyAccount(repo: Repo, files: MemberFiles, viewer: Viewer): Promise<DeleteResult> {
  if (!viewer.profile) return { ok: false, error: 'forbidden' };
  if (viewer.role === 'owner') return { ok: false, error: 'invalid', message: OWNER_CANNOT_DELETE };
  const erased = await repo.eraseMemberSpace(viewer.space.id, viewer.profile.id);
  await Promise.all([removeFiles(files.site, erased.files.site), removeFiles(files.community, erased.files.community)]);
  if (erased.lastSpace) await repo.deleteAccount(viewer.profile.id);
  return { ok: true, accountDeleted: erased.lastSpace };
}
