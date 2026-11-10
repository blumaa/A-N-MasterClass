import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { DEFAULT_BRAND } from '@/tokens/resolveBrand';
import { programTheme, saveBranding, saveProgramTheme, spaceTheme, studioBranding } from './branding';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (profileId: string | null, space = 'alexander'): Promise<Viewer> =>
  (await resolveViewer(repo, space, profileId))!;

const PALE_INK = { ...DEFAULT_BRAND, ink: '#cccccc' };
const RED = { ...DEFAULT_BRAND, accent: '#a01010' };

describe('spaceTheme (public read)', () => {
  it('is all defaults with no row', async () => {
    expect(await spaceTheme(repo, SEED_IDS.alexander)).toEqual({ colors: null, fontHeading: null, fontBody: null });
  });
});

describe('studioBranding', () => {
  it('is for branding.manage only (owner, admin)', async () => {
    expect(await studioBranding(repo, await as(SEED_IDS.alexanderOwner))).not.toBeNull();
    expect(await studioBranding(repo, await as(SEED_IDS.assistant))).toBeNull();
    expect(await studioBranding(repo, await as(SEED_IDS.student))).toBeNull();
  });
});

describe('saveBranding', () => {
  it('saves valid colours + fonts for an owner', async () => {
    const r = await saveBranding(repo, await as(SEED_IDS.alexanderOwner), { colors: RED, fontHeading: 'lora', fontBody: null });
    expect(r).toEqual({ ok: true });
    expect(await spaceTheme(repo, SEED_IDS.alexander)).toEqual({ colors: RED, fontHeading: 'lora', fontBody: null });
    // Other space untouched.
    expect((await spaceTheme(repo, SEED_IDS.natasha)).fontHeading).toBe('playfair-display');
  });

  it('forbids staff without branding.manage', async () => {
    const r = await saveBranding(repo, await as(SEED_IDS.assistant), { colors: RED, fontHeading: null, fontBody: null });
    expect(r).toEqual({ ok: false, error: 'forbidden' });
  });

  it('refuses a brand that fails the contrast contract', async () => {
    const r = await saveBranding(repo, await as(SEED_IDS.alexanderOwner), { colors: PALE_INK, fontHeading: null, fontBody: null });
    expect(r).toMatchObject({ ok: false, error: 'invalid' });
    expect(await repo.branding(SEED_IDS.alexander)).toBeNull();
  });

  it('refuses unknown fonts and non-hex colours', async () => {
    const owner = await as(SEED_IDS.alexanderOwner);
    expect(await saveBranding(repo, owner, { colors: null, fontHeading: 'Comic Sans', fontBody: null })).toMatchObject({
      error: 'invalid',
    });
    expect(
      await saveBranding(repo, owner, { colors: { ...DEFAULT_BRAND, ink: 'red' }, fontHeading: null, fontBody: null }),
    ).toMatchObject({ error: 'invalid' });
  });
});

describe('program theme override', () => {
  it('saves for products.edit, layered on the space fonts', async () => {
    const assistant = await as(SEED_IDS.assistant);
    expect(await saveProgramTheme(repo, assistant, SEED_IDS.program, RED)).toEqual({ ok: true });
    expect(await programTheme(repo, SEED_IDS.alexander, 'shibari-101')).toEqual(RED);
    expect(await programTheme(repo, SEED_IDS.natasha, 'shibari-101')).toBeNull();
    expect(await saveProgramTheme(repo, assistant, SEED_IDS.program, null)).toEqual({ ok: true });
    expect(await programTheme(repo, SEED_IDS.alexander, 'shibari-101')).toBeNull();
  });

  it('refuses another space’s program, students and failing contrast', async () => {
    expect(await saveProgramTheme(repo, await as(SEED_IDS.natashaOwner, 'natasha'), SEED_IDS.program, RED)).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await saveProgramTheme(repo, await as(SEED_IDS.student), SEED_IDS.program, RED)).toEqual({
      ok: false,
      error: 'forbidden',
    });
    expect(await saveProgramTheme(repo, await as(SEED_IDS.alexanderOwner), SEED_IDS.program, PALE_INK)).toMatchObject({
      error: 'invalid',
    });
  });
});
