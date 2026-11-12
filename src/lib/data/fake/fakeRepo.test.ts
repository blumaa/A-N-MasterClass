import { beforeEach, describe, expect, it } from 'vitest';
import { createFakeRepo, type FakeRepo } from './fakeRepo';
import { emptyDb } from './db';
import { ConstraintError } from '../errors';

const NOW = new Date('2026-11-10T12:00:00Z');

let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(emptyDb());
  repo.db.spaces.push(
    { id: 's1', slug: 'alexander', name: 'Alexander', status: 'live', locale: 'en', isTest: false },
    { id: 's2', slug: 'natasha', name: 'Natasha', status: 'live', locale: 'en', isTest: false },
  );
  repo.db.profiles.push({ id: 'u1', email: 'u1@test', isPlatformAdmin: false });
});

async function program(spaceId = 's1', slug = 'shibari-101') {
  return repo.createProduct({ spaceId, kind: 'program', slug, title: 'Shibari 101' });
}

describe('products', () => {
  it('scopes by space and starts as draft', async () => {
    await program('s1');
    await program('s2');
    const list = await repo.products('s1');
    expect(list).toHaveLength(1);
    expect(list[0]?.status).toBe('draft');
  });

  it('refuses a duplicate slug inside one space (unique space_id, slug)', async () => {
    await program('s1');
    await expect(program('s1')).rejects.toThrow(/slug/);
  });

  it('refuses an invalid slug (same check as SQL)', async () => {
    await expect(program('s1', 'Bad Slug')).rejects.toThrow(/slug/);
  });
});

describe('tree', () => {
  it('appends modules, steps and parts at the end', async () => {
    const p = await program();
    const a = await repo.createModule({ programId: p.id, title: 'A' });
    const b = await repo.createModule({ programId: p.id, title: 'B' });
    expect((await repo.modules(p.id)).map((m) => m.id)).toEqual([a.id, b.id]);
  });

  it('moves a step up and down among its siblings only', async () => {
    const p = await program();
    const m1 = await repo.createModule({ programId: p.id, title: 'M1' });
    const m2 = await repo.createModule({ programId: p.id, title: 'M2' });
    const s1 = await repo.createStep({ moduleId: m1.id, title: 'one' });
    const s2 = await repo.createStep({ moduleId: m1.id, title: 'two' });
    await repo.createStep({ moduleId: m2.id, title: 'other' });

    await repo.move('steps', s2.id, 'up');
    expect((await repo.steps([m1.id])).map((s) => s.title)).toEqual(['two', 'one']);

    await repo.move('steps', s2.id, 'up'); // already first: no-op
    expect((await repo.steps([m1.id])).map((s) => s.title)).toEqual(['two', 'one']);

    await repo.move('steps', s1.id, 'up');
    expect((await repo.steps([m1.id])).map((s) => s.title)).toEqual(['one', 'two']);
  });

  it('cascades a module delete to steps, parts and progress', async () => {
    const p = await program();
    const m = await repo.createModule({ programId: p.id, title: 'M' });
    const s = await repo.createStep({ moduleId: m.id, title: 'S' });
    await repo.createPart({ stepId: s.id, kind: 'text' });
    await repo.setStepComplete('u1', s.id, true);

    await repo.deleteModule(m.id);

    expect(repo.db.steps).toHaveLength(0);
    expect(repo.db.parts).toHaveLength(0);
    expect(repo.db.stepProgress).toHaveLength(0);
  });

  it('clears unlock_after_step_id when that step goes (on delete set null)', async () => {
    const p = await program();
    const m1 = await repo.createModule({ programId: p.id, title: 'M1' });
    const s = await repo.createStep({ moduleId: m1.id, title: 'gate' });
    const m2 = await repo.createModule({ programId: p.id, title: 'M2' });
    await repo.updateModule(m2.id, { unlockAfterStepId: s.id });

    await repo.deleteStep(s.id);

    expect((await repo.module(m2.id))?.unlockAfterStepId).toBeNull();
  });

  it('refuses a non-numeric vimeo id (parts check)', async () => {
    const p = await program();
    const m = await repo.createModule({ programId: p.id, title: 'M' });
    const s = await repo.createStep({ moduleId: m.id, title: 'S' });
    const part = await repo.createPart({ stepId: s.id, kind: 'video' });
    await expect(repo.updatePart(part.id, { vimeoId: 'abc' })).rejects.toThrow(/vimeo/);
  });

  it('replaces a part on update (rows read earlier keep their values) and checks file size', async () => {
    const p = await program();
    const m = await repo.createModule({ programId: p.id, title: 'M' });
    const s = await repo.createStep({ moduleId: m.id, title: 'S' });
    const part = await repo.createPart({ stepId: s.id, kind: 'download' });
    expect(part).toMatchObject({ filePath: null, fileSize: null });
    const updated = await repo.updatePart(part.id, { filePath: 'a.pdf', fileSize: 3 });
    expect(updated).toMatchObject({ filePath: 'a.pdf', fileSize: 3 });
    expect(part.filePath).toBeNull();
    await expect(repo.updatePart(part.id, { fileSize: -1 })).rejects.toThrow(/file size/);
  });
});

describe('grants', () => {
  it('keeps one active grant per product + profile', async () => {
    const p = await program();
    await repo.createGrant({ productId: p.id, profileId: 'u1', source: 'manual' });
    await expect(repo.createGrant({ productId: p.id, profileId: 'u1', source: 'free' })).rejects.toThrow(/grant/);
  });

  it('keys community grants by access group too; the group must be the product\'s', async () => {
    const circle = await repo.createProduct({ spaceId: 's1', kind: 'community', slug: 'circle', title: 'Circle' });
    const other = await repo.createProduct({ spaceId: 's1', kind: 'community', slug: 'other', title: 'Other' });
    const vip = await repo.createAccessGroup({ communityId: circle.id, title: 'VIP' });
    const [otherDefault] = await repo.accessGroups(other.id);
    await repo.createGrant({ productId: circle.id, profileId: 'u1', source: 'manual' });
    const g = await repo.createGrant({ productId: circle.id, profileId: 'u1', source: 'manual', accessGroupId: vip.id });
    expect(g.accessGroupId).toBe(vip.id);
    await expect(repo.createGrant({ productId: circle.id, profileId: 'u1', source: 'free', accessGroupId: vip.id })).rejects.toThrow(/grant/);
    await expect(
      repo.createGrant({ productId: circle.id, profileId: 'u2', source: 'free', accessGroupId: otherDefault!.id }),
    ).rejects.toThrow(/group/);
  });

  it('gives every new community one default access group', async () => {
    const circle = await repo.createProduct({ spaceId: 's1', kind: 'community', slug: 'circle', title: 'Circle' });
    expect(await repo.accessGroups(circle.id)).toEqual([
      expect.objectContaining({ communityId: circle.id, title: 'Members', isDefault: true, directory: true, dms: true }),
    ]);
    expect(await repo.accessGroups((await program()).id)).toEqual([]);
  });

  it('ignores revoked and expired grants', async () => {
    const p = await program();
    const g = await repo.createGrant({ productId: p.id, profileId: 'u1', source: 'manual' });
    expect(await repo.activeGrant(p.id, 'u1', NOW)).not.toBeNull();

    await repo.revokeGrant(g.id);
    expect(await repo.activeGrant(p.id, 'u1', NOW)).toBeNull();

    const again = await repo.createGrant({ productId: p.id, profileId: 'u1', source: 'manual' });
    const row = repo.db.grants.find((x) => x.id === again.id)!;
    row.expiresAt = new Date(NOW.getTime() - 1);
    expect(await repo.activeGrant(p.id, 'u1', NOW)).toBeNull();
  });

  it('lists a profile’s grants inside one space only', async () => {
    const a = await program('s1');
    const b = await program('s2');
    await repo.createGrant({ productId: a.id, profileId: 'u1', source: 'manual' });
    await repo.createGrant({ productId: b.id, profileId: 'u1', source: 'manual' });
    expect((await repo.grants('s1', 'u1', NOW)).map((g) => g.productId)).toEqual([a.id]);
  });
});

describe('progress', () => {
  it('ticks once and un-ticks', async () => {
    await repo.setStepComplete('u1', 'st', true);
    await repo.setStepComplete('u1', 'st', true);
    expect(repo.db.stepProgress).toHaveLength(1);
    expect(await repo.completedStepIds('u1', ['st', 'x'])).toEqual(new Set(['st']));

    await repo.setStepComplete('u1', 'st', false);
    expect(await repo.completedStepIds('u1', ['st'])).toEqual(new Set());
  });
});

describe('branding', () => {
  it('has no row until saved, then upserts one row per space', async () => {
    expect(await repo.branding('s1')).toBeNull();
    await repo.saveBranding({ spaceId: 's1', colors: null, fontHeading: 'lora', fontBody: null });
    await repo.saveBranding({ spaceId: 's1', colors: null, fontHeading: null, fontBody: 'inter' });
    expect(repo.db.branding).toHaveLength(1);
    expect((await repo.branding('s1'))?.fontBody).toBe('inter');
    expect(await repo.branding('s2')).toBeNull();
  });

  it('refuses a branding row for a missing space (fk)', async () => {
    await expect(repo.saveBranding({ spaceId: 'nope', colors: null, fontHeading: null, fontBody: null })).rejects.toThrow();
  });

  it('stores a product theme override', async () => {
    const p = await program();
    expect(p.themeOverride).toBeNull();
    const colors = { accent: '#000000', 'accent-soft': '#000000', page: '#ffffff', card: '#ffffff', hairline: '#eeeeee', mid: '#888888', ink: '#000000' };
    expect((await repo.updateProduct(p.id, { themeOverride: colors })).themeOverride).toEqual(colors);
  });
});

describe('custom domains', () => {
  it('maps a host to its space slug, case-insensitive; unknown host = null', async () => {
    repo.db.spaceDomains.push({ host: 'alexander.example', spaceId: 's1', isPrimary: true });
    expect(await repo.spaceSlugByHost('alexander.example')).toBe('alexander');
    expect(await repo.spaceSlugByHost('Alexander.Example')).toBe('alexander');
    expect(await repo.spaceSlugByHost('nobody.example')).toBeNull();
  });
});

describe('platform tenancy', () => {
  it('lists all spaces by name', async () => {
    expect((await repo.spaces()).map((s) => s.slug)).toEqual(['alexander', 'natasha']);
  });

  it('creates a draft space and refuses a bad, reserved or duplicate slug', async () => {
    const s = await repo.createSpace({ slug: 'fiddle', name: 'Fiddle', isTest: true });
    expect(s).toMatchObject({ slug: 'fiddle', name: 'Fiddle', status: 'draft', locale: 'en', isTest: true });
    expect((await repo.spaceBySlug('fiddle'))?.id).toBe(s.id);
    await expect(repo.createSpace({ slug: 'fiddle', name: 'Again', isTest: false })).rejects.toThrow(/slug/);
    await expect(repo.createSpace({ slug: 'Bad Slug', name: 'X', isTest: false })).rejects.toThrow(/slug/);
    await expect(repo.createSpace({ slug: 'platform', name: 'X', isTest: false })).rejects.toThrow(/reserved/);
  });

  it('updates status and name', async () => {
    const s = await repo.updateSpace('s1', { status: 'archived' });
    expect(s).toMatchObject({ status: 'archived', name: 'Alexander' });
    expect((await repo.updateSpace('s1', { name: 'Alex' })).name).toBe('Alex');
  });

  it('adds a member once', async () => {
    await repo.addMember({ spaceId: 's1', profileId: 'u1', role: 'owner' });
    expect(await repo.member('s1', 'u1')).toEqual({ spaceId: 's1', profileId: 'u1', role: 'owner' });
    await expect(repo.addMember({ spaceId: 's1', profileId: 'u1', role: 'admin' })).rejects.toBeInstanceOf(ConstraintError);
  });

  it('attaches a host lowercased, refuses a taken host, removes it', async () => {
    await repo.addSpaceDomain({ host: 'Fiddle.Example', spaceId: 's1', isPrimary: true });
    expect(await repo.spaceDomains('s1')).toEqual([{ host: 'fiddle.example', spaceId: 's1', isPrimary: true }]);
    expect(await repo.spaceSlugByHost('fiddle.example')).toBe('alexander');
    await expect(repo.addSpaceDomain({ host: 'fiddle.example', spaceId: 's2', isPrimary: false })).rejects.toBeInstanceOf(ConstraintError);
    await repo.removeSpaceDomain('FIDDLE.example');
    expect(await repo.spaceDomains('s1')).toEqual([]);
  });
});
