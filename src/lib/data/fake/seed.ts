// Dev seed for DATA_SOURCE=fake. Two spaces, staff of each role, one student with a grant,
// a program tree showing every access state (open, step-locked, drip, fixed date).
import { emptyDb, type Db } from './db';

const DAY = 86_400_000;

export const SEED_IDS = {
  alexander: 'space-alexander',
  natasha: 'space-natasha',
  alexanderOwner: 'user-alexander',
  natashaOwner: 'user-natasha',
  assistant: 'user-assistant',
  student: 'user-student',
  program: 'prod-shibari-101',
} as const;

export function seedDb(now: Date = new Date()): Db {
  const db = emptyDb();
  const ids = SEED_IDS;

  db.spaces.push(
    { id: ids.alexander, slug: 'alexander', name: 'Alexander', status: 'live', locale: 'en' },
    { id: ids.natasha, slug: 'natasha', name: 'Natasha', status: 'live', locale: 'en' },
  );
  db.profiles.push(
    { id: ids.alexanderOwner, email: 'alexander@example.test', isPlatformAdmin: false },
    { id: ids.natashaOwner, email: 'natasha@example.test', isPlatformAdmin: false },
    { id: ids.assistant, email: 'assistant@example.test', isPlatformAdmin: false },
    { id: ids.student, email: 'student@example.test', isPlatformAdmin: false },
  );
  db.spaceProfiles.push(
    { spaceId: ids.alexander, profileId: ids.alexanderOwner, displayName: 'Alexander' },
    { spaceId: ids.alexander, profileId: ids.assistant, displayName: 'Sam (assistant)' },
    { spaceId: ids.alexander, profileId: ids.student, displayName: 'Robin (student)' },
    { spaceId: ids.natasha, profileId: ids.natashaOwner, displayName: 'Natasha' },
    { spaceId: ids.natasha, profileId: ids.student, displayName: 'Robin (student)' },
  );
  db.members.push(
    { spaceId: ids.alexander, profileId: ids.alexanderOwner, role: 'owner' },
    { spaceId: ids.alexander, profileId: ids.assistant, role: 'assistant' },
    { spaceId: ids.natasha, profileId: ids.natashaOwner, role: 'owner' },
  );

  db.products.push(
    {
      id: ids.program,
      spaceId: ids.alexander,
      kind: 'program',
      slug: 'shibari-101',
      title: 'Shibari 101',
      subtitle: 'Foundations, safety, first ties',
      status: 'published',
      position: 0,
    },
    {
      id: 'prod-floor-work',
      spaceId: ids.natasha,
      kind: 'program',
      slug: 'floor-work',
      title: 'Floor Work',
      subtitle: null,
      status: 'published',
      position: 0,
    },
  );

  const mod = (id: string, title: string, position: number, extra: Partial<Db['modules'][number]> = {}) => ({
    id,
    programId: ids.program,
    title,
    description: null,
    position,
    status: 'published' as const,
    unlockAfterStepId: null,
    releaseAfterDays: null,
    releaseAt: null,
    ...extra,
  });
  db.modules.push(
    mod('mod-welcome', 'Welcome', 0),
    mod('mod-basics', 'Basics', 1, { unlockAfterStepId: 'step-safety' }),
    mod('mod-week2', 'Week two', 2, { releaseAfterDays: 7 }),
    mod('mod-live', 'Live session replay', 3, { releaseAt: new Date(now.getTime() + 30 * DAY) }),
  );

  const step = (id: string, moduleId: string, title: string, position: number) => ({
    id,
    moduleId,
    title,
    description: null,
    position,
    status: 'published' as const,
  });
  db.steps.push(
    step('step-intro', 'mod-welcome', 'Introduction', 0),
    step('step-safety', 'mod-welcome', 'Safety first', 1),
    step('step-single-column', 'mod-basics', 'Single column tie', 0),
    step('step-double-column', 'mod-basics', 'Double column tie', 1),
    step('step-week2', 'mod-week2', 'Putting it together', 0),
    step('step-replay', 'mod-live', 'Replay', 0),
  );

  const part = (id: string, stepId: string, position: number, extra: Partial<Db['parts'][number]>) => ({
    id,
    stepId,
    kind: 'text' as const,
    title: null,
    position,
    text: null,
    vimeoId: null,
    aspect: null,
    filePath: null,
    ...extra,
  });
  db.parts.push(
    part('part-intro-video', 'step-intro', 0, { kind: 'video', title: 'Welcome', vimeoId: '76979871', aspect: 16 / 9 }),
    part('part-intro-text', 'step-intro', 1, { text: 'Welcome to Shibari 101. Watch the video, then tick Complete & Continue.' }),
    part('part-safety-text', 'step-safety', 0, { text: 'Always keep safety shears within reach.' }),
    part('part-safety-pdf', 'step-safety', 1, { kind: 'download', title: 'Safety checklist (PDF)', filePath: 'shibari-101/safety.pdf' }),
    part('part-single', 'step-single-column', 0, { text: 'Single column tie walkthrough.' }),
  );

  db.grants.push({
    id: 'grant-student-101',
    productId: ids.program,
    profileId: ids.student,
    source: 'manual',
    status: 'active',
    grantedAt: new Date(now.getTime() - 2 * DAY),
    expiresAt: null,
  });

  return db;
}
