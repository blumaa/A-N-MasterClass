// Media Supabase repo against the linked project. Service client for data (RLS is covered by the SQL
// suites). The feed-token RPCs read auth.uid(), so those use a client signed in as the listener.
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabasePublic } from '@/config/supabase';
import { ConstraintError } from '@/lib/data/errors';
import type { NewEpisode } from '@/lib/data/repo';
import { EPISODE_MAX_BYTES } from '@/lib/data/types';
import type { Database } from '@/lib/db/database.types';
import { createCoreRepo, type CoreRepo } from './core';
import { createMediaRepo, type MediaRepo } from './media';
import { contractEnabled, createContractSpace, type ContractSpace } from './testing/contractSpace';

const NOW = new Date();

describe.skipIf(!contractEnabled)('media repo (Supabase contract)', () => {
  let fx: ContractSpace;
  let core: CoreRepo;
  let repo: MediaRepo;
  let podcastId: string;
  let downloadId: string;
  let programId: string;

  const ep = (over: Partial<NewEpisode> = {}): NewEpisode => ({
    productId: podcastId,
    title: 'Ep',
    type: 'full',
    season: null,
    showNotes: '',
    audioPath: 'a/ep.mp3',
    audioBytes: 1000,
    durationS: null,
    explicit: false,
    publishAt: null,
    createdAt: new Date(),
    ...over,
  });

  /** Client signed in as the listener (feed RPCs use auth.uid()). */
  async function listenerRepo(name: string) {
    const id = await fx.newUser(name);
    const password = randomUUID();
    const upd = await fx.admin.auth.admin.updateUserById(id, { password });
    if (upd.error) throw upd.error;
    const { url, publishableKey } = supabasePublic();
    const client = createClient<Database>(url, publishableKey, { auth: { persistSession: false } });
    const signed = await client.auth.signInWithPassword({ email: fx.email(name), password });
    if (signed.error) throw signed.error;
    return { id, repo: createMediaRepo({ db: async () => client, admin: () => fx.admin }) };
  }

  beforeAll(async () => {
    fx = await createContractSpace('media');
    core = createCoreRepo({ db: async () => fx.admin, admin: () => fx.admin });
    repo = createMediaRepo({ db: async () => fx.admin, admin: () => fx.admin });
    const mk = (kind: 'podcast' | 'download' | 'program', slug: string) =>
      core.createProduct({ spaceId: fx.spaceId, kind, slug, title: slug }).then((p) => p.id);
    podcastId = await mk('podcast', 'pod');
    downloadId = await mk('download', 'dl');
    programId = await mk('program', 'prog');
  });

  afterAll(async () => {
    await fx?.cleanup();
  });

  describe('podcast settings', () => {
    it('is null until saved, upserts, trims author, rejects long author and wrong kind', async () => {
      expect(await repo.podcastSettings(podcastId)).toBeNull();
      await repo.savePodcastSettings({ productId: podcastId, author: '  Ann  ', explicit: false, order: 'episodic' });
      expect(await repo.podcastSettings(podcastId)).toEqual({
        productId: podcastId,
        author: 'Ann',
        explicit: false,
        order: 'episodic',
      });
      await repo.savePodcastSettings({ productId: podcastId, author: 'Bo', explicit: true, order: 'serial' });
      expect(await repo.podcastSettings(podcastId)).toMatchObject({ author: 'Bo', explicit: true, order: 'serial' });
      await expect(
        repo.savePodcastSettings({ productId: podcastId, author: 'x'.repeat(201), explicit: false, order: 'episodic' }),
      ).rejects.toBeInstanceOf(ConstraintError);
      await expect(
        repo.savePodcastSettings({ productId: programId, author: '', explicit: false, order: 'episodic' }),
      ).rejects.toBeInstanceOf(ConstraintError);
    });
  });

  describe('episodes', () => {
    it('creates, trims title, lists newest created first, finds by id, null when absent', async () => {
      const pod = await core.createProduct({ spaceId: fx.spaceId, kind: 'podcast', slug: 'pod-order', title: 'o' });
      const old = await repo.createEpisode(ep({ productId: pod.id, title: '  Old ', createdAt: new Date('2026-01-01T00:00:00Z') }));
      const fresh = await repo.createEpisode(
        ep({ productId: pod.id, title: 'New', createdAt: new Date('2026-06-01T00:00:00Z'), season: 2, durationS: 0, publishAt: new Date('2026-07-01T00:00:00Z') }),
      );
      expect(old.title).toBe('Old');
      expect(fresh).toMatchObject({ season: 2, durationS: 0, type: 'full', showNotes: '' });
      expect(fresh.publishAt).toEqual(new Date('2026-07-01T00:00:00Z'));
      expect(old.publishAt).toBeNull();
      expect((await repo.episodes(pod.id)).map((e) => e.id)).toEqual([fresh.id, old.id]);
      expect(await repo.episode(old.id)).toEqual(old);
      expect(await repo.episode(randomUUID())).toBeNull();
    });

    it('rejects the cases the fake rejects', async () => {
      const bad: Partial<NewEpisode>[] = [
        { productId: programId },
        { title: '   ' },
        { audioPath: 'a/ep.wav' },
        { audioBytes: 0 },
        { audioBytes: EPISODE_MAX_BYTES + 1 },
        { season: 0 },
        { durationS: -1 },
        { showNotes: 'x'.repeat(20_001) },
      ];
      for (const over of bad) {
        await expect(repo.createEpisode(ep(over)), JSON.stringify(over).slice(0, 40)).rejects.toBeInstanceOf(ConstraintError);
      }
      expect(await repo.createEpisode(ep({ audioBytes: EPISODE_MAX_BYTES, audioPath: 'a/UP.MP3' }))).toMatchObject({ audioBytes: EPISODE_MAX_BYTES });
    });

    it('updates only the named fields (null clears), validates, errors when missing, deletes', async () => {
      const e = await repo.createEpisode(ep({ season: 3, durationS: 10, publishAt: new Date('2027-01-01T00:00:00Z') }));
      const u = await repo.updateEpisode(e.id, { title: ' Renamed ', season: null, publishAt: null });
      expect(u).toMatchObject({ title: 'Renamed', season: null, publishAt: null, durationS: 10, audioPath: e.audioPath });
      expect(u.createdAt).toEqual(e.createdAt);
      await expect(repo.updateEpisode(e.id, { title: ' ' })).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.updateEpisode(e.id, { audioPath: 'x.txt' })).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.updateEpisode(randomUUID(), { title: 'x' })).rejects.toThrow();
      await repo.deleteEpisode(e.id);
      expect(await repo.episode(e.id)).toBeNull();
      await repo.deleteEpisode(e.id);
    });
  });

  describe('private feed', () => {
    it('needs an active grant; token is stable; reset replaces it and kills the old one', async () => {
      const pod = await core.createProduct({ spaceId: fx.spaceId, kind: 'podcast', slug: 'pod-feed', title: 'f' });
      const l = await listenerRepo('listener');
      await expect(l.repo.podcastFeedToken(pod.id, l.id, NOW)).rejects.toBeInstanceOf(ConstraintError);
      await expect(l.repo.resetPodcastFeed(pod.id, l.id, NOW)).rejects.toBeInstanceOf(ConstraintError);

      const grant = await core.createGrant({ productId: pod.id, profileId: l.id, source: 'manual' });
      const t1 = await l.repo.podcastFeedToken(pod.id, l.id, NOW);
      expect(await l.repo.podcastFeedToken(pod.id, l.id, NOW)).toBe(t1);
      expect(await repo.podcastFeedByToken(t1, NOW)).toMatchObject({ productId: pod.id, profileId: l.id, token: t1 });

      const t2 = await l.repo.resetPodcastFeed(pod.id, l.id, NOW);
      expect(t2).not.toBe(t1);
      expect(await l.repo.podcastFeedToken(pod.id, l.id, NOW)).toBe(t2);
      expect(await repo.podcastFeedByToken(t1, NOW)).toBeNull();
      expect((await repo.podcastFeedByToken(t2, NOW))?.createdAt).toBeInstanceOf(Date);
      expect(await repo.podcastFeedByToken('nope', NOW)).toBeNull();

      await core.revokeGrant(grant.id);
      expect(await repo.podcastFeedByToken(t2, NOW)).toBeNull();
    });

    it('stops serving once the grant expired', async () => {
      const pod = await core.createProduct({ spaceId: fx.spaceId, kind: 'podcast', slug: 'pod-exp', title: 'e' });
      const l = await listenerRepo('expiring');
      const grant = await core.createGrant({ productId: pod.id, profileId: l.id, source: 'manual' });
      const token = await l.repo.podcastFeedToken(pod.id, l.id, NOW);
      expect(await repo.podcastFeedByToken(token, NOW)).not.toBeNull();
      const upd = await fx.admin.from('grants').update({ expires_at: '2020-01-01T00:00:00Z' }).eq('id', grant.id);
      expect(upd.error).toBeNull();
      expect(await repo.podcastFeedByToken(token, NOW)).toBeNull();
    });
  });

  describe('product files', () => {
    it('creates, trims title, lists oldest first, finds, renames, deletes', async () => {
      const dl = await core.createProduct({ spaceId: fx.spaceId, kind: 'download', slug: 'dl-order', title: 'o' });
      const input = (title: string, at: string) => ({
        productId: dl.id,
        title,
        filePath: `f/${title}.pdf`,
        sizeBytes: 5,
        createdAt: new Date(at),
      });
      const b = await repo.createProductFile(input('  B ', '2026-06-01T00:00:00Z'));
      const a = await repo.createProductFile(input('A', '2026-01-01T00:00:00Z'));
      expect(b.title).toBe('B');
      expect((await repo.productFiles(dl.id)).map((f) => f.id)).toEqual([a.id, b.id]);
      expect(await repo.productFile(a.id)).toEqual(a);
      expect(await repo.productFile(randomUUID())).toBeNull();
      expect(await repo.renameProductFile(a.id, ' Z ')).toMatchObject({ id: a.id, title: 'Z', filePath: a.filePath });
      await expect(repo.renameProductFile(a.id, '  ')).rejects.toBeInstanceOf(ConstraintError);
      await expect(repo.renameProductFile(randomUUID(), 'x')).rejects.toThrow();
      await repo.deleteProductFile(a.id);
      expect(await repo.productFile(a.id)).toBeNull();
    });

    it('rejects wrong kind, blank title or path, empty file', async () => {
      const f = (over = {}) => ({ productId: downloadId, title: 't', filePath: 'f/x.pdf', sizeBytes: 1, createdAt: new Date(), ...over });
      for (const over of [{ productId: podcastId }, { title: ' ' }, { filePath: ' ' }, { sizeBytes: 0 }]) {
        await expect(repo.createProductFile(f(over))).rejects.toBeInstanceOf(ConstraintError);
      }
    });
  });
});
