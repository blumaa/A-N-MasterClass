import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { DEFAULT_COMMUNITY_SETTINGS, type Product } from '@/lib/data/types';
import { chatCommand } from './chat';
import { dmInbox, dmTargets, dmThreadPage, isUnread, unreadDms } from './dms';

const NOW = new Date('2026-11-10T12:00:00Z');
const LATER = new Date('2026-11-10T13:00:00Z');
let repo: FakeRepo;
let community: Product;

beforeEach(async () => {
  repo = createFakeRepo(seedDb(NOW));
  community = (await repo.product(SEED_IDS.community))!;
});

const viewer = (who: string) => resolveViewer(repo, 'alexander', who).then((v) => v!);
const send = async (who: string, threadId: string, body: string, at = NOW) =>
  chatCommand(repo, await viewer(who), { op: 'sendDm', threadId, body }, at);
const thread = async () => {
  const r = await chatCommand(
    repo,
    await viewer(SEED_IDS.student),
    { op: 'startDm', communityId: SEED_IDS.community, recipientId: SEED_IDS.alexanderOwner },
    NOW,
  );
  if (!r.ok || !r.id) throw new Error('no thread');
  return r.id;
};

describe('isUnread', () => {
  const msg = { id: 'm', channelId: null, threadId: 't', authorId: 'b', body: 'x', createdAt: LATER };
  it('needs a newer message from the other side', () => {
    expect(isUnread(null, 'a', undefined)).toBe(false);
    expect(isUnread(msg, 'a', undefined)).toBe(true);
    expect(isUnread(msg, 'b', undefined)).toBe(false);
    expect(isUnread(msg, 'a', { threadId: 't', profileId: 'a', readAt: NOW })).toBe(true);
    expect(isUnread(msg, 'a', { threadId: 't', profileId: 'a', readAt: LATER })).toBe(false);
  });
});

describe('dmInbox / dmThreadPage', () => {
  it('lists threads with the other person and unread state; opening marks read', async () => {
    const id = await thread();
    await send(SEED_IDS.student, id, 'hello');
    const owner = await viewer(SEED_IDS.alexanderOwner);
    expect(await dmInbox(repo, owner, community, NOW)).toEqual([
      { id, other: { id: SEED_IDS.student, name: 'Robin (student)' }, last: { body: 'hello', createdAt: NOW, mine: false }, unread: true },
    ]);
    expect(await unreadDms(repo, owner, community, NOW)).toBe(1);

    const page = await dmThreadPage(repo, owner, community, id, LATER);
    expect(page).toMatchObject({ threadId: id, canSend: true, blocking: false });
    expect(page?.messages.map((m) => m.body)).toEqual(['hello']);
    expect(await unreadDms(repo, owner, community, LATER)).toBe(0);
    expect((await dmInbox(repo, await viewer(SEED_IDS.student), community, NOW))?.[0]?.unread).toBe(false);
  });

  it('hides threads of others and shows block state', async () => {
    const id = await thread();
    expect(await dmThreadPage(repo, await viewer(SEED_IDS.assistant), community, id, NOW)).toBeNull();
    const student = await viewer(SEED_IDS.student);
    await chatCommand(repo, student, { op: 'block', communityId: SEED_IDS.community, profileId: SEED_IDS.alexanderOwner, on: true }, NOW);
    expect(await dmThreadPage(repo, student, community, id, NOW)).toMatchObject({ canSend: false, blocking: true });
    expect(await dmThreadPage(repo, await viewer(SEED_IDS.alexanderOwner), community, id, NOW)).toMatchObject({
      canSend: false,
      blocking: false,
    });
  });
});

describe('dmTargets', () => {
  it('is everyone the viewer may start a thread with', async () => {
    expect(await dmTargets(repo, await viewer(SEED_IDS.student), community, NOW)).toEqual(new Set([SEED_IDS.alexanderOwner]));
    await repo.saveCommunitySettings({ communityId: SEED_IDS.community, ...DEFAULT_COMMUNITY_SETTINGS, dmsEnabled: true, founderDms: false });
    expect(await dmTargets(repo, await viewer(SEED_IDS.student), community, NOW)).toEqual(new Set());
    expect(await dmTargets(repo, await viewer(SEED_IDS.assistant), community, NOW)).toEqual(new Set());
  });
});
