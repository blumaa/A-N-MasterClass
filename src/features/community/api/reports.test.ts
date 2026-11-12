import { beforeEach, describe, expect, it } from 'vitest';
import { resolveViewer } from '@/lib/auth/viewer';
import { createFakeRepo, type FakeRepo } from '@/lib/data/fake/fakeRepo';
import { SEED_IDS, seedDb } from '@/lib/data/fake/seed';
import { createFakeFileStore } from '@/lib/storage/fileStore';
import { reportCommand, reportQueue, type ReportCommand } from './reports';

const NOW = new Date('2026-11-12T12:00:00Z');
const FORBIDDEN = { ok: false, error: 'forbidden' };
const NOT_FOUND = { ok: false, error: 'not_found' };
let repo: FakeRepo;
let post: string;
let comment: string;

const viewer = async (who: string | null, space = 'alexander') => (await resolveViewer(repo, space, who))!;
const run = async (who: string | null, cmd: ReportCommand, space = 'alexander') =>
  reportCommand(repo, createFakeFileStore(), await viewer(who, space), cmd, NOW);
const report = (who: string, targetType: 'post' | 'comment' | 'message', targetId: string, reason: string | null = null) =>
  run(who, { op: 'report', targetType, targetId, reason });
const community = async () => (await repo.product(SEED_IDS.community))!;
const queue = async (who: string) => reportQueue(repo, await viewer(who), await community(), NOW);

beforeEach(async () => {
  repo = createFakeRepo(seedDb(NOW));
  await repo.setCommunityStaff(SEED_IDS.community, SEED_IDS.assistant, true);
  post = (await repo.createPost({ channelId: SEED_IDS.general, authorId: SEED_IDS.alexanderOwner, body: 'Hi @[Sam](user-assistant)', createdAt: NOW })).id;
  comment = (
    await repo.createComment({
      spaceId: SEED_IDS.alexander,
      targetType: 'post',
      targetId: post,
      parentId: null,
      authorId: SEED_IDS.alexanderOwner,
      body: 'A comment',
      createdAt: NOW,
    })
  ).id;
});

describe('report', () => {
  it('members report what they read, once; reason optional and trimmed', async () => {
    expect(await report(SEED_IDS.student, 'post', post, '  spam  ')).toEqual({ ok: true });
    expect(await report(SEED_IDS.student, 'comment', comment, '   ')).toEqual({ ok: true });
    expect(await report(SEED_IDS.student, 'message', 'msg-hello')).toEqual({ ok: true });
    expect(repo.db.reports.map((r) => [r.targetType, r.reason])).toEqual([
      ['post', 'spam'],
      ['comment', null],
      ['message', null],
    ]);
    expect(await report(SEED_IDS.student, 'post', post)).toMatchObject({ ok: false, error: 'invalid' });
    expect(await report(SEED_IDS.student, 'post', 'nope')).toEqual(NOT_FOUND);
  });

  it('refuses own content, signed-out viewers, other spaces, unreadable content', async () => {
    expect(await report(SEED_IDS.alexanderOwner, 'post', post)).toEqual(FORBIDDEN);
    expect(await run(null, { op: 'report', targetType: 'post', targetId: post, reason: null })).toEqual(FORBIDDEN);
    expect(await run(SEED_IDS.natashaOwner, { op: 'report', targetType: 'post', targetId: post, reason: null }, 'natasha')).toEqual(NOT_FOUND);
    await repo.updatePost(post, { hiddenAt: NOW });
    expect(await report(SEED_IDS.student, 'post', post)).toEqual(NOT_FOUND);
    expect(await report(SEED_IDS.student, 'comment', comment)).toEqual(NOT_FOUND);
    const dm = await repo.createDmThread(SEED_IDS.community, SEED_IDS.student, SEED_IDS.alexanderOwner);
    const line = await repo.createMessage({ channelId: null, threadId: dm.id, authorId: SEED_IDS.alexanderOwner, body: 'a', createdAt: NOW });
    expect(await report(SEED_IDS.student, 'message', line.id)).toEqual(NOT_FOUND);
  });

  it('pending posts are not reportable by members who cannot see them', async () => {
    await repo.updatePost(post, { status: 'pending' });
    expect(await report(SEED_IDS.student, 'post', post)).toEqual(NOT_FOUND);
    expect(await report(SEED_IDS.assistant, 'post', post)).toEqual({ ok: true });
  });

  it('notifies everyone who moderates the channel, not the reporter', async () => {
    const reportsOf = () => repo.db.notifications.map((n) => [n.recipientId, n.type, n.communityId, n.postId]);
    await report(SEED_IDS.student, 'post', post);
    expect(reportsOf()).toEqual([
      [SEED_IDS.alexanderOwner, 'report', SEED_IDS.community, null],
      [SEED_IDS.assistant, 'report', SEED_IDS.community, null],
    ]);
    repo.db.notifications.length = 0;
    await repo.setChannelModerator(SEED_IDS.general, SEED_IDS.student, true);
    await report(SEED_IDS.assistant, 'comment', comment);
    expect(reportsOf().map(([who]) => who)).toEqual([SEED_IDS.alexanderOwner, SEED_IDS.student]);
    repo.db.notifications.length = 0;
    await repo.setCommunityStaff(SEED_IDS.community, SEED_IDS.assistant, false);
    await report(SEED_IDS.student, 'message', 'msg-hello');
    expect(reportsOf().map(([who]) => who)).toEqual([SEED_IDS.alexanderOwner]);
  });
});

describe('resolve', () => {
  const firstId = () => repo.db.reports[0]!.id;

  it('dismiss keeps the content and signs the report', async () => {
    await report(SEED_IDS.student, 'post', post);
    expect(await run(SEED_IDS.student, { op: 'resolveReport', reportId: firstId(), action: 'dismiss' })).toEqual(FORBIDDEN);
    expect(await run(SEED_IDS.assistant, { op: 'resolveReport', reportId: firstId(), action: 'dismiss' })).toEqual({ ok: true });
    expect(await repo.post(post)).not.toBeNull();
    expect(repo.db.reports[0]).toMatchObject({ status: 'dismissed', resolvedBy: SEED_IDS.assistant, resolvedAt: NOW });
    expect(await run(SEED_IDS.assistant, { op: 'resolveReport', reportId: firstId(), action: 'remove' })).toMatchObject({
      error: 'invalid',
    });
  });

  it('remove deletes the content and closes every open report on it', async () => {
    await report(SEED_IDS.student, 'message', 'msg-hello');
    await report(SEED_IDS.assistant, 'message', 'msg-hello');
    await repo.setChannelModerator(SEED_IDS.lounge, SEED_IDS.student, true);
    expect(await run(SEED_IDS.student, { op: 'resolveReport', reportId: firstId(), action: 'remove' })).toEqual({ ok: true });
    expect(await repo.message('msg-hello')).toBeNull();
    expect(repo.db.reports.map((r) => [r.status, r.resolvedBy])).toEqual([
      ['removed', SEED_IDS.student],
      ['removed', SEED_IDS.student],
    ]);
  });

  it('hide keeps the content for moderators, logs it and closes every open report on it', async () => {
    await report(SEED_IDS.student, 'post', post);
    await report(SEED_IDS.assistant, 'post', post);
    await report(SEED_IDS.student, 'comment', comment);
    expect(await run(SEED_IDS.assistant, { op: 'resolveReport', reportId: firstId(), action: 'hide' })).toEqual({ ok: true });
    expect((await repo.post(post))?.hiddenAt).toEqual(NOW);
    expect(repo.db.reports.map((r) => r.status)).toEqual(['hidden', 'hidden', 'open']);
    expect(await run(SEED_IDS.assistant, { op: 'resolveReport', reportId: repo.db.reports[2]!.id, action: 'hide' })).toEqual({ ok: true });
    expect((await repo.comment(comment))?.hiddenAt).toEqual(NOW);
    expect(repo.db.moderationLog.map((l) => [l.actorId, l.action, l.targetType])).toEqual([
      [SEED_IDS.assistant, 'hide', 'post'],
      [SEED_IDS.assistant, 'hide', 'comment'],
    ]);
  });

  it('chat lines cannot be hidden, only removed', async () => {
    await report(SEED_IDS.student, 'message', 'msg-hello');
    expect(await run(SEED_IDS.assistant, { op: 'resolveReport', reportId: firstId(), action: 'hide' })).toMatchObject({ error: 'invalid' });
    expect(repo.db.reports[0]!.status).toBe('open');
  });

  it('channel moderators resolve reports of their channels only', async () => {
    await report(SEED_IDS.student, 'post', post);
    await repo.setChannelModerator(SEED_IDS.lounge, SEED_IDS.student, true);
    expect(await run(SEED_IDS.student, { op: 'resolveReport', reportId: firstId(), action: 'dismiss' })).toEqual(FORBIDDEN);
    expect(await run(SEED_IDS.student, { op: 'resolveReport', reportId: 'nope', action: 'dismiss' })).toEqual(NOT_FOUND);
  });
});

describe('reportQueue', () => {
  it('staff see every channel, previews and reporters; resolved reports stay', async () => {
    await report(SEED_IDS.student, 'post', post, 'spam');
    await report(SEED_IDS.student, 'message', 'msg-hello');
    await run(SEED_IDS.assistant, { op: 'resolveReport', reportId: repo.db.reports[1]!.id, action: 'remove' });
    const q = (await queue(SEED_IDS.assistant))!;
    expect(q.reporters).toBe(true);
    expect(q.open).toEqual([
      expect.objectContaining({
        targetType: 'post',
        channel: 'General',
        preview: { author: 'Alexander', body: 'Hi @Sam' },
        reason: 'spam',
        reporter: 'Robin (student)',
        href: `/community/community/posts/${post}`,
      }),
    ]);
    expect(q.resolved).toEqual([
      expect.objectContaining({ targetType: 'message', preview: null, status: 'removed', resolvedBy: 'Sam (assistant)' }),
    ]);
  });

  it('channel moderators see their channels, never the reporter; members get no queue', async () => {
    await report(SEED_IDS.student, 'post', post);
    await report(SEED_IDS.alexanderOwner, 'message', 'msg-hello');
    expect(await queue(SEED_IDS.student)).toBeNull();
    await repo.setChannelModerator(SEED_IDS.general, SEED_IDS.student, true);
    const q = (await queue(SEED_IDS.student))!;
    expect(q.reporters).toBe(false);
    expect(q.open.map((r) => [r.targetType, r.reporter])).toEqual([['post', null]]);
  });
});
