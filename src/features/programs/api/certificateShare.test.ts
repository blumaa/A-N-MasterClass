import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { CERTIFICATE_NEEDS_NAME } from '@/lib/data/errors';
import type { Db } from '@/lib/data/fake/db';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { programOutline } from './outline';
import { certificateShareToken, shareCertificate, sharedCertificate } from './certificateShare';

const NOW = new Date('2026-11-10T12:00:00Z');
const ALL_STEPS = ['step-intro', 'step-safety', 'step-single-column', 'step-double-column', 'step-week2', 'step-replay'];
const SLUG = 'shibari-101';
let db: Db;
let repo: FakeRepo;

beforeEach(async () => {
  db = seedDb(NOW);
  repo = createFakeRepo(db);
  await repo.updateProduct(SEED_IDS.program, { certificates: true });
});

const as = async (profileId: string | null): Promise<Viewer> => (await resolveViewer(repo, 'alexander', profileId))!;
const finish = async () => {
  for (const s of ALL_STEPS) await repo.setStepComplete(SEED_IDS.student, s, true);
};
const tokenOf = async () =>
  certificateShareToken(repo, await as(SEED_IDS.student), (await programOutline(repo, await as(SEED_IDS.student), SLUG, NOW))!);

describe('shareCertificate', () => {
  it('refuses visitors and members who have not earned it', async () => {
    expect(await shareCertificate(repo, await as(null), SLUG, true, NOW)).toEqual({ ok: false, error: 'forbidden' });
    expect(await shareCertificate(repo, await as(SEED_IDS.student), SLUG, true, NOW)).toEqual({ ok: false, error: 'not_found' });
    expect(await shareCertificate(repo, await as(SEED_IDS.student), 'nope', true, NOW)).toEqual({ ok: false, error: 'not_found' });
  });

  it('issues the certificate if needed, then turns the link on and off', async () => {
    await finish();
    expect(await tokenOf()).toBeNull();
    expect(await shareCertificate(repo, await as(SEED_IDS.student), SLUG, true, NOW)).toEqual({ ok: true });
    const token = await tokenOf();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(await sharedCertificate(repo, SEED_IDS.alexander, token!)).toMatchObject({ memberName: 'Robin (student)' });
    expect(await shareCertificate(repo, await as(SEED_IDS.student), SLUG, false, NOW)).toEqual({ ok: true });
    expect(await tokenOf()).toBeNull();
    expect(await sharedCertificate(repo, SEED_IDS.alexander, token!)).toBeNull();
  });

  it('maps a missing display name to a message', async () => {
    await finish();
    db.spaceProfiles = db.spaceProfiles.filter((p) => !(p.spaceId === SEED_IDS.alexander && p.profileId === SEED_IDS.student));
    expect(await shareCertificate(repo, await as(SEED_IDS.student), SLUG, true, NOW)).toEqual({
      ok: false,
      error: 'invalid',
      message: CERTIFICATE_NEEDS_NAME,
    });
  });
});

describe('sharedCertificate', () => {
  it('reads nothing for a malformed token without asking the repo', async () => {
    const spy = { ...repo, sharedCertificate: () => Promise.reject(new Error('should not be called')) };
    expect(await sharedCertificate(spy, SEED_IDS.alexander, 'not-a-token')).toBeNull();
    expect(await sharedCertificate(spy, SEED_IDS.alexander, 'A'.repeat(32))).toBeNull();
  });
});
