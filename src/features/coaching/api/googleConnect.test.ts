// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { GoogleApiError } from '@/lib/google/calendar';
import { readState } from '@/lib/google/state';
import { disconnectCalendar, finishConnect, startConnect } from './googleConnect';

const NOW = new Date('2026-11-10T12:00:00Z');
const SECRET = 'k'.repeat(32);
const RETURN = 'http://alexander.localhost:3000/studio/coaching';
const REDIRECT = 'http://localhost:3000/api/google/callback';
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (who: string | null) => (await resolveViewer(repo, 'alexander', who))!;
const exchange = () => ({ exchangeCode: vi.fn(async () => ({ refreshToken: 'r1', accountEmail: 'coach@example.test' })) });

async function started() {
  const state = startConnect(await as(SEED_IDS.alexanderOwner), SECRET, RETURN, NOW)!;
  return { state, nonce: readState(state, SECRET, NOW)!.nonce };
}

describe('startConnect', () => {
  it('signs a state for settings managers only', async () => {
    expect(readState((await started()).state, SECRET, NOW)).toMatchObject({ spaceSlug: 'alexander', profileId: SEED_IDS.alexanderOwner, returnTo: RETURN });
    expect(startConnect(await as(SEED_IDS.assistant), SECRET, RETURN, NOW)).toBeNull();
    expect(startConnect(await as(null), SECRET, RETURN, NOW)).toBeNull();
  });
});

describe('finishConnect', () => {
  it('stores the connection and returns to Studio', async () => {
    const { state, nonce } = await started();
    const google = exchange();
    const to = await finishConnect(repo, google, SECRET, REDIRECT, { state, nonce, code: 'c1', error: null }, NOW);
    expect(to).toBe(`${RETURN}?calendar=connected`);
    expect(google.exchangeCode).toHaveBeenCalledWith('c1', REDIRECT);
    expect(await repo.calendarConnection(SEED_IDS.alexander)).toMatchObject({ accountEmail: 'coach@example.test', calendarId: 'primary' });
    expect(await repo.calendarRefreshToken(SEED_IDS.alexander)).toBe('r1');
  });

  it('refuses a bad state or another browser', async () => {
    const { state, nonce } = await started();
    const cb = { state, nonce, code: 'c1', error: null };
    expect(await finishConnect(repo, exchange(), SECRET, REDIRECT, { ...cb, nonce: 'other' }, NOW)).toBeNull();
    expect(await finishConnect(repo, exchange(), SECRET, REDIRECT, { ...cb, nonce: null }, NOW)).toBeNull();
    expect(await finishConnect(repo, exchange(), SECRET, REDIRECT, { ...cb, state: 'junk' }, NOW)).toBeNull();
  });

  it('reports a cancelled consent, a lost role and a failed exchange', async () => {
    const { state, nonce } = await started();
    expect(await finishConnect(repo, exchange(), SECRET, REDIRECT, { state, nonce, code: null, error: 'access_denied' }, NOW)).toBe(`${RETURN}?calendar=denied`);

    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const broken = { exchangeCode: vi.fn(() => Promise.reject(new GoogleApiError(400, 'invalid_grant'))) };
    expect(await finishConnect(repo, broken, SECRET, REDIRECT, { state, nonce, code: 'c', error: null }, NOW)).toBe(`${RETURN}?calendar=failed`);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();

    repo.db.members = repo.db.members.filter((m) => m.profileId !== SEED_IDS.alexanderOwner);
    expect(await finishConnect(repo, exchange(), SECRET, REDIRECT, { state, nonce, code: 'c', error: null }, NOW)).toBe(`${RETURN}?calendar=failed`);
    expect(await repo.calendarConnection(SEED_IDS.alexander)).toBeNull();
  });
});

describe('disconnectCalendar', () => {
  it('revokes and forgets, even when Google fails', async () => {
    const row = { spaceId: SEED_IDS.alexander, provider: 'google' as const, accountEmail: 'c@x.test', calendarId: 'primary', connectedAt: NOW };
    await repo.saveCalendarConnection(row, 'r1');
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const revoke = vi.fn(() => Promise.reject(new GoogleApiError(400, 'invalid_token')));
    expect(await disconnectCalendar(repo, await as(SEED_IDS.alexanderOwner), { revoke })).toEqual({ ok: true });
    expect(revoke).toHaveBeenCalledWith('r1');
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
    expect(await repo.calendarConnection(SEED_IDS.alexander)).toBeNull();
    expect(await disconnectCalendar(repo, await as(SEED_IDS.assistant), null)).toEqual({ ok: false, error: 'forbidden' });
  });
});
