// Repo over in-memory tables. Enforces the same constraints as the SQL schema
// (unique slug, one active grant, vimeo id digits, cascades) so fakes fail like Postgres.
import { isAvatarPath, isSiteImagePath } from '@/lib/storage/siteImages';
import { RESERVED_SLUGS, SLUG_PATTERN } from '@/lib/tenancy/slug';
import { ALREADY_MEMBER, CERTIFICATES_PROGRAM_ONLY, ConstraintError, FILE_OUTSIDE_FOLDER, HOST_TAKEN, ONE_PRIMARY_DOMAIN, QUIZ_PASS_PERCENT, SLUG_RESERVED } from '../errors';
import { grantIsActive } from '../grants';
import type { Direction, Reorderable, Repo } from '../repo';
import type { Grant, Module, Part, Product, Profile, Space, Step } from '../types';
import type { Db } from './db';
import { createFakeCoachingRepo } from './fakeCoachingRepo';
import { createFakeChatRepo, DEFAULT_GROUP_TITLE } from './fakeChatRepo';
import { createFakeCommerceRepo } from './fakeCommerceRepo';
import { createFakeCouponRepo } from './fakeCouponRepo';
import { createFakeSubscriptionRepo } from './fakeSubscriptionRepo';
import { createFakeCommunityRepo } from './fakeCommunityRepo';
import { createFakeCommunityFiles } from './fakeCommunityFiles';
import { createFakeEventsRepo } from './fakeEventsRepo';
import { createFakeMediaRepo } from './fakeMediaRepo';
import { createFakeModerationRepo } from './fakeModerationRepo';
import { createFakeMemberData } from './fakeMemberData';
import { withPoints } from './fakePoints';
import { createFakePushRepo } from './fakePushRepo';
import { createFakeQuizRepo, removeQuizParts } from './fakeQuizRepo';
import { createFakeCertificateRepo } from './fakeCertificateRepo';
import { createFakeSiteRepo } from './fakeSiteRepo';

export type FakeRepo = Repo & { db: Db };

type Positioned = { id: string; position: number };

const byPosition = <T extends Positioned>(rows: T[]): T[] => rows.toSorted((a, b) => a.position - b.position);
const nextPosition = (rows: Positioned[]): number => rows.reduce((max, r) => Math.max(max, r.position + 1), 0);
const VIMEO_ID = /^[0-9]+$/;

function must<T>(row: T | undefined, what: string): T {
  if (!row) throw new Error(`${what} not found`);
  return row;
}

function checkSlug(slug: string): void {
  if (!SLUG_PATTERN.test(slug)) throw new ConstraintError(`invalid slug: ${JSON.stringify(slug)}`);
}


export function createFakeRepo(db: Db): FakeRepo {
  let seq = 0;
  const id = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

  // Rows sharing a parent with rowId (reorder scope).
  const siblingsOf: Record<Reorderable, (rowId: string) => Positioned[]> = {
    modules: (rowId) => {
      const row = must(db.modules.find((m) => m.id === rowId), 'module');
      return db.modules.filter((m) => m.programId === row.programId);
    },
    steps: (rowId) => {
      const row = must(db.steps.find((s) => s.id === rowId), 'step');
      return db.steps.filter((s) => s.moduleId === row.moduleId);
    },
    parts: (rowId) => {
      const row = must(db.parts.find((p) => p.id === rowId), 'part');
      return db.parts.filter((p) => p.stepId === row.stepId);
    },
    channels: (rowId) => {
      const row = must(db.channels.find((c) => c.id === rowId), 'channel');
      return db.channels.filter((c) => c.communityId === row.communityId);
    },
  };

  function removeStepIds(stepIds: Set<string>): void {
    removeQuizParts(db, new Set(db.parts.filter((p) => stepIds.has(p.stepId)).map((p) => p.id)));
    db.parts = db.parts.filter((p) => !stepIds.has(p.stepId));
    db.stepProgress = db.stepProgress.filter((sp) => !stepIds.has(sp.stepId));
    const comments = new Set(db.comments.filter((c) => c.targetType === 'step' && stepIds.has(c.targetId)).map((c) => c.id));
    db.reactions = db.reactions.filter((r) => !(r.targetType === 'comment' && comments.has(r.targetId)));
    db.comments = db.comments.filter((c) => !comments.has(c.id));
    db.notifications = db.notifications.filter((n) => !(n.stepId && stepIds.has(n.stepId)));
    db.steps = db.steps.filter((s) => !stepIds.has(s.id));
    for (const m of db.modules) {
      if (m.unlockAfterStepId && stepIds.has(m.unlockAfterStepId)) m.unlockAfterStepId = null;
    }
  }

  const chat = createFakeChatRepo(db, id);

  return withPoints(db, {
    db,
    ...createFakeSiteRepo(db, id),
    ...chat,
    ...createFakeCommerceRepo(db, id),
    ...createFakeCouponRepo(db, id),
    ...createFakeSubscriptionRepo(db, id),
    ...createFakeCommunityRepo(db, id),
    ...createFakeCommunityFiles(db, id),
    ...createFakeEventsRepo(db, id),
    ...createFakeCoachingRepo(db, id),
    ...createFakeMediaRepo(db, id),
    ...createFakeModerationRepo(db, id),
    ...createFakePushRepo(db),
    ...createFakeQuizRepo(db, id),
    ...createFakeCertificateRepo(db, id),
    ...createFakeMemberData(db),

    spaceBySlug: async (slug) => db.spaces.find((s) => s.slug === slug) ?? null,
    spaceSlugByHost: async (host) => {
      const domain = db.spaceDomains.find((d) => d.host === host.toLowerCase());
      return db.spaces.find((s) => s.id === domain?.spaceId)?.slug ?? null;
    },
    profile: async (pid) => db.profiles.find((p) => p.id === pid) ?? null,
    member: async (spaceId, profileId) =>
      db.members.find((m) => m.spaceId === spaceId && m.profileId === profileId) ?? null,
    members: async (spaceId) => db.members.filter((m) => m.spaceId === spaceId),
    spaceProfiles: async (spaceId) => db.spaceProfiles.filter((sp) => sp.spaceId === spaceId),
    profileByEmail: async (email) => db.profiles.find((p) => p.email === email.toLowerCase()) ?? null,
    async createProfile(email) {
      const key = email.toLowerCase();
      if (db.profiles.some((p) => p.email === key)) throw new ConstraintError('email taken');
      const row: Profile = { id: id('user'), email: key, isPlatformAdmin: false };
      db.profiles.push(row);
      return row;
    },
    async ensureSpaceProfile(row) {
      if (!db.spaceProfiles.some((sp) => sp.spaceId === row.spaceId && sp.profileId === row.profileId)) {
        db.spaceProfiles.push({ ...row, avatarPath: null, bio: null });
      }
    },
    async saveSpaceProfile(row) {
      const i = db.spaceProfiles.findIndex((sp) => sp.spaceId === row.spaceId && sp.profileId === row.profileId);
      if (i < 0) throw new Error(`space profile not found: ${row.spaceId}/${row.profileId}`);
      if (row.avatarPath && !isAvatarPath(row.avatarPath, row.spaceId, row.profileId)) {
        throw new ConstraintError(FILE_OUTSIDE_FOLDER);
      }
      db.spaceProfiles[i] = { ...row };
      return { ...row };
    },

    spaces: async () => db.spaces.toSorted((a, b) => a.name.localeCompare(b.name)),
    async createSpace(input) {
      checkSlug(input.slug);
      if (RESERVED_SLUGS.includes(input.slug)) throw new ConstraintError(SLUG_RESERVED);
      if (db.spaces.some((s) => s.slug === input.slug)) throw new ConstraintError('slug taken');
      const row: Space = { id: id('space'), ...input, status: 'draft', locale: 'en' };
      db.spaces.push(row);
      return row;
    },
    async updateSpace(spaceId, patch) {
      const row = must(db.spaces.find((s) => s.id === spaceId), 'space');
      Object.assign(row, Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)));
      return { ...row };
    },
    async addMember(row) {
      if (db.members.some((m) => m.spaceId === row.spaceId && m.profileId === row.profileId)) {
        throw new ConstraintError(ALREADY_MEMBER);
      }
      db.members.push({ ...row });
    },
    spaceDomains: async (spaceId) => db.spaceDomains.filter((d) => d.spaceId === spaceId),
    async addSpaceDomain(row) {
      const host = row.host.toLowerCase();
      if (db.spaceDomains.some((d) => d.host === host)) throw new ConstraintError(HOST_TAKEN);
      if (row.isPrimary && db.spaceDomains.some((d) => d.spaceId === row.spaceId && d.isPrimary)) {
        throw new ConstraintError(ONE_PRIMARY_DOMAIN);
      }
      db.spaceDomains.push({ ...row, host });
    },
    async removeSpaceDomain(host) {
      db.spaceDomains = db.spaceDomains.filter((d) => d.host !== host.toLowerCase());
    },

    branding: async (spaceId) => db.branding.find((b) => b.spaceId === spaceId) ?? null,
    async saveBranding(row) {
      must(db.spaces.find((s) => s.id === row.spaceId), 'space');
      for (const path of [row.logoPath, row.faviconPath]) {
        if (path && !isSiteImagePath(path, row.spaceId)) throw new ConstraintError(FILE_OUTSIDE_FOLDER);
      }
      db.branding = [...db.branding.filter((b) => b.spaceId !== row.spaceId), row];
      return row;
    },

    products: async (spaceId) => byPosition(db.products.filter((p) => p.spaceId === spaceId)),
    product: async (pid) => db.products.find((p) => p.id === pid) ?? null,
    productBySlug: async (spaceId, slug) => db.products.find((p) => p.spaceId === spaceId && p.slug === slug) ?? null,
    modules: async (programId) => byPosition(db.modules.filter((m) => m.programId === programId)),
    module: async (mid) => db.modules.find((m) => m.id === mid) ?? null,
    steps: async (moduleIds) => {
      const ids = new Set(moduleIds);
      return byPosition(db.steps.filter((s) => ids.has(s.moduleId)));
    },
    step: async (sid) => db.steps.find((s) => s.id === sid) ?? null,
    parts: async (stepId) => byPosition(db.parts.filter((p) => p.stepId === stepId)),
    part: async (pid) => db.parts.find((p) => p.id === pid) ?? null,

    async createProduct(input) {
      checkSlug(input.slug);
      if (db.products.some((p) => p.spaceId === input.spaceId && p.slug === input.slug)) {
        throw new ConstraintError(`slug taken: ${input.slug}`);
      }
      const row: Product = {
        ...input,
        id: id('prod'),
        subtitle: null,
        status: 'draft',
        themeOverride: null,
        certificates: false,
        coverPath: null,
        position: nextPosition(db.products.filter((p) => p.spaceId === input.spaceId)),
      };
      db.products.push(row);
      // SQL: trigger on products insert.
      if (row.kind === 'community') await chat.createAccessGroup({ communityId: row.id, title: DEFAULT_GROUP_TITLE, isDefault: true });
      return row;
    },
    async updateProduct(pid, patch) {
      const row = must(db.products.find((p) => p.id === pid), 'product');
      if (patch.slug !== undefined && patch.slug !== row.slug) {
        checkSlug(patch.slug);
        if (db.products.some((p) => p.spaceId === row.spaceId && p.slug === patch.slug)) {
          throw new ConstraintError(`slug taken: ${patch.slug}`);
        }
      }
      if (patch.certificates && row.kind !== 'program') throw new ConstraintError(CERTIFICATES_PROGRAM_ONLY);
      // SQL: products_cover_path check.
      if (patch.coverPath && !isSiteImagePath(patch.coverPath, row.spaceId)) throw new ConstraintError(FILE_OUTSIDE_FOLDER);
      return Object.assign(row, patch);
    },

    async createModule(input) {
      const row: Module = {
        ...input,
        id: id('mod'),
        description: null,
        status: 'draft',
        unlockAfterStepId: null,
        unlockQuizPartId: null,
        releaseAfterDays: null,
        releaseAt: null,
        position: nextPosition(db.modules.filter((m) => m.programId === input.programId)),
      };
      db.modules.push(row);
      return row;
    },
    async updateModule(mid, patch) {
      if (patch.releaseAfterDays != null && patch.releaseAfterDays < 0) throw new ConstraintError('release_after_days >= 0');
      return Object.assign(must(db.modules.find((m) => m.id === mid), 'module'), patch);
    },
    async deleteModule(mid) {
      removeStepIds(new Set(db.steps.filter((s) => s.moduleId === mid).map((s) => s.id)));
      db.modules = db.modules.filter((m) => m.id !== mid);
    },

    async createStep(input) {
      const row: Step = {
        ...input,
        id: id('step'),
        description: null,
        status: 'draft',
        position: nextPosition(db.steps.filter((s) => s.moduleId === input.moduleId)),
      };
      db.steps.push(row);
      return row;
    },
    updateStep: async (sid, patch) => Object.assign(must(db.steps.find((s) => s.id === sid), 'step'), patch),
    async deleteStep(sid) {
      removeStepIds(new Set([sid]));
    },

    async createPart(input) {
      const row: Part = {
        ...input,
        id: id('part'),
        title: null,
        text: null,
        vimeoId: null,
        aspect: null,
        filePath: null,
        fileSize: null,
        passPercent: null,
        position: nextPosition(db.parts.filter((p) => p.stepId === input.stepId)),
      };
      db.parts.push(row);
      return row;
    },
    async updatePart(pid, patch) {
      if (patch.vimeoId != null && !VIMEO_ID.test(patch.vimeoId)) throw new ConstraintError('vimeo id must be digits');
      if (patch.fileSize != null && patch.fileSize < 0) throw new ConstraintError('file size >= 0');
      if (patch.passPercent != null && !(patch.passPercent >= 1 && patch.passPercent <= 100)) {
        throw new ConstraintError(QUIZ_PASS_PERCENT);
      }
      const row = { ...must(db.parts.find((p) => p.id === pid), 'part'), ...patch };
      db.parts = db.parts.map((p) => (p.id === pid ? row : p));
      return row;
    },
    async deletePart(pid) {
      removeQuizParts(db, new Set([pid]));
      db.parts = db.parts.filter((p) => p.id !== pid);
    },

    async move(table, rowId, direction: Direction) {
      const siblings = byPosition(siblingsOf[table](rowId));
      const at = siblings.findIndex((r) => r.id === rowId);
      const row = siblings[at];
      const other = siblings[direction === 'up' ? at - 1 : at + 1];
      if (!row || !other) return;
      [row.position, other.position] = [other.position, row.position];
    },

    activeGrant: async (productId, profileId, now) =>
      db.grants.find((g) => g.productId === productId && g.profileId === profileId && grantIsActive(g, now)) ?? null,
    async grants(spaceId, profileId, now) {
      const inSpace = new Set(db.products.filter((p) => p.spaceId === spaceId).map((p) => p.id));
      return db.grants.filter((g) => g.profileId === profileId && inSpace.has(g.productId) && grantIsActive(g, now));
    },
    grantsForProduct: async (productId) => db.grants.filter((g) => g.productId === productId),
    grantsForOrder: async (orderId) => db.grants.filter((g) => g.orderId === orderId),
    async createGrant(input) {
      const accessGroupId = input.accessGroupId ?? null;
      if (accessGroupId !== null && db.accessGroups.find((g) => g.id === accessGroupId)?.communityId !== input.productId) {
        throw new ConstraintError('access group must belong to the granted community');
      }
      const same = (g: Grant) =>
        g.productId === input.productId && g.profileId === input.profileId && g.accessGroupId === accessGroupId;
      if (db.grants.some((g) => same(g) && g.status === 'active')) throw new ConstraintError('active grant exists');
      const row: Grant = {
        ...input,
        accessGroupId,
        orderId: input.orderId ?? null,
        subscriptionId: input.subscriptionId ?? null,
        id: id('grant'),
        status: 'active',
        grantedAt: new Date(),
        expiresAt: null,
      };
      db.grants.push(row);
      return row;
    },
    grantsForSubscription: async (subscriptionId) => db.grants.filter((g) => g.subscriptionId === subscriptionId),
    async setGrantExpiry(gid, expiresAt) {
      must(db.grants.find((g) => g.id === gid), 'grant').expiresAt = expiresAt;
    },
    async revokeGrant(gid) {
      must(db.grants.find((g) => g.id === gid), 'grant').status = 'revoked';
    },

    async completedStepIds(profileId, stepIds) {
      const wanted = new Set(stepIds);
      return new Set(
        db.stepProgress.filter((sp) => sp.profileId === profileId && wanted.has(sp.stepId)).map((sp) => sp.stepId),
      );
    },
    async setStepComplete(profileId, stepId, done) {
      const has = db.stepProgress.some((sp) => sp.profileId === profileId && sp.stepId === stepId);
      if (done && !has) db.stepProgress.push({ profileId, stepId, completedAt: new Date() });
      if (!done) db.stepProgress = db.stepProgress.filter((sp) => !(sp.profileId === profileId && sp.stepId === stepId));
    },

    async profilesInSpace(spaceId) {
      const productIds = new Set(db.products.filter((p) => p.spaceId === spaceId).map((p) => p.id));
      const ids = new Set([
        ...db.members.filter((m) => m.spaceId === spaceId).map((m) => m.profileId),
        ...db.grants.filter((g) => productIds.has(g.productId)).map((g) => g.profileId),
      ]);
      return db.profiles.filter((p) => ids.has(p.id));
    },
  });
}
