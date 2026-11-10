import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { clientPodcast, episodeAudio, feedAudio, feedXml, myPodcasts, orderEpisodes, resetFeed } from './listen';

const NOW = new Date('2026-11-10T12:00:00Z');
const ORIGIN = 'https://alexander.test';
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const as = async (who: string | null) => (await resolveViewer(repo, 'alexander', who))!;
const view = async (who: string | null) => clientPodcast(repo, await as(who), 'rope-talk', ORIGIN, NOW);
const tokenOf = (url: string | null) => url!.split('/').at(-1)!;

describe('clientPodcast', () => {
  it('shows holders released episodes and their private feed URL', async () => {
    const v = (await view(SEED_IDS.student))!;
    expect(v.hasAccess).toBe(true);
    expect(v.episodes.map((e) => e.id)).toEqual(['ep-welcome']);
    expect(v.feedUrl).toMatch(/^https:\/\/alexander\.test\/feeds\/podcast\/[\w-]+$/);
    expect((await view(SEED_IDS.student))!.feedUrl).toBe(v.feedUrl);
  });

  it('shows editors every episode, scheduled ones flagged, and no feed without a grant', async () => {
    const v = (await view(SEED_IDS.assistant))!;
    expect(v.episodes.map((e) => [e.id, e.released])).toEqual([
      ['ep-tension', false],
      ['ep-welcome', true],
    ]);
    expect(v.feedUrl).toBeNull();
  });

  it('shows visitors the product only, and hides other kinds', async () => {
    expect(await view(null)).toMatchObject({ hasAccess: false, episodes: [], feedUrl: null });
    expect(await clientPodcast(repo, await as(null), 'pattern-pack', ORIGIN, NOW)).toBeNull();
  });
});

describe('orderEpisodes', () => {
  const ep = (id: string, season: number | null, day: number) => ({ id, season, publishAt: new Date(Date.UTC(2026, 10, day)) });
  it('puts newest first for episodic shows and season order for serial ones', () => {
    const list = [ep('a', 2, 1), ep('b', 1, 3), ep('c', 1, 2)];
    expect(orderEpisodes(list, 'episodic').map((e) => e.id)).toEqual(['b', 'c', 'a']);
    expect(orderEpisodes(list, 'serial').map((e) => e.id)).toEqual(['c', 'b', 'a']);
  });
});

describe('myPodcasts', () => {
  it('lists held podcasts', async () => {
    expect((await myPodcasts(repo, await as(SEED_IDS.student), NOW)).map((p) => p.slug)).toEqual(['rope-talk']);
  });
});

describe('episodeAudio', () => {
  it('gives holders released audio, editors any, nobody else', async () => {
    expect(await episodeAudio(repo, await as(SEED_IDS.student), 'rope-talk', 'ep-welcome', NOW)).toBe('rope-talk/ep-welcome.mp3');
    expect(await episodeAudio(repo, await as(SEED_IDS.student), 'rope-talk', 'ep-tension', NOW)).toBeNull();
    expect(await episodeAudio(repo, await as(SEED_IDS.assistant), 'rope-talk', 'ep-tension', NOW)).toBe('rope-talk/ep-tension.mp3');
    expect(await episodeAudio(repo, await as(null), 'rope-talk', 'ep-welcome', NOW)).toBeNull();
    expect(await episodeAudio(repo, await as(SEED_IDS.student), 'pattern-pack', 'ep-welcome', NOW)).toBeNull();
  });
});

describe('private feed', () => {
  it('serves released episodes behind the token while the grant is active', async () => {
    const token = tokenOf((await view(SEED_IDS.student))!.feedUrl);
    const xml = (await feedXml(repo, 'alexander', token, ORIGIN, NOW))!;
    expect(xml).toContain('<title>Rope Talk</title>');
    expect(xml).toContain(`url="${ORIGIN}/feeds/podcast/${token}/episodes/ep-welcome"`);
    expect(xml).not.toContain('ep-tension');
    expect(await feedAudio(repo, 'alexander', token, 'ep-welcome', NOW)).toBe('rope-talk/ep-welcome.mp3');
    expect(await feedAudio(repo, 'alexander', token, 'ep-tension', NOW)).toBeNull();
  });

  it('refuses unknown tokens, other spaces and revoked grants', async () => {
    const token = tokenOf((await view(SEED_IDS.student))!.feedUrl);
    expect(await feedXml(repo, 'alexander', 'nope', ORIGIN, NOW)).toBeNull();
    expect(await feedXml(repo, 'natasha', token, ORIGIN, NOW)).toBeNull();
    repo.db.grants.find((g) => g.id === `grant-student-${SEED_IDS.podcast}`)!.status = 'revoked';
    expect(await feedXml(repo, 'alexander', token, ORIGIN, NOW)).toBeNull();
    expect(await feedAudio(repo, 'alexander', token, 'ep-welcome', NOW)).toBeNull();
  });

  it('reset replaces the token and kills the old URL', async () => {
    const old = tokenOf((await view(SEED_IDS.student))!.feedUrl);
    expect(await resetFeed(repo, await as(SEED_IDS.student), SEED_IDS.podcast, NOW)).toEqual({ ok: true });
    expect(await feedXml(repo, 'alexander', old, ORIGIN, NOW)).toBeNull();
    expect(tokenOf((await view(SEED_IDS.student))!.feedUrl)).not.toBe(old);
    expect(await resetFeed(repo, await as(null), SEED_IDS.podcast, NOW)).toEqual({ ok: false, error: 'forbidden' });
    expect(await resetFeed(repo, await as(SEED_IDS.assistant), SEED_IDS.podcast, NOW)).toMatchObject({ ok: false, error: 'invalid' });
  });
});
