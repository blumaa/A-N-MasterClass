// Studio side of coaching (G18, G19): coaching products with their program settings, the coach's
// schedule (settings, weekly rules, date overrides), upcoming sessions with client names and
// Google sync state, and session notes. Gate: products.edit (G15). The coach is not bound by the
// client cutoff and may schedule outside the availability; overlap is still refused by the DB.
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import { ConstraintError } from '@/lib/data/errors';
import { spaceNames } from '@/lib/data/names';
import type { NewAvailabilityOverride, NewAvailabilityRule, ProductPatch, Repo } from '@/lib/data/repo';
import type {
  AvailabilityOverride,
  AvailabilityRule,
  CalendarConnection,
  CoachingProgram,
  CoachingSession,
  CoachSettings,
  Product,
} from '@/lib/data/types';
import { defaultCoachSettings, outOfSync, syncToCalendar, usesDefaultHours, type CalendarPort } from './schedule';

const MINUTE_MS = 60_000;

/** Program every new coaching product starts with (Kajabi: one 60 min 1:1 session). */
export const DEFAULT_PROGRAM: Omit<CoachingProgram, 'productId'> = {
  kind: 'one_on_one',
  sessionMinutes: 60,
  sessionsIncluded: 1,
  location: null,
};

export type StudioSession = CoachingSession & { clientName: string | null; outOfSync: boolean };

export type StudioCoaching = {
  products: { product: Product; program: CoachingProgram }[];
  settings: CoachSettings;
  rules: AvailabilityRule[];
  /** No settings saved and no windows: clients see weekdays 9 to 5 (DEFAULT_RULES). */
  defaultHours: boolean;
  overrides: AvailabilityOverride[];
  calendar: CalendarConnection | null;
  /** Connecting a calendar is a space setting (settings.manage). */
  canManageCalendar: boolean;
  upcoming: StudioSession[];
};

export type StudioSessionDetail = { session: StudioSession; product: Product; note: string };

async function present(repo: Repo, spaceId: string, sessions: CoachingSession[]): Promise<StudioSession[]> {
  const [names, calendar] = await Promise.all([spaceNames(repo, spaceId), repo.calendarConnection(spaceId)]);
  return sessions.map((s) => ({
    ...s,
    clientName: s.clientId ? (names.get(s.clientId) ?? null) : null,
    outOfSync: outOfSync(s, calendar !== null),
  }));
}

export async function studioCoaching(repo: Repo, viewer: Viewer, now: Date): Promise<StudioCoaching | null> {
  if (!viewerCan(viewer, 'products.edit')) return null;
  const spaceId = viewer.space.id;
  const [products, stored, rules, overrides, calendar, sessions] = await Promise.all([
    repo.products(spaceId),
    repo.coachSettings(spaceId),
    repo.availabilityRules(spaceId),
    repo.availabilityOverrides(spaceId),
    repo.calendarConnection(spaceId),
    repo.coachingSessions({ spaceId }),
  ]);
  const coaching = products.filter((p) => p.kind === 'coaching');
  const programs = await Promise.all(coaching.map((p) => repo.coachingProgram(p.id)));
  return {
    products: coaching.map((product, i) => ({ product, program: programs[i] ?? { productId: product.id, ...DEFAULT_PROGRAM } })),
    settings: stored ?? defaultCoachSettings(spaceId),
    rules,
    defaultHours: usesDefaultHours(stored, rules),
    overrides,
    calendar,
    canManageCalendar: viewerCan(viewer, 'settings.manage'),
    upcoming: await present(repo, spaceId, sessions.filter((s) => s.status === 'scheduled' && s.endsAt > now)),
  };
}

export async function studioSession(repo: Repo, viewer: Viewer, sessionId: string): Promise<StudioSessionDetail | null> {
  if (!viewerCan(viewer, 'products.edit')) return null;
  const session = await repo.coachingSession(sessionId);
  if (!session || session.spaceId !== viewer.space.id) return null;
  const [product, note, [shown]] = await Promise.all([
    repo.product(session.productId),
    repo.sessionNote(session.id),
    present(repo, viewer.space.id, [session]),
  ]);
  return product && shown ? { session: shown, product, note: note?.body ?? '' } : null;
}

export type CoachingCommand =
  | { op: 'createProgram'; title: string; slug: string }
  | { op: 'updateProduct'; productId: string; patch: Pick<ProductPatch, 'title' | 'subtitle' | 'status'> }
  | ({ op: 'saveProgram' } & CoachingProgram)
  | ({ op: 'saveSettings' } & Omit<CoachSettings, 'spaceId'>)
  | ({ op: 'addRule' } & Omit<NewAvailabilityRule, 'spaceId'>)
  | { op: 'deleteRule'; ruleId: string }
  | ({ op: 'addOverride' } & Omit<NewAvailabilityOverride, 'spaceId'>)
  | { op: 'deleteOverride'; overrideId: string }
  | { op: 'createSession'; productId: string; title: string; startsAt: Date; minutes: number; agenda: string }
  | { op: 'reschedule'; sessionId: string; startsAt: Date }
  | { op: 'cancel'; sessionId: string }
  | { op: 'saveNote'; sessionId: string; body: string }
  | { op: 'syncAgain'; sessionId: string };

const FORBIDDEN: CommandResult = { ok: false, error: 'forbidden' };
const NOT_FOUND: CommandResult = { ok: false, error: 'not_found' };

type Ctx = { repo: Repo; calendar: CalendarPort; spaceId: string; now: Date };

const coachingOf = async (repo: Repo, spaceId: string, productId: string) => {
  const p = await repo.product(productId);
  return p && p.kind === 'coaching' && p.spaceId === spaceId ? p : null;
};
const sessionOf = async (repo: Repo, spaceId: string, sessionId: string) => {
  const s = await repo.coachingSession(sessionId);
  return s && s.spaceId === spaceId ? s : null;
};

/** False when the op targets a row outside the viewer's space (or a missing one). */
async function owns({ repo, spaceId }: Ctx, c: CoachingCommand): Promise<boolean> {
  switch (c.op) {
    case 'createProgram':
    case 'saveSettings':
    case 'addRule':
    case 'addOverride':
      return true;
    case 'updateProduct':
    case 'saveProgram':
    case 'createSession':
      return (await coachingOf(repo, spaceId, c.productId)) !== null;
    case 'deleteRule':
      return (await repo.availabilityRules(spaceId)).some((r) => r.id === c.ruleId);
    case 'deleteOverride':
      return (await repo.availabilityOverrides(spaceId)).some((o) => o.id === c.overrideId);
    case 'reschedule':
    case 'cancel':
    case 'saveNote':
    case 'syncAgain':
      return (await sessionOf(repo, spaceId, c.sessionId)) !== null;
  }
}

async function createSession({ repo, calendar, spaceId, now }: Ctx, c: Extract<CoachingCommand, { op: 'createSession' }>) {
  const program = await repo.coachingProgram(c.productId);
  if (program?.kind !== 'group') throw new ConstraintError('coaches schedule sessions of group programs; 1:1 clients book their own');
  const session = await repo.createCoachingSession({
    productId: c.productId,
    spaceId,
    clientId: null,
    title: c.title.trim(),
    startsAt: c.startsAt,
    endsAt: new Date(c.startsAt.getTime() + c.minutes * MINUTE_MS),
    agenda: c.agenda.trim(),
    location: program.location,
    createdAt: now,
  });
  await syncToCalendar(repo, calendar, session);
  return session.id;
}

async function run(ctx: Ctx, c: CoachingCommand): Promise<string | undefined> {
  const { repo, calendar, spaceId, now } = ctx;
  switch (c.op) {
    case 'createProgram': {
      const product = await repo.createProduct({ spaceId, kind: 'coaching', slug: c.slug, title: c.title });
      await repo.saveCoachingProgram({ productId: product.id, ...DEFAULT_PROGRAM });
      return product.id;
    }
    case 'updateProduct':
      return void (await repo.updateProduct(c.productId, c.patch));
    case 'saveProgram': {
      const { op: _op, ...row } = c;
      return void (await repo.saveCoachingProgram(row));
    }
    case 'saveSettings': {
      const { op: _op, ...row } = c;
      return void (await repo.saveCoachSettings({ ...row, spaceId }));
    }
    case 'addRule': {
      const { op: _op, ...row } = c;
      return (await repo.createAvailabilityRule({ ...row, spaceId })).id;
    }
    case 'deleteRule':
      return void (await repo.deleteAvailabilityRule(c.ruleId));
    case 'addOverride': {
      const { op: _op, ...row } = c;
      return (await repo.createAvailabilityOverride({ ...row, spaceId })).id;
    }
    case 'deleteOverride':
      return void (await repo.deleteAvailabilityOverride(c.overrideId));
    case 'createSession':
      return createSession(ctx, c);
    case 'reschedule': {
      const s = (await repo.coachingSession(c.sessionId))!;
      if (s.status !== 'scheduled') throw new ConstraintError('cancelled sessions cannot be moved');
      const length = s.endsAt.getTime() - s.startsAt.getTime();
      const moved = await repo.updateCoachingSession(s.id, { startsAt: c.startsAt, endsAt: new Date(c.startsAt.getTime() + length) });
      return void (await syncToCalendar(repo, calendar, moved));
    }
    case 'cancel': {
      const s = (await repo.coachingSession(c.sessionId))!;
      if (s.status !== 'scheduled') return;
      return void (await syncToCalendar(repo, calendar, await repo.updateCoachingSession(s.id, { status: 'cancelled', cancelledAt: now })));
    }
    case 'saveNote':
      return void (await repo.saveSessionNote({ sessionId: c.sessionId, body: c.body, updatedAt: now }));
    case 'syncAgain':
      return void (await syncToCalendar(repo, calendar, (await repo.coachingSession(c.sessionId))!));
  }
}

export async function editCoaching(
  repo: Repo,
  viewer: Viewer,
  calendar: CalendarPort,
  c: CoachingCommand,
  now: Date,
): Promise<CommandResult> {
  if (!viewer.profile || !viewerCan(viewer, 'products.edit')) return FORBIDDEN;
  const ctx: Ctx = { repo, calendar, spaceId: viewer.space.id, now };
  if (!(await owns(ctx, c))) return NOT_FOUND;
  try {
    return { ok: true, id: await run(ctx, c) };
  } catch (e) {
    if (e instanceof ConstraintError) return { ok: false, error: 'invalid', message: e.message };
    throw e;
  }
}
