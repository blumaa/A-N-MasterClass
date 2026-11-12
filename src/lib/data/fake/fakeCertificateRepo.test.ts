import { beforeEach, describe, expect, it } from 'vitest';
import { CERTIFICATE_NOT_EARNED, CERTIFICATES_OFF, CERTIFICATES_PROGRAM_ONLY } from '../errors';
import { createFakeRepo, type FakeRepo } from './fakeRepo';
import { SEED_IDS, seedDb } from './seed';

const SEED_STEPS = ['step-intro', 'step-safety', 'step-single-column', 'step-double-column', 'step-week2', 'step-replay'];

let repo: FakeRepo;
beforeEach(() => {
  repo = createFakeRepo(seedDb(new Date('2026-11-12T12:00:00Z')));
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
});
