import { beforeEach, describe, expect, it } from 'vitest';
import { ConstraintError } from '../errors';
import type { NewEpisode } from '../repo';
import { EPISODE_MAX_BYTES } from '../types';
import { createFakeRepo, type FakeRepo } from './fakeRepo';
import { SEED_IDS, seedDb } from './seed';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const episode = (extra: Partial<NewEpisode> = {}): NewEpisode => ({
  productId: SEED_IDS.podcast,
  title: 'Episode',
  type: 'full',
  season: null,
  showNotes: '',
  audioPath: 'podcast/ep.mp3',
  audioBytes: 1000,
  durationS: 60,
  explicit: false,
  publishAt: NOW,
  createdAt: NOW,
  ...extra,
});

describe('podcast settings', () => {
  it('reads the seeded show and upserts', async () => {
    const s = await repo.podcastSettings(SEED_IDS.podcast);
    expect(s).toMatchObject({ order: 'episodic', explicit: false });
    await repo.savePodcastSettings({ ...s!, order: 'serial' });
    expect((await repo.podcastSettings(SEED_IDS.podcast))!.order).toBe('serial');
    expect(repo.db.podcasts).toHaveLength(1);
  });

  it('refuses non-podcast products', async () => {
    await expect(
      repo.savePodcastSettings({ productId: SEED_IDS.program, author: '', explicit: false, order: 'episodic' }),
    ).rejects.toThrow(ConstraintError);
  });
});

describe('episodes', () => {
  it('creates, updates and deletes', async () => {
    const e = await repo.createEpisode(episode({ title: ' New ' }));
    expect(e.title).toBe('New');
    expect((await repo.updateEpisode(e.id, { season: 2 })).season).toBe(2);
    expect(e.season).not.toBe(2); // rows read earlier are snapshots, like the Supabase repo
    expect((await repo.episodes(SEED_IDS.podcast)).map((x) => x.id)).toContain(e.id);
    await repo.deleteEpisode(e.id);
    expect(await repo.episode(e.id)).toBeNull();
  });

  it('refuses blank titles, non-mp3 audio, oversize files, bad seasons and other products', async () => {
    for (const bad of [
      { title: ' ' },
      { audioPath: 'podcast/ep.wav' },
      { audioBytes: 0 },
      { audioBytes: EPISODE_MAX_BYTES + 1 },
      { season: 0 },
      { durationS: -1 },
      { productId: SEED_IDS.program },
    ]) {
      await expect(repo.createEpisode(episode(bad))).rejects.toThrow(ConstraintError);
    }
  });
});

describe('podcast feeds', () => {
  it('gives a grant holder one stable token, resolvable while the grant lasts', async () => {
    const token = await repo.podcastFeedToken(SEED_IDS.podcast, SEED_IDS.student, NOW);
    expect(await repo.podcastFeedToken(SEED_IDS.podcast, SEED_IDS.student, NOW)).toBe(token);
    expect(await repo.podcastFeedByToken(token, NOW)).toMatchObject({ productId: SEED_IDS.podcast, profileId: SEED_IDS.student });
    const grant = repo.db.grants.find((g) => g.productId === SEED_IDS.podcast && g.profileId === SEED_IDS.student)!;
    grant.status = 'revoked';
    expect(await repo.podcastFeedByToken(token, NOW)).toBeNull();
  });

  it('refuses a token without a grant', async () => {
    await expect(repo.podcastFeedToken(SEED_IDS.podcast, SEED_IDS.assistant, NOW)).rejects.toThrow(ConstraintError);
  });

  it('reset kills the old feed url', async () => {
    const old = await repo.podcastFeedToken(SEED_IDS.podcast, SEED_IDS.student, NOW);
    const fresh = await repo.resetPodcastFeed(SEED_IDS.podcast, SEED_IDS.student, NOW);
    expect(fresh).not.toBe(old);
    expect(await repo.podcastFeedByToken(old, NOW)).toBeNull();
    expect(await repo.podcastFeedByToken(fresh, NOW)).not.toBeNull();
  });
});

describe('product files', () => {
  it('creates, renames and deletes, oldest first', async () => {
    const f = await repo.createProductFile({ productId: SEED_IDS.downloads, title: 'Extra', filePath: 'x/extra.zip', sizeBytes: 5, createdAt: NOW });
    expect((await repo.productFiles(SEED_IDS.downloads)).at(-1)!.id).toBe(f.id);
    expect((await repo.renameProductFile(f.id, ' Bonus ')).title).toBe('Bonus');
    expect(f.title).toBe('Extra');
    await repo.deleteProductFile(f.id);
    expect(await repo.productFile(f.id)).toBeNull();
  });

  it('refuses blank titles, empty files and other products', async () => {
    const base = { productId: SEED_IDS.downloads, title: 'A', filePath: 'a.pdf', sizeBytes: 1, createdAt: NOW };
    for (const bad of [{ title: '' }, { sizeBytes: 0 }, { filePath: ' ' }, { productId: SEED_IDS.podcast }]) {
      await expect(repo.createProductFile({ ...base, ...bad })).rejects.toThrow(ConstraintError);
    }
    const f = await repo.createProductFile(base);
    await expect(repo.renameProductFile(f.id, ' ')).rejects.toThrow(ConstraintError);
  });
});
