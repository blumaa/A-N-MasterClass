import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { DEFAULT_COMMUNITY_SETTINGS } from '@/lib/data/types';
import { chatCommand, type ChatCommand } from './chat';

const NOW = new Date('2026-11-10T12:00:00Z');
let repo: FakeRepo;

beforeEach(() => {
  repo = createFakeRepo(seedDb(NOW));
});

const run = async (who: string | null, cmd: ChatCommand, space = 'alexander') =>
  chatCommand(repo, (await resolveViewer(repo, space, who))!, cmd, NOW);
const createdId = (r: Awaited<ReturnType<typeof run>>): string => {
  if (!r.ok || !r.id) throw new Error(`expected created id, got ${JSON.stringify(r)}`);
  return r.id;
};
const FORBIDDEN = { ok: false, error: 'forbidden' };
const start = (from: string, to: string) => run(from, { op: 'startDm', communityId: SEED_IDS.community, recipientId: to });
const settings = (patch: { dmsEnabled?: boolean; founderDms?: boolean }) =>
  repo.saveCommunitySettings({ communityId: SEED_IDS.community, ...DEFAULT_COMMUNITY_SETTINGS, ...patch });

describe('chat channel messages', () => {
  it('members send in chat channels; feed channels refuse messages; other spaces see nothing', async () => {
    expect((await run(SEED_IDS.student, { op: 'sendMessage', channelId: SEED_IDS.lounge, body: 'hi' })).ok).toBe(true);
    expect(await run(SEED_IDS.student, { op: 'sendMessage', channelId: SEED_IDS.general, body: 'hi' })).toMatchObject({
      error: 'invalid',
    });
    expect(await run(SEED_IDS.natashaOwner, { op: 'sendMessage', channelId: SEED_IDS.lounge, body: 'x' }, 'natasha')).toEqual({
      ok: false,
      error: 'not_found',
    });
    expect(await run(null, { op: 'sendMessage', channelId: SEED_IDS.lounge, body: 'x' })).toEqual(FORBIDDEN);
  });

  it('read-only chat channels: only moderators send', async () => {
    await repo.updateChannel(SEED_IDS.lounge, { readOnly: true });
    expect(await run(SEED_IDS.student, { op: 'sendMessage', channelId: SEED_IDS.lounge, body: 'x' })).toEqual(FORBIDDEN);
    expect((await run(SEED_IDS.alexanderOwner, { op: 'sendMessage', channelId: SEED_IDS.lounge, body: 'x' })).ok).toBe(true);
  });

  it('author or moderator deletes a channel message', async () => {
    expect(await run(SEED_IDS.student, { op: 'deleteMessage', messageId: 'msg-hello' })).toEqual(FORBIDDEN);
    const mine = createdId(await run(SEED_IDS.student, { op: 'sendMessage', channelId: SEED_IDS.lounge, body: 'oops' }));
    expect((await run(SEED_IDS.student, { op: 'deleteMessage', messageId: mine })).ok).toBe(true);
    expect((await run(SEED_IDS.alexanderOwner, { op: 'deleteMessage', messageId: 'msg-hello' })).ok).toBe(true);
    expect(repo.db.messages).toEqual([]);
  });
});

describe('direct messages', () => {
  it('starts one thread per pair and reuses it', async () => {
    const id = createdId(await start(SEED_IDS.student, SEED_IDS.alexanderOwner));
    expect(createdId(await start(SEED_IDS.alexanderOwner, SEED_IDS.student))).toBe(id);
    expect(repo.db.dmThreads).toHaveLength(1);
  });

  it('refuses self, people outside the community and disabled DMs', async () => {
    expect(await start(SEED_IDS.student, SEED_IDS.student)).toEqual(FORBIDDEN);
    expect(await start(SEED_IDS.student, SEED_IDS.assistant)).toEqual(FORBIDDEN);
    await settings({ dmsEnabled: false });
    expect(await start(SEED_IDS.alexanderOwner, SEED_IDS.student)).toEqual(FORBIDDEN);
  });

  it('founder DMs off: members cannot reach the owner, the owner still reaches members', async () => {
    await settings({ founderDms: false });
    expect(await start(SEED_IDS.student, SEED_IDS.alexanderOwner)).toEqual(FORBIDDEN);
    expect((await start(SEED_IDS.alexanderOwner, SEED_IDS.student)).ok).toBe(true);
  });

  it('a group without DMs cannot start threads', async () => {
    await repo.updateAccessGroup(SEED_IDS.members, { dms: false });
    expect(await start(SEED_IDS.student, SEED_IDS.alexanderOwner)).toEqual(FORBIDDEN);
  });

  it('participants send; others get not_found; blocks stop both sides', async () => {
    const threadId = createdId(await start(SEED_IDS.student, SEED_IDS.alexanderOwner));
    expect((await run(SEED_IDS.alexanderOwner, { op: 'sendDm', threadId, body: 'hey' })).ok).toBe(true);
    expect(await run(SEED_IDS.assistant, { op: 'sendDm', threadId, body: 'x' })).toEqual({ ok: false, error: 'not_found' });
    expect((await run(SEED_IDS.student, { op: 'block', communityId: SEED_IDS.community, profileId: SEED_IDS.alexanderOwner, on: true })).ok).toBe(true);
    expect(await run(SEED_IDS.alexanderOwner, { op: 'sendDm', threadId, body: 'x' })).toEqual(FORBIDDEN);
    expect(await run(SEED_IDS.student, { op: 'sendDm', threadId, body: 'x' })).toEqual(FORBIDDEN);
    await run(SEED_IDS.student, { op: 'block', communityId: SEED_IDS.community, profileId: SEED_IDS.alexanderOwner, on: false });
    expect((await run(SEED_IDS.student, { op: 'sendDm', threadId, body: 'ok' })).ok).toBe(true);
  });

  it('only the author deletes a DM', async () => {
    const threadId = createdId(await start(SEED_IDS.student, SEED_IDS.alexanderOwner));
    const id = createdId(await run(SEED_IDS.student, { op: 'sendDm', threadId, body: 'hey' }));
    expect(await run(SEED_IDS.alexanderOwner, { op: 'deleteMessage', messageId: id })).toEqual(FORBIDDEN);
    expect((await run(SEED_IDS.student, { op: 'deleteMessage', messageId: id })).ok).toBe(true);
  });

  it('block refuses non-members', async () => {
    expect(await run(SEED_IDS.student, { op: 'block', communityId: SEED_IDS.community, profileId: SEED_IDS.assistant, on: true })).toMatchObject({
      error: 'invalid',
    });
  });
});
