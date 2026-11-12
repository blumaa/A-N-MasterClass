// Member profile per space (G2): display name, bio, avatar. Every signed-in viewer edits their own.
import type { Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import type { Repo } from '@/lib/data/repo';
import type { SpaceProfile } from '@/lib/data/types';
import { isAvatarPath } from '@/lib/storage/siteImages';
import { BIO_MAX, NAME_MAX } from './limits';


export type ProfileInput = { displayName: string; bio: string | null; avatarPath: string | null };

const invalid = (message: string) => ({ ok: false as const, error: 'invalid' as const, message });

export async function myProfile(repo: Repo, viewer: Viewer): Promise<SpaceProfile | null> {
  if (!viewer.profile) return null;
  const rows = await repo.spaceProfiles(viewer.space.id);
  const profileId = viewer.profile.id;
  return (
    rows.find((r) => r.profileId === profileId) ?? {
      spaceId: viewer.space.id,
      profileId,
      displayName: viewer.displayName,
      avatarPath: null,
      bio: null,
    }
  );
}

export async function saveMyProfile(repo: Repo, viewer: Viewer, input: ProfileInput): Promise<CommandResult> {
  if (!viewer.profile) return { ok: false, error: 'forbidden' };
  const spaceId = viewer.space.id;
  const profileId = viewer.profile.id;
  const displayName = input.displayName.trim();
  const bio = input.bio?.trim() || null;
  if (!displayName) return invalid('Enter a name.');
  if (displayName.length > NAME_MAX) return invalid(`Name must be ${NAME_MAX} characters or fewer.`);
  if (bio && bio.length > BIO_MAX) return invalid(`Bio must be ${BIO_MAX} characters or fewer.`);
  if (input.avatarPath && !isAvatarPath(input.avatarPath, spaceId, profileId)) return invalid('Upload the image again.');
  await repo.ensureSpaceProfile({ spaceId, profileId, displayName });
  await repo.saveSpaceProfile({ spaceId, profileId, displayName, bio, avatarPath: input.avatarPath });
  return { ok: true };
}
