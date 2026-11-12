import { beforeEach, describe, expect, it } from 'vitest';
import { ALREADY_REPORTED, ConstraintError, REPORT_TARGET_MISSING } from '../errors';
import { REPORT_REASON_MAX } from '../limits';
import { createFakeRepo, type FakeRepo } from './fakeRepo';
import { SEED_IDS, seedDb } from './seed';

const NOW = new Date('2026-11-12T12:00:00Z');
const later = (ms: number) => new Date(NOW.getTime() + ms);
let repo: FakeRepo;
let postId: string;

beforeEach(async () => {
  repo = createFakeRepo(seedDb(NOW));
  postId = (await repo.createPost({ channelId: SEED_IDS.general, authorId: SEED_IDS.student, body: 'Hi', createdAt: NOW })).id;
});

const report = (over: Partial<Parameters<FakeRepo['createReport']>[0]> = {}) =>
  repo.createReport({ targetType: 'post', targetId: postId, reporterId: SEED_IDS.student, reason: null, createdAt: NOW, ...over });

describe('channel moderators', () => {
  it('sets and clears idempotently, cascades with the channel', async () => {
    await repo.setChannelModerator(SEED_IDS.general, SEED_IDS.student, true);
    await repo.setChannelModerator(SEED_IDS.general, SEED_IDS.student, true);
    expect(await repo.channelModerators(SEED_IDS.general)).toEqual([SEED_IDS.student]);
    await repo.setChannelModerator(SEED_IDS.general, SEED_IDS.student, false);
    expect(await repo.channelModerators(SEED_IDS.general)).toEqual([]);
    await repo.setChannelModerator(SEED_IDS.general, SEED_IDS.student, true);
    await repo.deleteChannel(SEED_IDS.general);
    expect(repo.db.channelModerators).toEqual([]);
  });
});

describe('reports', () => {
  it('derive channel and community from the target, newest first', async () => {
    await report({ reason: 'spam' });
    const comment = await repo.createComment({
      spaceId: SEED_IDS.alexander,
      targetType: 'post',
      targetId: postId,
      parentId: null,
      authorId: SEED_IDS.student,
      body: 'x',
      createdAt: NOW,
    });
    await report({ targetType: 'comment', targetId: comment.id, createdAt: later(1000) });
    const rows = await repo.reports(SEED_IDS.community);
    expect(rows.map((r) => [r.targetType, r.channelId, r.communityId, r.status])).toEqual([
      ['comment', SEED_IDS.general, SEED_IDS.community, 'open'],
      ['post', SEED_IDS.general, SEED_IDS.community, 'open'],
    ]);
    expect(rows[1]!.reason).toBe('spam');
    expect(await repo.report(rows[0]!.id)).toEqual(rows[0]);
    expect(await repo.reportReporters(SEED_IDS.community)).toEqual({
      [rows[0]!.id]: SEED_IDS.student,
      [rows[1]!.id]: SEED_IDS.student,
    });
  });

  it('once per reporter and target; reason length; target must exist', async () => {
    await report();
    await expect(report()).rejects.toThrow(new ConstraintError(ALREADY_REPORTED));
    await expect(report({ reporterId: SEED_IDS.assistant, reason: 'x'.repeat(REPORT_REASON_MAX + 1) })).rejects.toThrow(
      ConstraintError,
    );
    await expect(report({ reporterId: SEED_IDS.assistant, reason: '  ' })).rejects.toThrow(ConstraintError);
    await expect(report({ targetId: 'nope' })).rejects.toThrow(new ConstraintError(REPORT_TARGET_MISSING));
    const dm = await repo.createDmThread(SEED_IDS.community, SEED_IDS.student, SEED_IDS.assistant);
    const line = await repo.createMessage({ channelId: null, threadId: dm.id, authorId: SEED_IDS.student, body: 'a', createdAt: NOW });
    await expect(report({ targetType: 'message', targetId: line.id })).rejects.toThrow(REPORT_TARGET_MISSING);
  });

  it('resolves open reports only', async () => {
    await report();
    const [open] = await repo.reports(SEED_IDS.community);
    await repo.resolveReports([open!.id], { status: 'dismissed', resolvedBy: SEED_IDS.assistant, resolvedAt: later(1) });
    await repo.resolveReports([open!.id], { status: 'removed', resolvedBy: SEED_IDS.student, resolvedAt: later(2) });
    expect(await repo.report(open!.id)).toMatchObject({ status: 'dismissed', resolvedBy: SEED_IDS.assistant, resolvedAt: later(1) });
  });
});

describe('post approval', () => {
  it('sets and clears idempotently; approval member posts go pending', async () => {
    await repo.setPostApproval(SEED_IDS.community, SEED_IDS.student, true);
    await repo.setPostApproval(SEED_IDS.community, SEED_IDS.student, true);
    expect(await repo.postApprovalMembers(SEED_IDS.community)).toEqual([SEED_IDS.student]);
    const pending = await repo.createPost({ channelId: SEED_IDS.general, authorId: SEED_IDS.student, body: 'p', createdAt: NOW });
    expect(pending).toMatchObject({ status: 'pending', lockedAt: null });
    await repo.setPostApproval(SEED_IDS.community, SEED_IDS.student, false);
    expect(await repo.postApprovalMembers(SEED_IDS.community)).toEqual([]);
    const open = await repo.createPost({ channelId: SEED_IDS.general, authorId: SEED_IDS.student, body: 'p', createdAt: NOW });
    expect(open.status).toBe('published');
  });
});

describe('moderation log', () => {
  it('takes channel and community from the target, newest first', async () => {
    await repo.logModeration({ actorId: SEED_IDS.alexander, action: 'hide', targetType: 'post', targetId: postId, createdAt: NOW });
    await repo.logModeration({ actorId: SEED_IDS.alexander, action: 'unhide', targetType: 'post', targetId: postId, createdAt: later(1000) });
    const rows = await repo.moderationLog(SEED_IDS.community);
    expect(rows.map((r) => [r.action, r.channelId, r.communityId, r.actorId])).toEqual([
      ['unhide', SEED_IDS.general, SEED_IDS.community, SEED_IDS.alexander],
      ['hide', SEED_IDS.general, SEED_IDS.community, SEED_IDS.alexander],
    ]);
  });

  it('target must exist', async () => {
    await expect(
      repo.logModeration({ actorId: SEED_IDS.alexander, action: 'lock', targetType: 'post', targetId: 'nope', createdAt: NOW }),
    ).rejects.toThrow(new ConstraintError(REPORT_TARGET_MISSING));
  });
});
