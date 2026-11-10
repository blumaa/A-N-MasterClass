import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer, type Viewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { savePayments, studioPayments } from './payments';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
  repo.db.members.push({ spaceId: SEED_IDS.alexander, profileId: SEED_IDS.student, role: 'admin' });
});

const as = async (profileId: string): Promise<Viewer> => (await resolveViewer(repo, 'alexander', profileId))!;
const owner = () => as(SEED_IDS.alexanderOwner);
const input = { env: 'sandbox' as const, clientId: ' cid ', secret: ' s3cret ', webhookId: ' WH-1 ' };

describe('studioPayments', () => {
  it('is owner only (payments.manage) and never returns the secret', async () => {
    await savePayments(repo, await owner(), input, NOW);
    const view = await studioPayments(repo, await owner());
    expect(view).toEqual({
      sandbox: { clientId: 'cid', webhookId: 'WH-1', hasSecret: true, updatedAt: NOW },
      live: null,
    });
    expect(JSON.stringify(view)).not.toContain('s3cret');
    expect(await studioPayments(repo, await as(SEED_IDS.student))).toBeNull(); // admin
  });
});

describe('savePayments', () => {
  it('saves trimmed credentials per env', async () => {
    expect(await savePayments(repo, await owner(), input, NOW)).toEqual({ ok: true });
    expect(await repo.paymentSecret(SEED_IDS.alexander, 'sandbox')).toBe('s3cret');
    expect(await repo.paymentCredentials(SEED_IDS.alexander, 'live')).toBeNull();
  });

  it('keeps the stored secret when the field is left blank', async () => {
    const v = await owner();
    await savePayments(repo, v, input, NOW);
    expect(await savePayments(repo, v, { ...input, clientId: 'cid-2', secret: '', webhookId: '' }, NOW)).toEqual({ ok: true });
    expect(await repo.paymentSecret(SEED_IDS.alexander, 'sandbox')).toBe('s3cret');
    expect(await repo.paymentCredentials(SEED_IDS.alexander, 'sandbox')).toMatchObject({ clientId: 'cid-2', webhookId: null });
  });

  it('needs a client id, and a secret the first time', async () => {
    const v = await owner();
    expect(await savePayments(repo, v, { ...input, clientId: ' ' }, NOW)).toMatchObject({ error: 'invalid' });
    expect(await savePayments(repo, v, { ...input, secret: '' }, NOW)).toMatchObject({ error: 'invalid', message: expect.stringMatching(/secret/i) });
  });

  it('refuses admins and staff of other roles', async () => {
    expect(await savePayments(repo, await as(SEED_IDS.student), input, NOW)).toEqual({ ok: false, error: 'forbidden' });
    expect(await savePayments(repo, await as(SEED_IDS.assistant), input, NOW)).toEqual({ ok: false, error: 'forbidden' });
  });
});
