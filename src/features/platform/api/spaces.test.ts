import { beforeEach, describe, expect, it } from 'vitest';
import { hashClaimToken } from '@/lib/auth/claimToken';
import { emptyDb } from '@/lib/data/fake/db';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import type { NewSpaceInput } from '../forms';
import { platformSpace, platformSpaces, runPlatformCommand } from './spaces';

const NOW = new Date('2026-11-11T12:00:00Z');
const INPUT: NewSpaceInput = { name: 'Old-Time Fiddle', slug: 'fiddle', ownerEmail: 'ana@example.com', ownerName: 'Ana', isTest: true };

let repo: FakeRepo;
beforeEach(() => {
  repo = createFakeRepo(emptyDb());
});

const create = (input: Partial<NewSpaceInput> = {}) => runPlatformCommand(repo, { op: 'create', ...INPUT, ...input }, NOW);

async function created() {
  const result = await create();
  if (!result.ok) throw new Error('create failed');
  return result;
}

describe('create', () => {
  it('creates a draft space, a new owner account, the owner member and profile, and a claim link', async () => {
    const result = await created();
    const space = (await repo.spaceBySlug('fiddle'))!;
    expect(space).toMatchObject({ name: 'Old-Time Fiddle', status: 'draft', isTest: true });
    expect(result).toMatchObject({ ok: true, slug: 'fiddle' });

    const owner = (await repo.profileByEmail('ana@example.com'))!;
    expect(await repo.member(space.id, owner.id)).toEqual({ spaceId: space.id, profileId: owner.id, role: 'owner' });
    expect(await repo.spaceProfiles(space.id)).toEqual([{ spaceId: space.id, profileId: owner.id, displayName: 'Ana', avatarPath: null, bio: null }]);
    expect(await repo.consumeClaimToken(space.id, hashClaimToken(result.claimToken!), NOW)).toMatchObject({ profileId: owner.id });
  });

  it('reuses an existing account for the owner', async () => {
    const existing = await repo.createProfile('ana@example.com');
    await created();
    const space = (await repo.spaceBySlug('fiddle'))!;
    expect(await repo.member(space.id, existing.id)).toMatchObject({ role: 'owner' });
  });

  it('reports a taken or reserved slug as invalid', async () => {
    await created();
    expect(await create({ name: 'Again' })).toEqual({ ok: false, error: 'invalid', message: 'That address is already taken.' });
    expect(await create({ slug: 'www' })).toMatchObject({ ok: false, error: 'invalid' });
  });
});

describe('space commands', () => {
  it('changes the status', async () => {
    await created();
    expect(await runPlatformCommand(repo, { op: 'setStatus', slug: 'fiddle', status: 'live' }, NOW)).toMatchObject({ ok: true });
    expect((await repo.spaceBySlug('fiddle'))!.status).toBe('live');
  });

  it('attaches and detaches a domain; a taken host is invalid; a host of another space is not found', async () => {
    await created();
    const space = (await repo.spaceBySlug('fiddle'))!;
    const add = { op: 'addDomain' as const, slug: 'fiddle', host: 'fiddle.example.com', isPrimary: true };
    expect(await runPlatformCommand(repo, add, NOW)).toMatchObject({ ok: true });
    expect(await runPlatformCommand(repo, add, NOW)).toEqual({ ok: false, error: 'invalid', message: 'That domain is already attached to a space.' });

    await repo.createSpace({ slug: 'other', name: 'Other', isTest: true });
    expect(await runPlatformCommand(repo, { op: 'removeDomain', slug: 'other', host: 'fiddle.example.com' }, NOW)).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await runPlatformCommand(repo, { op: 'removeDomain', slug: 'fiddle', host: 'fiddle.example.com' }, NOW)).toMatchObject({ ok: true });
    expect(await runPlatformCommand(repo, { op: 'setStatus', slug: 'nope', status: 'live' }, NOW)).toEqual({ ok: false, error: 'not_found' });
    expect(await repo.spaceDomains(space.id)).toEqual([]);
  });

  it('issues a fresh owner claim link; none when the space has no owner', async () => {
    await created();
    const space = (await repo.spaceBySlug('fiddle'))!;
    const owner = (await repo.profileByEmail('ana@example.com'))!;
    const result = await runPlatformCommand(repo, { op: 'ownerClaim', slug: 'fiddle' }, NOW);
    expect(result).toMatchObject({ ok: true, slug: 'fiddle' });
    expect(result.ok && (await repo.consumeClaimToken(space.id, hashClaimToken(result.claimToken!), NOW))?.profileId).toBe(owner.id);

    await repo.createSpace({ slug: 'empty', name: 'Empty', isTest: true });
    expect(await runPlatformCommand(repo, { op: 'ownerClaim', slug: 'empty' }, NOW)).toEqual({ ok: false, error: 'not_found' });
  });
});

describe('queries', () => {
  it('lists spaces and shows one with its domains and owners', async () => {
    await created();
    const space = (await repo.spaceBySlug('fiddle'))!;
    await repo.addSpaceDomain({ host: 'fiddle.example.com', spaceId: space.id, isPrimary: true });
    expect((await platformSpaces(repo)).map((s) => s.slug)).toEqual(['fiddle']);
    expect(await platformSpace(repo, 'fiddle')).toEqual({
      space,
      domains: [{ host: 'fiddle.example.com', spaceId: space.id, isPrimary: true }],
      owners: [{ email: 'ana@example.com', displayName: 'Ana' }],
    });
    expect(await platformSpace(repo, 'nope')).toBeNull();
  });
});
