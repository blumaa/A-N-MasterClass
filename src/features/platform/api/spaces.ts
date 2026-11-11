// Platform admin DAL (G1): spaces, their owners and domains. The caller checks the platform admin
// flag; RLS (is_platform_admin) checks it again.
import { newClaimToken } from '@/lib/auth/claimToken';
import type { CommandFailure } from '@/lib/data/commandResult';
import { ConstraintError, HOST_TAKEN, ONE_PRIMARY_DOMAIN, SLUG_RESERVED } from '@/lib/data/errors';
import type { Repo } from '@/lib/data/repo';
import type { Space, SpaceDomain } from '@/lib/data/types';
import type { NewSpaceInput, PlatformCommand } from '../forms';

/** slug: the space the command touched. claimToken: a fresh owner claim link token (create, ownerClaim). */
export type PlatformResult = { ok: true; slug?: string; claimToken?: string } | CommandFailure;

export type PlatformSpaceDetail = { space: Space; domains: SpaceDomain[]; owners: { email: string; displayName: string }[] };

const MESSAGES: Record<string, string> = {
  'slug taken': 'That address is already taken.',
  [SLUG_RESERVED]: 'That address is reserved.',
  [HOST_TAKEN]: 'That domain is already attached to a space.',
  [ONE_PRIMARY_DOMAIN]: 'This space already has a primary domain. Remove it first.',
};

const NOT_FOUND: PlatformResult = { ok: false, error: 'not_found' };

/** Constraint errors become a user-facing invalid result; anything else propagates. */
async function guarded(run: () => Promise<PlatformResult>): Promise<PlatformResult> {
  try {
    return await run();
  } catch (err) {
    if (err instanceof ConstraintError) return { ok: false, error: 'invalid', message: MESSAGES[err.message] ?? err.message };
    throw err;
  }
}

async function ownerClaim(repo: Repo, spaceId: string, profileId: string, now: Date): Promise<string> {
  const claim = newClaimToken(now);
  await repo.createClaimToken({ tokenHash: claim.hash, spaceId, profileId, expiresAt: claim.expiresAt, usedAt: null });
  return claim.token;
}

/** New draft space with its owner (existing account reused) and a claim link for the owner. */
async function createSpaceWithOwner(repo: Repo, input: NewSpaceInput, now: Date): Promise<PlatformResult> {
  const space = await repo.createSpace({ slug: input.slug, name: input.name, isTest: input.isTest });
  const owner = (await repo.profileByEmail(input.ownerEmail)) ?? (await repo.createProfile(input.ownerEmail));
  await repo.addMember({ spaceId: space.id, profileId: owner.id, role: 'owner' });
  await repo.ensureSpaceProfile({ spaceId: space.id, profileId: owner.id, displayName: input.ownerName });
  return { ok: true, slug: space.slug, claimToken: await ownerClaim(repo, space.id, owner.id, now) };
}

async function firstOwnerClaim(repo: Repo, space: Space, now: Date): Promise<PlatformResult> {
  const owner = (await repo.members(space.id)).find((m) => m.role === 'owner');
  if (!owner) return NOT_FOUND;
  return { ok: true, slug: space.slug, claimToken: await ownerClaim(repo, space.id, owner.profileId, now) };
}

async function removeDomain(repo: Repo, space: Space, host: string): Promise<PlatformResult> {
  const own = (await repo.spaceDomains(space.id)).some((d) => d.host === host);
  if (!own) return NOT_FOUND;
  await repo.removeSpaceDomain(host);
  return { ok: true, slug: space.slug };
}

type SpaceCommand = Exclude<PlatformCommand, { op: 'create' }>;

async function runOnSpace(repo: Repo, space: Space, command: SpaceCommand, now: Date): Promise<PlatformResult> {
  switch (command.op) {
    case 'setStatus':
      await repo.updateSpace(space.id, { status: command.status });
      return { ok: true, slug: space.slug };
    case 'addDomain':
      await repo.addSpaceDomain({ host: command.host, spaceId: space.id, isPrimary: command.isPrimary });
      return { ok: true, slug: space.slug };
    case 'removeDomain':
      return removeDomain(repo, space, command.host);
    case 'ownerClaim':
      return firstOwnerClaim(repo, space, now);
  }
}

export function runPlatformCommand(repo: Repo, command: PlatformCommand, now: Date): Promise<PlatformResult> {
  return guarded(async () => {
    if (command.op === 'create') return createSpaceWithOwner(repo, command, now);
    const space = await repo.spaceBySlug(command.slug);
    return space ? runOnSpace(repo, space, command, now) : NOT_FOUND;
  });
}

export const platformSpaces = (repo: Repo): Promise<Space[]> => repo.spaces();

export async function platformSpace(repo: Repo, slug: string): Promise<PlatformSpaceDetail | null> {
  const space = await repo.spaceBySlug(slug);
  if (!space) return null;
  const [domains, members, profiles] = await Promise.all([repo.spaceDomains(space.id), repo.members(space.id), repo.spaceProfiles(space.id)]);
  const names = new Map(profiles.map((p) => [p.profileId, p.displayName]));
  const owners = await Promise.all(
    members
      .filter((m) => m.role === 'owner')
      .map(async (m) => ({ email: (await repo.profile(m.profileId))?.email ?? '', displayName: names.get(m.profileId) ?? '' })),
  );
  return { space, domains, owners };
}
