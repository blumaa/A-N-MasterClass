// Moderation Supabase repo against the linked project. Service client for data (RLS is covered by
// 130-moderation.test.sql). report_reporters reads auth.uid(), so that check signs in as the owner.
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabasePublic } from '@/config/supabase';
import { ALREADY_REPORTED, ConstraintError, REPORT_TARGET_MISSING } from '@/lib/data/errors';
import type { NewReport } from '@/lib/data/repo';
import type { Database } from '@/lib/db/database.types';
import { createChatRepo } from './chat';
import { createCommunityRepo, type CommunityRepo } from './community';
import { createCoreRepo } from './core';
import { createModerationRepo, type ModerationRepo } from './moderation';
import { contractEnabled, createContractSpace, type ContractSpace } from './testing/contractSpace';

const T0 = new Date('2026-01-01T10:00:00Z');
const at = (s: number) => new Date(T0.getTime() + s * 1000);

describe.skipIf(!contractEnabled)('moderation repo (Supabase contract)', () => {
  let fx: ContractSpace;
  let repo: ModerationRepo;
  let community: CommunityRepo;
  let communityId: string;
  let feedId: string;
  let chatId: string;
  let postId: string;
  let owner: string, student: string;

  const report = (over: Partial<NewReport> = {}) =>
    repo.createReport({ targetType: 'post', targetId: postId, reporterId: student, reason: null, createdAt: T0, ...over });

  beforeAll(async () => {
    fx = await createContractSpace('moderation');
    const ctx = { db: async () => fx.admin, admin: () => fx.admin };
    repo = createModerationRepo(ctx);
    community = createCommunityRepo(ctx);
    [owner, student] = await Promise.all([fx.newUser('owner'), fx.newUser('student')]);
    const ins = await fx.admin.from('space_members').insert({ space_id: fx.spaceId, profile_id: owner, role: 'owner' });
    if (ins.error) throw ins.error;
    communityId = (await createCoreRepo(ctx).createProduct({ spaceId: fx.spaceId, kind: 'community', slug: 'mod-c', title: 'C' })).id;
    const groupId = (await community.accessGroups(communityId))[0]!.id;
    const mk = (title: string, kind: 'feed' | 'chat') =>
      community
        .createChannel({ communityId, accessGroupId: groupId, title, kind, privacy: 'public', readOnly: false })
        .then((c) => c.id);
    feedId = await mk('feed', 'feed');
    chatId = await mk('chat', 'chat');
    postId = (await community.createPost({ channelId: feedId, authorId: student, body: 'p', createdAt: T0 })).id;
  });

  afterAll(async () => {
    await fx?.cleanup();
  });

  it('sets and clears channel moderators idempotently', async () => {
    await repo.setChannelModerator(feedId, student, true);
    await repo.setChannelModerator(feedId, student, true);
    expect(await repo.channelModerators(feedId)).toEqual([student]);
    await repo.setChannelModerator(feedId, student, false);
    expect(await repo.channelModerators(feedId)).toEqual([]);
  });

  it('creates reports with channel and community from the target, newest first', async () => {
    await report({ reason: 'spam' });
    const line = await createChatRepo({ db: async () => fx.admin, admin: () => fx.admin }).createMessage({
      channelId: chatId,
      threadId: null,
      authorId: student,
      body: 'm',
      createdAt: T0,
    });
    await report({ targetType: 'message', targetId: line.id, createdAt: at(5) });
    const rows = await repo.reports(communityId);
    expect(rows.map((r) => [r.targetType, r.channelId, r.communityId, r.status, r.reason])).toEqual([
      ['message', chatId, communityId, 'open', null],
      ['post', feedId, communityId, 'open', 'spam'],
    ]);
    expect(await repo.report(rows[1]!.id)).toEqual(rows[1]);
    expect(await repo.report(randomUUID())).toBeNull();
  });

  it('maps duplicate, reason and missing-target errors', async () => {
    await expect(report()).rejects.toThrow(new ConstraintError(ALREADY_REPORTED));
    await expect(report({ reporterId: owner, reason: 'x'.repeat(501) })).rejects.toThrow(ConstraintError);
    await expect(report({ targetId: randomUUID() })).rejects.toThrow(new ConstraintError(REPORT_TARGET_MISSING));
  });

  it('resolves open reports only', async () => {
    const [first] = await repo.reports(communityId);
    await repo.resolveReports([first!.id], { status: 'dismissed', resolvedBy: owner, resolvedAt: at(10) });
    await repo.resolveReports([first!.id], { status: 'removed', resolvedBy: student, resolvedAt: at(20) });
    expect(await repo.report(first!.id)).toMatchObject({ status: 'dismissed', resolvedBy: owner, resolvedAt: at(10) });
    await repo.resolveReports([], { status: 'removed', resolvedBy: owner, resolvedAt: at(30) });
  });

  it('reportReporters: empty without a caller, filled for the signed-in owner', async () => {
    expect(await repo.reportReporters(communityId)).toEqual({});
    const password = randomUUID();
    const upd = await fx.admin.auth.admin.updateUserById(owner, { password });
    if (upd.error) throw upd.error;
    const { url, publishableKey } = supabasePublic();
    const client = createClient<Database>(url, publishableKey, { auth: { persistSession: false } });
    const signed = await client.auth.signInWithPassword({ email: fx.email('owner'), password });
    if (signed.error) throw signed.error;
    const asOwner = createModerationRepo({ db: async () => client, admin: () => fx.admin });
    const rows = await asOwner.reports(communityId);
    expect(rows).toHaveLength(2);
    expect(await asOwner.reportReporters(communityId)).toEqual(Object.fromEntries(rows.map((r) => [r.id, student])));
  });
});
