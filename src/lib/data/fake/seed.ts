// Dev seed for DATA_SOURCE=fake. Two spaces, staff of each role, one student with a grant,
// a program tree showing every access state (open, step-locked, drip, fixed date).
import { DEFAULT_RULES } from '@/lib/scheduling/slots';
import { ALL_GROUP_FEATURES, type Channel } from '../types';
import { emptyDb, type Db } from './db';

const DAY = 86_400_000;

export const SEED_IDS = {
  alexander: 'space-alexander',
  natasha: 'space-natasha',
  alexanderOwner: 'user-alexander',
  natashaOwner: 'user-natasha',
  assistant: 'user-assistant',
  student: 'user-student',
  platformAdmin: 'user-platform',
  program: 'prod-shibari-101',
  community: 'prod-community',
  general: 'chan-general',
  announcements: 'chan-announcements',
  lounge: 'chan-lounge',
  members: 'group-members',
  coaching: 'prod-coaching',
  podcast: 'prod-podcast',
  downloads: 'prod-downloads',
} as const;

export function seedDb(now: Date = new Date()): Db {
  const db = emptyDb();
  const ids = SEED_IDS;

  db.spaces.push(
    { id: ids.alexander, slug: 'alexander', name: 'Alexander', status: 'live', locale: 'en', isTest: false },
    { id: ids.natasha, slug: 'natasha', name: 'Natasha', status: 'live', locale: 'en', isTest: false },
  );
  db.profiles.push(
    { id: ids.alexanderOwner, email: 'alexander@example.test', isPlatformAdmin: false },
    { id: ids.natashaOwner, email: 'natasha@example.test', isPlatformAdmin: false },
    { id: ids.assistant, email: 'assistant@example.test', isPlatformAdmin: false },
    { id: ids.student, email: 'student@example.test', isPlatformAdmin: false },
    // Platform admin owns no space; signs in on the platform host only.
    { id: ids.platformAdmin, email: 'platform@example.test', isPlatformAdmin: true },
  );
  db.spaceProfiles.push(
    { spaceId: ids.alexander, profileId: ids.alexanderOwner, displayName: 'Alexander', avatarPath: null, bio: null },
    { spaceId: ids.alexander, profileId: ids.assistant, displayName: 'Sam (assistant)', avatarPath: null, bio: null },
    { spaceId: ids.alexander, profileId: ids.student, displayName: 'Robin (student)', avatarPath: null, bio: null },
    { spaceId: ids.natasha, profileId: ids.natashaOwner, displayName: 'Natasha', avatarPath: null, bio: null },
    { spaceId: ids.natasha, profileId: ids.student, displayName: 'Robin (student)', avatarPath: null, bio: null },
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
      themeOverride: null,
      certificates: false,
      coverPath: null,
    },
    {
      id: ids.community,
      spaceId: ids.alexander,
      kind: 'community',
      slug: 'community',
      title: 'Rope Community',
      subtitle: 'Share ties, ask questions',
      status: 'published',
      position: 1,
      themeOverride: null,
      certificates: false,
      coverPath: null,
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
      themeOverride: null,
      certificates: false,
      coverPath: null,
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
    unlockQuizPartId: null,
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
    fileSize: null,
    passPercent: null,
    ...extra,
  });
  db.parts.push(
    part('part-intro-video', 'step-intro', 0, { kind: 'video', title: 'Welcome', vimeoId: '76979871', aspect: 16 / 9 }),
    part('part-intro-text', 'step-intro', 1, { text: 'Welcome to Shibari 101. Watch the video, then tick Complete & Continue.' }),
    part('part-safety-text', 'step-safety', 0, { text: 'Always keep safety shears within reach.' }),
    part('part-safety-pdf', 'step-safety', 1, { kind: 'download', title: 'Safety checklist (PDF)', filePath: 'shibari-101/safety.pdf', fileSize: 240_000 }),
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
    orderId: null,
    subscriptionId: null,
    accessGroupId: null,
  });

  db.grants.push({
    id: 'grant-student-community',
    productId: ids.community,
    profileId: ids.student,
    source: 'manual',
    status: 'active',
    grantedAt: new Date(now.getTime() - 2 * DAY),
    expiresAt: null,
    orderId: null,
    subscriptionId: null,
    accessGroupId: null,
  });
  db.accessGroups.push({
    id: ids.members,
    communityId: ids.community,
    title: 'Members',
    isDefault: true,
    ...ALL_GROUP_FEATURES,
  });
  const channel = (id: string, title: string, position: number, extra: Partial<Channel> = {}): Channel => ({
    id,
    communityId: ids.community,
    accessGroupId: ids.members,
    title,
    kind: 'feed',
    privacy: 'public',
    readOnly: false,
    position,
    ...extra,
  });
  db.channels.push(
    channel(ids.general, 'General', 0),
    channel(ids.announcements, 'Announcements', 1, { readOnly: true }),
    channel(ids.lounge, 'Lounge', 2, { kind: 'chat' }),
  );
  db.messages.push({
    attachment: null,
    id: 'msg-hello',
    channelId: ids.lounge,
    threadId: null,
    authorId: ids.alexanderOwner,
    body: 'Hello everyone, say hi here.',
    createdAt: new Date(now.getTime() - DAY),
  });
  db.posts.push({
    id: 'post-welcome',
    channelId: ids.announcements,
    authorId: ids.alexanderOwner,
    body: 'Welcome to the community! Introduce yourself in General.',
    pinned: true,
    createdAt: new Date(now.getTime() - DAY),
    hiddenAt: null,
  });

  // Natasha gets her own look so the two dev spaces visibly differ; Alexander keeps defaults.
  db.branding.push({
    spaceId: ids.natasha,
    colors: {
      accent: '#2f6b4f',
      'accent-soft': '#dcebe2',
      page: '#f6f3ee',
      card: '#ffffff',
      hairline: '#dedbd4',
      mid: '#86827a',
      ink: '#26302b',
    },
    fontHeading: 'playfair-display',
    fontBody: 'source-sans-3',
    logoPath: null,
    faviconPath: null,
  });

  seedCoaching(db, now);
  seedMedia(db, now);
  return db;
}

/** 1:1 coaching product with three sessions, the student holds it, weekday 9-5 Berlin. */
function seedCoaching(db: Db, now: Date): void {
  const ids = SEED_IDS;
  db.products.push({
    id: ids.coaching,
    spaceId: ids.alexander,
    kind: 'coaching',
    slug: 'private-coaching',
    title: 'Private Coaching',
    subtitle: 'Three 1:1 sessions',
    status: 'published',
    position: 2,
    themeOverride: null,
    certificates: false,
    coverPath: null,
  });
  db.coachingPrograms.push({
    productId: ids.coaching,
    kind: 'one_on_one',
    sessionMinutes: 60,
    sessionsIncluded: 3,
    location: 'https://meet.example.test/alexander',
  });
  db.coachSettings.push({
    spaceId: ids.alexander,
    timeZone: 'Europe/Berlin',
    bufferBeforeMin: 0,
    bufferAfterMin: 15,
    minNoticeMin: 12 * 60,
    windowDays: 14,
    cancelCutoffHours: 24,
  });
  db.availabilityRules.push(
    ...DEFAULT_RULES.map((r) => ({ ...r, id: `avail-${r.weekday}`, spaceId: ids.alexander })),
  );
  db.grants.push({
    id: 'grant-student-coaching',
    productId: ids.coaching,
    profileId: ids.student,
    source: 'manual',
    status: 'active',
    grantedAt: new Date(now.getTime() - 2 * DAY),
    expiresAt: null,
    orderId: null,
    subscriptionId: null,
    accessGroupId: null,
  });
}

/** Private podcast with two episodes (one scheduled) and a download pack, both held by the student. */
function seedMedia(db: Db, now: Date): void {
  const ids = SEED_IDS;
  const product = (id: string, kind: 'podcast' | 'download', slug: string, title: string, subtitle: string, position: number) => ({
    id,
    spaceId: ids.alexander,
    kind,
    slug,
    title,
    subtitle,
    status: 'published' as const,
    position,
    themeOverride: null,
    certificates: false,
    coverPath: null,
  });
  db.products.push(
    product(ids.podcast, 'podcast', 'rope-talk', 'Rope Talk', 'Members-only podcast', 3),
    product(ids.downloads, 'download', 'pattern-pack', 'Pattern Pack', 'Printable tie diagrams', 4),
  );
  db.podcasts.push({ productId: ids.podcast, author: 'Alexander', explicit: false, order: 'episodic' });
  const ep = (id: string, title: string, publishAt: Date, createdAt: Date) => ({
    id,
    productId: ids.podcast,
    title,
    type: 'full' as const,
    season: 1,
    showNotes: '',
    audioPath: `rope-talk/${id}.mp3`,
    audioBytes: 24_000_000,
    durationS: 1500,
    explicit: false,
    publishAt,
    createdAt,
  });
  db.episodes.push(
    ep('ep-welcome', 'Welcome to Rope Talk', new Date(now.getTime() - 7 * DAY), new Date(now.getTime() - 8 * DAY)),
    ep('ep-tension', 'Tension and timing', new Date(now.getTime() + 7 * DAY), new Date(now.getTime() - DAY)),
  );
  db.productFiles.push(
    { id: 'file-single-column', productId: ids.downloads, title: 'Single column tie', filePath: 'pattern-pack/single-column.pdf', sizeBytes: 1_200_000, createdAt: new Date(now.getTime() - 3 * DAY) },
    { id: 'file-hip-harness', productId: ids.downloads, title: 'Hip harness', filePath: 'pattern-pack/hip-harness.pdf', sizeBytes: 2_400_000, createdAt: new Date(now.getTime() - 2 * DAY) },
  );
  for (const productId of [ids.podcast, ids.downloads]) {
    db.grants.push({
      id: `grant-student-${productId}`,
      productId,
      profileId: ids.student,
      source: 'manual',
      status: 'active',
      grantedAt: new Date(now.getTime() - 2 * DAY),
      expiresAt: null,
      orderId: null,
      subscriptionId: null,
      accessGroupId: null,
    });
  }
}
