// Points ledger for the fake repo. Stands in for the SQL triggers in
// supabase/migrations/*_community_gamification_meetups.sql: award after a source row is
// inserted, drop ledger rows whose source is gone after any delete.
import type { Repo } from '../repo';
import { DEFAULT_COMMUNITY_SETTINGS, DEFAULT_POINT_VALUES, type PointReason, type PointsEntry } from '../types';
import type { Db } from './db';

/** Ledger key of a reaction received: one per (post, reactor). */
export const receivedKey = (postId: string, reactorId: string): string => `${postId}:${reactorId}`;

export function withPoints<R extends Repo>(db: Db, repo: R): R {
  const communityOfPost = (postId: string): string | undefined => {
    const post = db.posts.find((p) => p.id === postId);
    return post && db.channels.find((c) => c.id === post.channelId)?.communityId;
  };

  function award(communityId: string | undefined, profileId: string, reason: PointReason, sourceKey: string, createdAt: Date): void {
    if (!communityId) return;
    const settings = db.communitySettings.find((s) => s.communityId === communityId) ?? DEFAULT_COMMUNITY_SETTINGS;
    const points = settings.pointValues[reason] ?? DEFAULT_POINT_VALUES[reason];
    if (!settings.pointsEnabled || points <= 0) return;
    if (db.pointsLedger.some((e) => e.reason === reason && e.sourceKey === sourceKey && e.profileId === profileId)) return;
    db.pointsLedger.push({ communityId, profileId, reason, sourceKey, points, createdAt });
  }

  const reacted = (postId: string, profileId: string): boolean =>
    db.reactions.some((r) => r.targetType === 'post' && r.targetId === postId && r.profileId === profileId);

  const sourceExists: Record<PointReason, (e: PointsEntry) => boolean> = {
    comment: (e) => db.comments.some((c) => c.id === e.sourceKey),
    reaction_given: (e) => reacted(e.sourceKey, e.profileId),
    reaction_received: (e) => {
      const cut = e.sourceKey.lastIndexOf(':');
      return reacted(e.sourceKey.slice(0, cut), e.sourceKey.slice(cut + 1));
    },
    dm: (e) => db.messages.some((m) => m.id === e.sourceKey),
    challenge: (e) => db.challengeEntries.some((x) => x.challengeId === e.sourceKey && x.profileId === e.profileId),
  };
  const prune = (): void => {
    db.pointsLedger = db.pointsLedger.filter((e) => sourceExists[e.reason](e));
  };

  const after =
    <A extends unknown[], T>(fn: (...args: A) => Promise<T>, then: (result: T, ...args: A) => void) =>
    async (...args: A): Promise<T> => {
      const result = await fn(...args);
      then(result, ...args);
      return result;
    };

  const deletes = Object.fromEntries(
    Object.entries(repo)
      .filter(([name]) => name.startsWith('delete'))
      .map(([name, fn]) => [name, after(fn as (...a: unknown[]) => Promise<unknown>, prune)]),
  );

  return {
    ...repo,
    ...deletes,
    createComment: after(repo.createComment, (c) => {
      if (c.targetType === 'post') award(communityOfPost(c.targetId), c.authorId, 'comment', c.id, c.createdAt);
    }),
    setReaction: after(repo.setReaction, (_, row, on) => {
      if (!on) return prune();
      if (row.targetType !== 'post') return;
      const post = db.posts.find((p) => p.id === row.targetId);
      if (!post || post.authorId === row.profileId) return;
      const communityId = communityOfPost(post.id);
      award(communityId, row.profileId, 'reaction_given', post.id, row.createdAt);
      award(communityId, post.authorId, 'reaction_received', receivedKey(post.id, row.profileId), row.createdAt);
    }),
    createMessage: after(repo.createMessage, (m) => {
      if (m.threadId === null) return;
      award(db.dmThreads.find((t) => t.id === m.threadId)?.communityId, m.authorId, 'dm', m.id, m.createdAt);
    }),
    createChallengeEntry: after(repo.createChallengeEntry, (_, row) => {
      award(db.challenges.find((c) => c.id === row.challengeId)?.communityId, row.profileId, 'challenge', row.challengeId, row.createdAt);
    }),
  };
}
