import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { DEFAULT_BRAND } from '@/tokens/resolveBrand';
import {
  programTheme,
  saveBranding,
  saveBrandMarks,
  saveProgramTheme,
  spaceMarks,
  spaceTheme,
  studioBranding,
} from './branding';

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

describe('brand marks (logo + favicon)', () => {
  const LOGO = `${SEED_IDS.alexander}/site/a-logo.png`;
  const ICON = `${SEED_IDS.alexander}/site/b-icon.png`;

  it('are empty with no row', async () => {
    expect(await spaceMarks(repo, SEED_IDS.alexander)).toEqual({ logoPath: null, faviconPath: null });
  });

  it('save for branding.manage and keep colours + fonts', async () => {
    const owner = await as(SEED_IDS.alexanderOwner);
    await saveBranding(repo, owner, { colors: RED, fontHeading: 'lora', fontBody: null });
    expect(await saveBrandMarks(repo, owner, { logoPath: LOGO, faviconPath: ICON })).toEqual({ ok: true });
    expect(await spaceMarks(repo, SEED_IDS.alexander)).toEqual({ logoPath: LOGO, faviconPath: ICON });
    expect(await spaceTheme(repo, SEED_IDS.alexander)).toEqual({ colors: RED, fontHeading: 'lora', fontBody: null });
  });

  it('survive a later colour save', async () => {
    const owner = await as(SEED_IDS.alexanderOwner);
    await saveBrandMarks(repo, owner, { logoPath: LOGO, faviconPath: null });
    await saveBranding(repo, owner, { colors: RED, fontHeading: null, fontBody: null });
    expect(await spaceMarks(repo, SEED_IDS.alexander)).toEqual({ logoPath: LOGO, faviconPath: null });
  });

  it('forbid staff without branding.manage', async () => {
    const r = await saveBrandMarks(repo, await as(SEED_IDS.assistant), { logoPath: LOGO, faviconPath: null });
    expect(r).toEqual({ ok: false, error: 'forbidden' });
  });

  it('refuse a path outside the space site folder', async () => {
    const owner = await as(SEED_IDS.alexanderOwner);
    const other = `${SEED_IDS.natasha}/site/a-logo.png`;
    expect(await saveBrandMarks(repo, owner, { logoPath: other, faviconPath: null })).toMatchObject({ error: 'invalid' });
    expect(await saveBrandMarks(repo, owner, { logoPath: null, faviconPath: 7 })).toMatchObject({ error: 'invalid' });
    expect(await repo.branding(SEED_IDS.alexander)).toBeNull();
  });
});
