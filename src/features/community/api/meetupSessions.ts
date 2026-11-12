// Studio side of one meetup's occurrences (Launch 6 item 8, Kajabi "Edit event" / "Cancel event"
// on a repeating meetup): list them with RSVP counts, and edit or cancel with a scope.
//   this      = only this occurrence (stored in meetup_occurrences)
//   following = split the series here (split_meetup), then change the new series
//   all       = change the series; "all" overwrites the same fields edited per occurrence
// A one-off meetup has no scopes: edits change it, cancelling deletes it. A replay always belongs
// to its own occurrence. Callers check access first (studioEvents.editEvents).
import { movedSeries, nearOccurrences, occurrenceKey, occurrenceOf, type Occurrence, type Window } from '@/lib/calendar/recurrence';
import { ConstraintError, OCCURRENCE_MISSING } from '@/lib/data/errors';
import type { MeetupPatch, Repo } from '@/lib/data/repo';
import type { Meetup, MeetupOccurrence } from '@/lib/data/types';

export const SESSION_SCOPES = ['this', 'following', 'all'] as const;
export type SessionScope = (typeof SESSION_SCOPES)[number];
/** Times come as a pair (the form parser posts both or neither). */
export type OccurrencePatch = {
  title?: string;
  description?: string;
  startsAt?: Date;
  endsAt?: Date;
  replayVimeoId?: string | null;
};
export type OccurrenceCommand =
  | { op: 'editOccurrence'; meetupId: string; occurrence: number; scope: SessionScope; patch: OccurrencePatch }
  | { op: 'cancelOccurrence'; meetupId: string; occurrence: number; scope: SessionScope };

export type StudioSession = Occurrence & { key: string; rsvpCount: number };
/** Studio listing bound per series. */
const PAST = 5;
const UPCOMING = 20;

export async function meetupSessions(repo: Repo, m: Meetup, now: Date): Promise<{ past: StudioSession[]; upcoming: StudioSession[] }> {
  const [edits, rsvps] = await Promise.all([repo.meetupOccurrences(m.id), repo.meetupRsvps(m.id)]);
  const near = nearOccurrences(m, now, PAST, UPCOMING);
  const session = (n: number): StudioSession => ({
    ...occurrenceOf(
      m,
      n,
      edits.find((e) => e.occurrence === n),
    )!,
    key: occurrenceKey(m.id, n),
    rsvpCount: rsvps.filter((r) => r.occurrence === n).length,
  });
  return { past: near.past.map(session), upcoming: near.upcoming.map(session) };
}

const blank = (meetupId: string, occurrence: number): MeetupOccurrence => ({
  meetupId,
  occurrence,
  cancelled: false,
  title: null,
  description: null,
  startsAt: null,
  endsAt: null,
  replayVimeoId: null,
});

async function editOf(repo: Repo, m: Meetup, n: number): Promise<MeetupOccurrence> {
  const edit = (await repo.meetupOccurrences(m.id)).find((e) => e.occurrence === n);
  const o = occurrenceOf(m, n, edit);
  if (!o || o.cancelled) throw new ConstraintError(OCCURRENCE_MISSING);
  return edit ?? blank(m.id, n);
}

/** Occurrence 0 keeps the series replay (one-offs too); later ones store their own. */
async function setReplay(repo: Repo, m: Meetup, n: number, replayVimeoId: string | null): Promise<void> {
  const edit = await editOf(repo, m, n);
  if (n > 0 || edit.replayVimeoId !== null) await repo.setMeetupOccurrence({ ...edit, replayVimeoId: n > 0 ? replayVimeoId : null });
  if (n === 0) await repo.updateMeetup(m.id, { replayVimeoId });
}

const sameTimes = (a: { startsAt?: Date; endsAt?: Date }, b: Window) =>
  a.startsAt?.getTime() === b.startsAt.getTime() && a.endsAt?.getTime() === b.endsAt.getTime();

/** The edit form posts every field: keep only those that differ from `o`. */
function changed(p: OccurrencePatch, o: Occurrence): OccurrencePatch {
  return {
    ...(p.title !== undefined && p.title !== o.title && { title: p.title }),
    ...(p.description !== undefined && p.description !== o.description && { description: p.description }),
    ...(p.replayVimeoId !== undefined && p.replayVimeoId !== o.replayVimeoId && { replayVimeoId: p.replayVimeoId }),
    ...(p.startsAt && p.endsAt && !sameTimes(p, o) && { startsAt: p.startsAt, endsAt: p.endsAt }),
  };
}

/** Stores the fields as overrides; a value equal to the series one clears its override. */
async function editThis(repo: Repo, m: Meetup, n: number, patch: OccurrencePatch): Promise<void> {
  const { replayVimeoId, startsAt, endsAt, ...text } = patch;
  const edit = await editOf(repo, m, n);
  const base = occurrenceOf(m, n, undefined)!;
  const rest: Partial<MeetupOccurrence> = {
    ...(text.title !== undefined && { title: text.title === base.title ? null : text.title }),
    ...(text.description !== undefined && { description: text.description === base.description ? null : text.description }),
    ...(startsAt && endsAt && (sameTimes({ startsAt, endsAt }, base) ? { startsAt: null, endsAt: null } : { startsAt, endsAt })),
  };
  if (Object.keys(rest).length > 0) await repo.setMeetupOccurrence({ ...edit, ...rest });
  if (replayVimeoId !== undefined) await setReplay(repo, m, n, replayVimeoId);
}

async function editAll(repo: Repo, m: Meetup, n: number, patch: OccurrencePatch): Promise<void> {
  const { replayVimeoId, startsAt, endsAt, ...text } = patch;
  await editOf(repo, m, n);
  const series: MeetupPatch = { ...text };
  if (startsAt && endsAt) Object.assign(series, movedSeries(m, n, { startsAt, endsAt }));
  if (Object.keys(series).length > 0) await repo.updateMeetup(m.id, series);
  const cleared: Partial<MeetupOccurrence> = {
    ...(text.title !== undefined && { title: null }),
    ...(text.description !== undefined && { description: null }),
    ...(startsAt && { startsAt: null, endsAt: null }),
  };
  if (Object.keys(cleared).length > 0) {
    for (const e of await repo.meetupOccurrences(m.id)) await repo.setMeetupOccurrence({ ...e, ...cleared });
  }
  if (replayVimeoId !== undefined) await setReplay(repo, (await repo.meetup(m.id))!, n, replayVimeoId);
}

/** Returns the id of the series that now holds the occurrence. */
export async function runOccurrenceCommand(repo: Repo, c: OccurrenceCommand): Promise<string> {
  const m = await repo.meetup(c.meetupId);
  if (!m) throw new ConstraintError(OCCURRENCE_MISSING);
  const scope: SessionScope = !m.repeat ? 'all' : c.scope === 'following' && c.occurrence === 0 ? 'all' : c.scope;
  if (c.op === 'cancelOccurrence') {
    if (scope === 'this') await repo.setMeetupOccurrence({ ...(await editOf(repo, m, c.occurrence)), cancelled: true });
    else await repo.deleteMeetup(scope === 'all' ? m.id : (await repo.splitMeetup(m.id, c.occurrence)).id);
    return m.id;
  }
  const patch = changed(c.patch, occurrenceOf(m, c.occurrence, await editOf(repo, m, c.occurrence))!);
  if (scope === 'this') await editThis(repo, m, c.occurrence, patch);
  if (scope === 'all') await editAll(repo, m, c.occurrence, patch);
  if (scope !== 'following') return m.id;
  const next = await repo.splitMeetup(m.id, c.occurrence);
  await editAll(repo, next, 0, patch);
  return next.id;
}
