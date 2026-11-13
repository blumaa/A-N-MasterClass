import { beforeEach, describe, expect, it } from 'vitest';
import { CERTIFICATE_NEEDS_NAME, CERTIFICATE_NOT_EARNED, CERTIFICATES_OFF, CERTIFICATES_PROGRAM_ONLY } from '../errors';
import type { Db } from './db';
import { createFakeRepo, type FakeRepo } from './fakeRepo';
import { SEED_IDS, seedDb } from './seed';

const SEED_STEPS = ['step-intro', 'step-safety', 'step-single-column', 'step-double-column', 'step-week2', 'step-replay'];

let db: Db;
let repo: FakeRepo;
beforeEach(() => {
  db = seedDb(new Date('2026-11-12T12:00:00Z'));
  repo = createFakeRepo(db);
});

const finishAll = async () => {
  for (const s of SEED_STEPS) await repo.setStepComplete(SEED_IDS.student, s, true);
};

describe('certificates', () => {
  it('refuses while the program has certificates off', async () => {
    await finishAll();
    await expect(repo.issueCertificate(SEED_IDS.program, SEED_IDS.student)).rejects.toThrow(CERTIFICATES_OFF);
  });

  it('needs every published step in a published module done', async () => {
    await repo.updateProduct(SEED_IDS.program, { certificates: true });
    await repo.setStepComplete(SEED_IDS.student, 'step-intro', true);
    await expect(repo.issueCertificate(SEED_IDS.program, SEED_IDS.student)).rejects.toThrow(CERTIFICATE_NOT_EARNED);
    await finishAll();
    const draft = await repo.createStep({ moduleId: 'mod-welcome', title: 'Draft step' });
    await repo.updateModule('mod-live', { status: 'draft' });
    await repo.setStepComplete(SEED_IDS.student, 'step-replay', false);
    expect(draft.status).toBe('draft');
    const cert = await repo.issueCertificate(SEED_IDS.program, SEED_IDS.student);
    expect(cert).toMatchObject({ programId: SEED_IDS.program, profileId: SEED_IDS.student });
    expect(await repo.issueCertificate(SEED_IDS.program, SEED_IDS.student)).toEqual(cert);
  });

  it('needs an active grant', async () => {
    await repo.updateProduct(SEED_IDS.program, { certificates: true });
    await expect(repo.issueCertificate(SEED_IDS.program, SEED_IDS.assistant)).rejects.toThrow('program not open');
  });

  it('only programs take the toggle', async () => {
    await expect(repo.updateProduct(SEED_IDS.community, { certificates: true })).rejects.toThrow(CERTIFICATES_PROGRAM_ONLY);
  });

  it('reads the member own certificate, null before it is issued', async () => {
    await repo.updateProduct(SEED_IDS.program, { certificates: true });
    expect(await repo.certificate(SEED_IDS.program, SEED_IDS.student)).toBeNull();
    await finishAll();
    const cert = await repo.issueCertificate(SEED_IDS.program, SEED_IDS.student);
    expect(cert.shareToken).toBeNull();
    expect(await repo.certificate(SEED_IDS.program, SEED_IDS.student)).toEqual(cert);
  });
});

describe('certificate share links', () => {
  const ALEXANDER = SEED_IDS.alexander;
  const shareOn = async () => {
    await repo.updateProduct(SEED_IDS.program, { certificates: true });
    await finishAll();
    await repo.issueCertificate(SEED_IDS.program, SEED_IDS.student);
    return (await repo.setCertificateSharing(SEED_IDS.program, SEED_IDS.student, true)).shareToken!;
  };

  it('needs an issued certificate', async () => {
    await expect(repo.setCertificateSharing(SEED_IDS.program, SEED_IDS.student, true)).rejects.toThrow('certificate not found');
  });

  it('gives a 32-hex token, kept when shared again, read publicly with the minimum fields', async () => {
    const token = await shareOn();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect((await repo.setCertificateSharing(SEED_IDS.program, SEED_IDS.student, true)).shareToken).toBe(token);
    const cert = (await repo.certificate(SEED_IDS.program, SEED_IDS.student))!;
    expect(await repo.sharedCertificate(ALEXANDER, token)).toEqual({
      memberName: 'Robin (student)',
      programTitle: (await repo.product(SEED_IDS.program))!.title,
      issuedAt: cert.issuedAt,
      serial: cert.id,
    });
    expect(await repo.sharedCertificate(SEED_IDS.natasha, token)).toBeNull();
    expect(await repo.sharedCertificate(ALEXANDER, '0'.repeat(32))).toBeNull();
  });

  it('stop sharing kills the link; sharing again makes a new one', async () => {
    const token = await shareOn();
    expect((await repo.setCertificateSharing(SEED_IDS.program, SEED_IDS.student, false)).shareToken).toBeNull();
    expect(await repo.sharedCertificate(ALEXANDER, token)).toBeNull();
    const next = (await repo.setCertificateSharing(SEED_IDS.program, SEED_IDS.student, true)).shareToken;
    expect(next).not.toBe(token);
  });

  it('certificates turned off hide shared links', async () => {
    const token = await shareOn();
    await repo.updateProduct(SEED_IDS.program, { certificates: false });
    expect(await repo.sharedCertificate(ALEXANDER, token)).toBeNull();
    await expect(repo.setCertificateSharing(SEED_IDS.program, SEED_IDS.student, true)).rejects.toThrow(CERTIFICATES_OFF);
  });

  it('needs a space display name to share', async () => {
    await repo.updateProduct(SEED_IDS.program, { certificates: true });
    await finishAll();
    await repo.issueCertificate(SEED_IDS.program, SEED_IDS.student);
    db.spaceProfiles = db.spaceProfiles.filter((p) => !(p.spaceId === ALEXANDER && p.profileId === SEED_IDS.student));
    await expect(repo.setCertificateSharing(SEED_IDS.program, SEED_IDS.student, true)).rejects.toThrow(CERTIFICATE_NEEDS_NAME);
    expect((await repo.setCertificateSharing(SEED_IDS.program, SEED_IDS.student, false)).shareToken).toBeNull();
  });
});

