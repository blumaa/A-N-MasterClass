// Core Supabase repo against the linked project. Runs as the service client: RLS itself is covered
// by the SQL suites (supabase/tests); this checks queries, mapping and constraint mapping.
// Everything lives in one is_test space + auth users that afterAll deletes.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ConstraintError, FILE_OUTSIDE_FOLDER } from '@/lib/data/errors';
import { FONT_IDS } from '@/lib/fonts/catalog';
import { DEFAULT_BRAND } from '@/tokens/resolveBrand';
import { adminClient } from '../admin';
import { createCoreRepo, type CoreRepo } from './core';

const enabled = Boolean(process.env.SUPABASE_SECRET_KEY);
const run = Date.now().toString(36);
const NOW = new Date();

describe.skipIf(!enabled)('core repo (Supabase contract)', () => {
  let repo: CoreRepo;
  let spaceId: string;
  const userIds: string[] = [];
  const slug = `contract-${run}`;
  const host = `${slug}.contract.test`;
  const email = (n: string) => `contract+${run}-${n}@example.com`;

  async function newProfile(n: string) {
    const p = await repo.createProfile(email(n));
    userIds.push(p.id);
    return p;
  }

  beforeAll(async () => {
    const admin = adminClient();
    repo = createCoreRepo({ db: async () => admin, admin: () => admin });
    const { data, error } = await admin
      .from('spaces')
      .insert({ slug, name: 'Contract', is_test: true })
      .select('id')
      .single();
    if (error) throw error;
    spaceId = data.id;
    const domain = await admin.from('space_domains').insert({ host, space_id: spaceId });
    if (domain.error) throw domain.error;
  });

  afterAll(async () => {
    const admin = adminClient();
    if (spaceId) await admin.from('spaces').delete().eq('id', spaceId);
    for (const id of userIds) await admin.auth.admin.deleteUser(id);
  });

  describe('tenancy', () => {
    it('finds the space by slug and by host (host case-insensitive)', async () => {
      expect((await repo.spaceBySlug(slug))?.id).toBe(spaceId);
      expect(await repo.spaceSlugByHost(host.toUpperCase())).toBe(slug);
      expect(await repo.spaceSlugByHost(`nope-${host}`)).toBeNull();
    });

    it('creates a profile through auth, lowercases email, refuses a duplicate', async () => {
      const p = await newProfile('A');
      expect(p.email).toBe(email('a'));
      expect((await repo.profileByEmail(email('A')))?.id).toBe(p.id);
      await expect(repo.createProfile(email('a'))).rejects.toBeInstanceOf(ConstraintError);
    });

    it('ensureSpaceProfile is idempotent and keeps the first display name', async () => {
      const p = await newProfile('sp');
      await repo.ensureSpaceProfile({ spaceId, profileId: p.id, displayName: 'First' });
      await repo.ensureSpaceProfile({ spaceId, profileId: p.id, displayName: 'Second' });
      const rows = (await repo.spaceProfiles(spaceId)).filter((r) => r.profileId === p.id);
      expect(rows).toEqual([{ spaceId, profileId: p.id, displayName: 'First', avatarPath: null, bio: null }]);
    });

    it('saves name, bio and avatar; refuses an avatar outside the member folder', async () => {
      const p = await newProfile('save');
      await repo.ensureSpaceProfile({ spaceId, profileId: p.id, displayName: 'First' });
      const row = { spaceId, profileId: p.id, displayName: 'Saved', bio: 'Hi', avatarPath: `${spaceId}/avatars/${p.id}/a-me.png` };
      expect(await repo.saveSpaceProfile(row)).toEqual(row);
      await expect(repo.saveSpaceProfile({ ...row, avatarPath: `${spaceId}/site/a.png` })).rejects.toThrow(FILE_OUTSIDE_FOLDER);
    });
  });

  describe('platform admin', () => {
    it('creates a draft space, lists it, updates it, refuses a duplicate and a reserved slug', async () => {
      const other = `${slug}-b`;
      const s = await repo.createSpace({ slug: other, name: 'Contract B', isTest: true });
      try {
        expect(s).toMatchObject({ slug: other, status: 'draft', locale: 'en', isTest: true });
        expect((await repo.spaces()).map((x) => x.id)).toContain(s.id);
        expect(await repo.updateSpace(s.id, { status: 'live' })).toMatchObject({ status: 'live', name: 'Contract B' });
        await expect(repo.createSpace({ slug: other, name: 'Again', isTest: true })).rejects.toThrow('slug taken');
        await expect(repo.createSpace({ slug: 'platform', name: 'X', isTest: true })).rejects.toThrow('slug reserved');
      } finally {
        await adminClient().from('spaces').delete().eq('id', s.id);
      }
    });

    it('adds a member once', async () => {
      const p = await newProfile('owner');
      await repo.addMember({ spaceId, profileId: p.id, role: 'owner' });
      expect(await repo.member(spaceId, p.id)).toEqual({ spaceId, profileId: p.id, role: 'owner' });
      await expect(repo.addMember({ spaceId, profileId: p.id, role: 'admin' })).rejects.toThrow('already a member');
    });

    it('attaches a host lowercased, refuses a taken host and a second primary, removes it', async () => {
      const extra = `extra.${host}`;
      await repo.addSpaceDomain({ host: extra.toUpperCase(), spaceId, isPrimary: true });
      expect(await repo.spaceDomains(spaceId)).toContainEqual({ host: extra, spaceId, isPrimary: true });
      await expect(repo.addSpaceDomain({ host: extra, spaceId, isPrimary: false })).rejects.toThrow('host taken');
      await expect(repo.addSpaceDomain({ host: `two.${host}`, spaceId, isPrimary: true })).rejects.toThrow(
        'space already has a primary domain',
      );
      await repo.removeSpaceDomain(extra);
      expect((await repo.spaceDomains(spaceId)).map((d) => d.host)).toEqual([host]);
    });
  });

  describe('branding', () => {
    it('upserts one row per space', async () => {
      const font = FONT_IDS[0]!;
      const none = { colors: null, fontHeading: null, fontBody: null, logoPath: null, faviconPath: null };
      await repo.saveBranding({ ...none, spaceId, colors: DEFAULT_BRAND, fontHeading: font });
      const logoPath = `${spaceId}/site/a-logo.png`;
      const saved = await repo.saveBranding({ ...none, spaceId, fontBody: font, logoPath });
      expect(saved).toEqual({ ...none, spaceId, fontBody: font, logoPath });
      expect(await repo.branding(spaceId)).toEqual(saved);
    });
  });

  describe('program tree', () => {
    it('creates products as drafts at the next position and refuses a duplicate slug', async () => {
      const a = await repo.createProduct({ spaceId, kind: 'program', slug: 'tree-a', title: 'A' });
      const b = await repo.createProduct({ spaceId, kind: 'program', slug: 'tree-b', title: 'B' });
      expect(a.status).toBe('draft');
      expect(b.position).toBe(a.position + 1);
      expect((await repo.productBySlug(spaceId, 'tree-a'))?.id).toBe(a.id);
      await expect(
        repo.createProduct({ spaceId, kind: 'program', slug: 'tree-a', title: 'Again' }),
      ).rejects.toBeInstanceOf(ConstraintError);
      const updated = await repo.updateProduct(a.id, { status: 'published', subtitle: 'Sub' });
      expect(updated).toMatchObject({ status: 'published', subtitle: 'Sub', title: 'A' });
    });

    it('builds modules, steps and parts in order; move swaps; checks mirror SQL', async () => {
      const prog = await repo.createProduct({ spaceId, kind: 'program', slug: 'tree-c', title: 'C' });
      const m1 = await repo.createModule({ programId: prog.id, title: 'M1' });
      const m2 = await repo.createModule({ programId: prog.id, title: 'M2' });
      expect([m1.position, m2.position]).toEqual([0, 1]);

      await repo.move('modules', m2.id, 'up');
      expect((await repo.modules(prog.id)).map((m) => m.id)).toEqual([m2.id, m1.id]);

      const releaseAt = new Date('2027-01-01T00:00:00Z');
      expect((await repo.updateModule(m1.id, { releaseAt })).releaseAt).toEqual(releaseAt);
      await expect(repo.updateModule(m1.id, { releaseAfterDays: -1 })).rejects.toBeInstanceOf(ConstraintError);

      const s1 = await repo.createStep({ moduleId: m1.id, title: 'S1' });
      const s2 = await repo.createStep({ moduleId: m2.id, title: 'S2' });
      expect((await repo.steps([m1.id, m2.id])).map((s) => s.id).sort()).toEqual([s1.id, s2.id].sort());
      expect(await repo.steps([])).toEqual([]);

      const text = await repo.createPart({ stepId: s1.id, kind: 'text' });
      const video = await repo.createPart({ stepId: s1.id, kind: 'video' });
      expect(video.position).toBe(text.position + 1);
      expect((await repo.updatePart(text.id, { text: 'Hello' })).text).toBe('Hello');
      expect((await repo.updatePart(video.id, { vimeoId: '123456' })).vimeoId).toBe('123456');
      await expect(repo.updatePart(video.id, { vimeoId: 'abc' })).rejects.toBeInstanceOf(ConstraintError);
      expect(await repo.updatePart(text.id, { filePath: 'x/y/z.pdf', fileSize: 42 })).toMatchObject({ filePath: 'x/y/z.pdf', fileSize: 42 });
      await expect(repo.updatePart(text.id, { fileSize: -1 })).rejects.toBeInstanceOf(ConstraintError);

      await repo.deletePart(video.id);
      expect((await repo.parts(s1.id)).map((p) => p.id)).toEqual([text.id]);

      await repo.deleteModule(m1.id);
      expect(await repo.step(s1.id)).toBeNull();
      expect(await repo.part(text.id)).toBeNull();
    });
  });

  describe('grants + progress', () => {
    it('grants access, lists it per space, revokes it', async () => {
      const prog = await repo.createProduct({ spaceId, kind: 'program', slug: 'grant-a', title: 'G' });
      const student = await newProfile('student');
      const g = await repo.createGrant({ productId: prog.id, profileId: student.id, source: 'manual' });
      expect(g.grantedAt).toBeInstanceOf(Date);
      expect((await repo.activeGrant(prog.id, student.id, NOW))?.id).toBe(g.id);
      expect((await repo.grants(spaceId, student.id, NOW)).map((x) => x.id)).toEqual([g.id]);
      expect((await repo.profilesInSpace(spaceId)).map((p) => p.id)).toContain(student.id);

      await repo.revokeGrant(g.id);
      expect(await repo.activeGrant(prog.id, student.id, NOW)).toBeNull();
      expect((await repo.grantsForProduct(prog.id))[0]?.status).toBe('revoked');
    });

    it('ticks and unticks a step idempotently', async () => {
      const prog = await repo.createProduct({ spaceId, kind: 'program', slug: 'progress-a', title: 'P' });
      const m = await repo.createModule({ programId: prog.id, title: 'M' });
      const s = await repo.createStep({ moduleId: m.id, title: 'S' });
      const student = await newProfile('progress');

      await repo.setStepComplete(student.id, s.id, true);
      await repo.setStepComplete(student.id, s.id, true);
      expect(await repo.completedStepIds(student.id, [s.id, randomUUID()])).toEqual(new Set([s.id]));

      await repo.setStepComplete(student.id, s.id, false);
      expect((await repo.completedStepIds(student.id, [s.id])).size).toBe(0);
    });
  });
});
