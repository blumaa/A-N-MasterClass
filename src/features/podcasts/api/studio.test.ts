import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { createFakeFileStore } from '@/lib/storage/fileStore';
import { editPodcasts, studioPodcasts, type PodcastCommand } from './studio';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;
let files: ReturnType<typeof createFakeFileStore>;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
  files = createFakeFileStore();
});

const as = async (who: string | null) => (await resolveViewer(repo, 'alexander', who))!;
const run = async (c: PodcastCommand, who: string | null = SEED_IDS.assistant) => editPodcasts(repo, files, await as(who), c, NOW);
const FOLDER = `${SEED_IDS.alexander}/${SEED_IDS.podcast}/`;
const EPISODE = {
  productId: SEED_IDS.podcast,
  title: 'Knots',
  type: 'full' as const,
  season: 1,
  showNotes: '',
  audioPath: `${FOLDER}u1-knots.mp3`,
  audioBytes: 1000,
  durationS: 60,
  explicit: false,
  publishAt: null,
};

describe('studioPodcasts', () => {
  it('lists podcasts with settings and every episode for editors only', async () => {
    const s = (await studioPodcasts(repo, await as(SEED_IDS.assistant)))!;
    expect(s.podcasts.map((p) => [p.product.slug, p.settings.author, p.episodes.length])).toEqual([['rope-talk', 'Alexander', 2]]);
    expect(await studioPodcasts(repo, await as(SEED_IDS.student))).toBeNull();
  });
});

describe('editPodcasts', () => {
  it('creates a podcast with default settings', async () => {
    const r = await run({ op: 'createPodcast', title: 'Night Talks', slug: 'night-talks' });
    const id = r.ok ? r.id! : '';
    expect(await repo.product(id)).toMatchObject({ kind: 'podcast', status: 'draft' });
    expect(await repo.podcastSettings(id)).toMatchObject({ order: 'episodic', explicit: false });
  });

  it('adds, edits and deletes episodes', async () => {
    const r = await run({ op: 'createEpisode', ...EPISODE });
    const id = r.ok ? r.id! : '';
    expect(await repo.episode(id)).toMatchObject({ title: 'Knots', createdAt: NOW });
    expect(await run({ op: 'updateEpisode', episodeId: id, patch: { publishAt: NOW } })).toEqual({ ok: true });
    expect((await repo.episode(id))!.publishAt).toEqual(NOW);
    expect(await run({ op: 'deleteEpisode', episodeId: id })).toEqual({ ok: true });
    expect(await repo.episode(id)).toBeNull();
    expect(files.removed).toEqual([EPISODE.audioPath]);
  });

  it('removes the old audio when an episode gets a new file, not when it keeps its path', async () => {
    const r = await run({ op: 'createEpisode', ...EPISODE });
    const id = r.ok ? r.id! : '';
    expect(await run({ op: 'updateEpisode', episodeId: id, patch: { audioPath: EPISODE.audioPath, title: 'K' } })).toEqual({ ok: true });
    expect(files.removed).toEqual([]);
    expect(await run({ op: 'updateEpisode', episodeId: id, patch: { audioPath: `${FOLDER}u2-knots.mp3`, audioBytes: 5 } })).toEqual({ ok: true });
    expect((await repo.episode(id))!.audioPath).toBe(`${FOLDER}u2-knots.mp3`);
    expect(files.removed).toEqual([EPISODE.audioPath]);
  });

  it('refuses audio outside this podcast folder of this space; an unchanged old path is kept', async () => {
    for (const audioPath of ['space-natasha/prod-podcast/u1-x.mp3', `${SEED_IDS.alexander}/${SEED_IDS.downloads}/u1-x.mp3`, 'x.mp3']) {
      expect(await run({ op: 'createEpisode', ...EPISODE, audioPath })).toEqual({ ok: false, error: 'not_found' });
      expect(await run({ op: 'updateEpisode', episodeId: 'ep-welcome', patch: { audioPath } })).toEqual({ ok: false, error: 'not_found' });
    }
    const legacy = (await repo.episode('ep-welcome'))!.audioPath;
    expect(await run({ op: 'updateEpisode', episodeId: 'ep-welcome', patch: { audioPath: legacy, title: 'Hi' } })).toEqual({ ok: true });
    expect(files.removed).toEqual([]);
  });

  it('saves settings and reports invalid input', async () => {
    expect(await run({ op: 'saveSettings', productId: SEED_IDS.podcast, author: 'A', explicit: true, order: 'serial' })).toEqual({ ok: true });
    expect(await run({ op: 'createEpisode', ...EPISODE, audioPath: `${FOLDER}u1-x.wav` })).toMatchObject({ ok: false, error: 'invalid' });
  });

  it('refuses students and rows outside the space or of another kind', async () => {
    expect(await run({ op: 'deleteEpisode', episodeId: 'ep-welcome' }, SEED_IDS.student)).toEqual({ ok: false, error: 'forbidden' });
    expect(await run({ op: 'createEpisode', ...EPISODE, productId: SEED_IDS.downloads })).toEqual({ ok: false, error: 'not_found' });
    expect(await run({ op: 'deleteEpisode', episodeId: 'nope' })).toEqual({ ok: false, error: 'not_found' });
    const natasha = (await resolveViewer(repo, 'natasha', SEED_IDS.natashaOwner))!;
    expect(await editPodcasts(repo, files, natasha, { op: 'deleteEpisode', episodeId: 'ep-welcome' }, NOW)).toEqual({ ok: false, error: 'not_found' });
  });
});
