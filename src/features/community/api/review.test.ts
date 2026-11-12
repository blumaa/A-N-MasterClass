import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { logFilterOf, review, reviewTabOf, studioReview, type LogFilter, type ReviewTab } from './review';

const NOW = new Date('2026-11-12T12:00:00Z');
const NO_FILTER: LogFilter = { action: null, from: null, to: null };
let repo: FakeRepo;

const viewer = async (who: string, space = 'alexander') => (await resolveViewer(repo, space, who))!;
const open = async (who: string, tab: ReviewTab, filter = NO_FILTER) =>
  review(repo, await viewer(who), (await repo.product(SEED_IDS.community))!, tab, filter, NOW);
const post = (body: string, authorId: string = SEED_IDS.student) =>
  repo.createPost({ channelId: SEED_IDS.general, authorId, body, createdAt: NOW });

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

describe('reviewTabOf / logFilterOf', () => {
  it('reads the query; unknown values fall back', () => {
    expect(reviewTabOf('hidden')).toBe('hidden');
    expect(reviewTabOf(['log'])).toBe('reports');
    expect(reviewTabOf(undefined)).toBe('reports');
    expect(logFilterOf({ action: 'lock', from: '2026-11-01', to: '2026-11-30' })).toEqual({ action: 'lock', from: '2026-11-01', to: '2026-11-30' });
    expect(logFilterOf({ action: 'delete', from: '1 Nov', to: '2026-02-31' })).toEqual(NO_FILTER);
  });
});

describe('review', () => {
  it('only for those who moderate a channel', async () => {
    expect(await open(SEED_IDS.student, 'pending')).toBeNull();
    expect(await open(SEED_IDS.alexanderOwner, 'pending')).toMatchObject({ tab: 'pending', posts: [] });
  });

  it('post tabs: pending, rejected, hidden, locked', async () => {
    const pending = await post('wait');
    const rejected = await post('no');
    const hidden = await post('gone');
    const locked = await post('shut');
    await repo.updatePost(pending.id, { status: 'pending' });
    await repo.updatePost(rejected.id, { status: 'rejected' });
    await repo.updatePost(hidden.id, { hiddenAt: NOW });
    await repo.updatePost(locked.id, { lockedAt: NOW });
    const bodies = async (tab: ReviewTab) => {
      const r = await open(SEED_IDS.alexanderOwner, tab);
      return r && 'posts' in r ? r.posts.map((p) => p.body) : null;
    };
    expect(await bodies('pending')).toEqual(['wait']);
    expect(await bodies('rejected')).toEqual(['no']);
    expect(await bodies('hidden')).toEqual(['gone']);
    expect(await bodies('locked')).toEqual(['shut']);
  });

  it('channel moderators see their channels only', async () => {
    await repo.setChannelModerator(SEED_IDS.announcements, SEED_IDS.student, true);
    const p = await post('wait', SEED_IDS.alexanderOwner);
    await repo.updatePost(p.id, { status: 'pending' });
    expect(await open(SEED_IDS.student, 'pending')).toMatchObject({ posts: [] });
  });

  it('reports tab carries the report queue', async () => {
    expect(await open(SEED_IDS.alexanderOwner, 'reports')).toMatchObject({ tab: 'reports', queue: { open: [], resolved: [] } });
  });

  it('log: newest first, named, filtered by action and date range', async () => {
    const p = await post('spam');
    const log = (action: 'hide' | 'lock', createdAt: Date) =>
      repo.logModeration({ actorId: SEED_IDS.alexanderOwner, action, targetType: 'post', targetId: p.id, createdAt });
    await log('hide', new Date('2026-11-01T10:00:00Z'));
    await log('lock', new Date('2026-11-10T10:00:00Z'));
    const all = await open(SEED_IDS.alexanderOwner, 'log');
    if (all?.tab !== 'log') throw new Error('expected log');
    expect(all.entries.map((e) => [e.action, e.actor, e.channel, e.preview, e.href])).toEqual([
      ['lock', 'Alexander', 'General', 'spam', `/community/community/posts/${p.id}`],
      ['hide', 'Alexander', 'General', 'spam', `/community/community/posts/${p.id}`],
    ]);
    const actions = async (filter: Partial<LogFilter>) => {
      const r = await open(SEED_IDS.alexanderOwner, 'log', { ...NO_FILTER, ...filter });
      return r?.tab === 'log' ? r.entries.map((e) => e.action) : null;
    };
    expect(await actions({ action: 'hide' })).toEqual(['hide']);
    expect(await actions({ from: '2026-11-02' })).toEqual(['lock']);
    expect(await actions({ to: '2026-11-01' })).toEqual(['hide']);
    expect(await actions({ from: '2026-11-11' })).toEqual([]);
  });

  it('log: deleted content keeps its row, without preview', async () => {
    const p = await post('spam');
    await repo.logModeration({ actorId: SEED_IDS.alexanderOwner, action: 'hide', targetType: 'post', targetId: p.id, createdAt: NOW });
    await repo.deletePost(p.id);
    const r = await open(SEED_IDS.alexanderOwner, 'log');
    expect(r?.tab === 'log' ? r.entries.map((e) => [e.preview, e.href]) : null).toEqual([[null, null]]);
  });
});

describe('studioReview', () => {
  it('needs community.moderate and a community of the space', async () => {
    const studio = async (who: string, id: string, space?: string) => studioReview(repo, await viewer(who, space), id, 'reports', NO_FILTER, NOW);
    expect(await studio(SEED_IDS.alexanderOwner, SEED_IDS.community)).toMatchObject({ tab: 'reports', queue: { reporters: true } });
    await repo.setChannelModerator(SEED_IDS.general, SEED_IDS.student, true);
    expect(await studio(SEED_IDS.student, SEED_IDS.community)).toBeNull();
    expect(await studio(SEED_IDS.natashaOwner, SEED_IDS.community, 'natasha')).toBeNull();
    expect(await studio(SEED_IDS.alexanderOwner, 'nope')).toBeNull();
  });
});
