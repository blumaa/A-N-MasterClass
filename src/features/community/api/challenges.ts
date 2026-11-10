// Challenges (Kajabi gamification): a prompt with a start and end date for one access group.
// Members enter once while it runs and earn points (ledger trigger); they may withdraw while it
// is still open. Upcoming challenges are hidden unless "show before start" is on.
// Deviation from Kajabi: entries are visible to staff only (members see their own).
import type { Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import { toCsv } from '@/lib/csv/csv';
import { ConstraintError } from '@/lib/data/errors';
import type { Repo } from '@/lib/data/repo';
import type { Challenge, ChallengeEntry, Product } from '@/lib/data/types';
import { communityAccess, reachesGroup, type CommunityAccess } from './access';
import { spaceNames } from './feed';
import { authorOf, type Author } from './present';

export type ChallengeState = 'upcoming' | 'open' | 'ended';
export type ChallengeItem = Challenge & {
  state: ChallengeState;
  entryCount: number;
  mine: { body: string; createdAt: Date } | null;
};
export type EntryItem = { author: Author; body: string; createdAt: Date };
export type ChallengePage = { challenge: ChallengeItem; entries: EntryItem[] | null };

export type ChallengeCommand =
  | { op: 'enter'; challengeId: string; body: string }
  | { op: 'withdraw'; challengeId: string };

const OK: CommandResult = { ok: true };
const NOT_FOUND: CommandResult = { ok: false, error: 'not_found' };
const invalid = (message: string): CommandResult => ({ ok: false, error: 'invalid', message });
const STATE_ORDER: Record<ChallengeState, number> = { upcoming: 0, open: 1, ended: 2 };

export const challengeState = (c: Challenge, now: Date): ChallengeState =>
  now < c.startsAt ? 'upcoming' : now > c.endsAt ? 'ended' : 'open';

const visible = (access: CommunityAccess, c: Challenge, now: Date): boolean =>
  access.challenges &&
  reachesGroup(access, c.accessGroupId) &&
  (access.staff || c.showBeforeStart || challengeState(c, now) !== 'upcoming');

const toItem = (c: Challenge, entries: readonly ChallengeEntry[], me: string | undefined, now: Date): ChallengeItem => {
  const mine = entries.find((e) => e.profileId === me);
  return {
    ...c,
    state: challengeState(c, now),
    entryCount: entries.length,
    mine: mine ? { body: mine.body, createdAt: mine.createdAt } : null,
  };
};

export async function challengeList(
  repo: Repo,
  viewer: Viewer,
  community: Product,
  access: CommunityAccess,
  now: Date,
): Promise<ChallengeItem[] | null> {
  if (!access.read || !access.challenges) return null;
  const shown = (await repo.challenges(community.id)).filter((c) => visible(access, c, now));
  const entries = await Promise.all(shown.map((c) => repo.challengeEntries(c.id)));
  return shown
    .map((c, i) => toItem(c, entries[i] ?? [], viewer.profile?.id, now))
    .toSorted((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state]);
}

export async function challengePage(
  repo: Repo,
  viewer: Viewer,
  community: Product,
  access: CommunityAccess,
  challengeId: string,
  now: Date,
): Promise<ChallengePage | null> {
  const c = await repo.challenge(challengeId);
  if (!c || c.communityId !== community.id || !visible(access, c, now)) return null;
  const [entries, names] = await Promise.all([repo.challengeEntries(c.id), spaceNames(repo, community.spaceId)]);
  return {
    challenge: toItem(c, entries, viewer.profile?.id, now),
    entries: access.staff
      ? entries.map((e) => ({ author: authorOf(names, e.profileId), body: e.body, createdAt: e.createdAt }))
      : null,
  };
}

/** Staff download of every entry. */
export const challengeCsv = (entries: readonly EntryItem[]): string =>
  toCsv(
    ['name', 'submitted_at', 'entry'],
    entries.map((e) => [e.author.name, e.createdAt.toISOString(), e.body]),
  );

export async function challengeCommand(
  repo: Repo,
  viewer: Viewer,
  cmd: ChallengeCommand,
  now: Date,
): Promise<CommandResult> {
  const me = viewer.profile?.id;
  const c = await repo.challenge(cmd.challengeId);
  const community = c && (await repo.product(c.communityId));
  if (!me || !c || !community) return NOT_FOUND;
  if (!visible(await communityAccess(repo, viewer, community, now), c, now)) return NOT_FOUND;
  if (challengeState(c, now) !== 'open') return invalid('This challenge is not open.');
  try {
    if (cmd.op === 'withdraw') {
      await repo.deleteChallengeEntry(c.id, me);
      return OK;
    }
    const body = cmd.body.trim();
    if (body.length === 0) return invalid('Write your entry first.');
    await repo.createChallengeEntry({ challengeId: c.id, profileId: me, body, createdAt: now });
    return OK;
  } catch (e) {
    if (e instanceof ConstraintError) return invalid(e.message);
    throw e;
  }
}
