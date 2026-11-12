// Supabase Repo: tenancy, branding, products + program tree, grants, progress.
// Semantics mirror src/lib/data/fake/fakeRepo.ts; constraints come from the SQL schema.
import { ConstraintError } from '@/lib/data/errors';
import { grantIsActive } from '@/lib/data/grants';
import type { Repo } from '@/lib/data/repo';
import type { Profile } from '@/lib/data/types';
import { check, defined, isoOrNull, nextPosition, unwrap, unwrapMaybe, type RepoCtx } from './context';
import {
  toBranding,
  toGrant,
  toMember,
  toModule,
  toPart,
  toProduct,
  toProfile,
  toSpace,
  toSpaceDomain,
  toSpaceProfile,
  toStep,
} from './mapCore';

export type CoreRepo = Pick<
  Repo,
  | 'spaceBySlug'
  | 'spaceSlugByHost'
  | 'profile'
  | 'member'
  | 'members'
  | 'spaceProfiles'
  | 'profileByEmail'
  | 'createProfile'
  | 'ensureSpaceProfile'
  | 'spaces'
  | 'createSpace'
  | 'updateSpace'
  | 'addMember'
  | 'spaceDomains'
  | 'addSpaceDomain'
  | 'removeSpaceDomain'
  | 'branding'
  | 'saveBranding'
  | 'products'
  | 'product'
  | 'productBySlug'
  | 'modules'
  | 'module'
  | 'steps'
  | 'step'
  | 'parts'
  | 'part'
  | 'createProduct'
  | 'updateProduct'
  | 'createModule'
  | 'updateModule'
  | 'deleteModule'
  | 'createStep'
  | 'updateStep'
  | 'deleteStep'
  | 'createPart'
  | 'updatePart'
  | 'deletePart'
  | 'move'
  | 'activeGrant'
  | 'grants'
  | 'grantsForProduct'
  | 'grantsForOrder'
  | 'grantsForSubscription'
  | 'setGrantExpiry'
  | 'createGrant'
  | 'revokeGrant'
  | 'completedStepIds'
  | 'setStepComplete'
  | 'profilesInSpace'
>;

export function createCoreRepo({ db, admin }: RepoCtx): CoreRepo {
  async function profileById(id: string): Promise<Profile | null> {
    const row = unwrapMaybe(await (await db()).from('profiles').select('*').eq('id', id).maybeSingle());
    return row && toProfile(row);
  }

  return {
    // tenancy
    async spaceBySlug(slug) {
      const row = unwrapMaybe(await (await db()).from('spaces').select('*').eq('slug', slug).maybeSingle());
      return row && toSpace(row);
    },
    async spaceSlugByHost(host) {
      const row = unwrapMaybe(
        await (await db())
          .from('space_domains')
          .select('spaces!inner(slug)')
          .eq('host', host.toLowerCase())
          .maybeSingle(),
      );
      return row?.spaces.slug ?? null;
    },
    profile: profileById,
    async member(spaceId, profileId) {
      const row = unwrapMaybe(
        await (await db())
          .from('space_members')
          .select('*')
          .eq('space_id', spaceId)
          .eq('profile_id', profileId)
          .maybeSingle(),
      );
      return row && toMember(row);
    },
    async members(spaceId) {
      return unwrap(await (await db()).from('space_members').select('*').eq('space_id', spaceId)).map(toMember);
    },
    async spaceProfiles(spaceId) {
      return unwrap(await (await db()).from('space_profiles').select('*').eq('space_id', spaceId)).map(toSpaceProfile);
    },
    async profileByEmail(email) {
      const row = unwrapMaybe(
        await (await db()).from('profiles').select('*').eq('email', email.toLowerCase()).maybeSingle(),
      );
      return row && toProfile(row);
    },
    // Auth admin API: the auth user is the account; handle_new_user() inserts the profile row.
    // No email is sent here (createUser never sends one); the claim link does that (G4).
    async createProfile(email) {
      const { data, error } = await admin().auth.admin.createUser({ email: email.toLowerCase(), email_confirm: true });
      if (error) {
        if (error.code === 'email_exists') throw new ConstraintError('email taken');
        throw error;
      }
      const row = unwrap(await admin().from('profiles').select('*').eq('id', data.user.id).single());
      return toProfile(row);
    },
    async ensureSpaceProfile(row) {
      check(
        await (await db())
          .from('space_profiles')
          .upsert(
            { space_id: row.spaceId, profile_id: row.profileId, display_name: row.displayName },
            { onConflict: 'space_id,profile_id', ignoreDuplicates: true },
          ),
      );
    },

    // platform admin (RLS: platform admin only for insert/delete + domains)
    async spaces() {
      return unwrap(await (await db()).from('spaces').select('*').order('name')).map(toSpace);
    },
    async createSpace(input) {
      const row = unwrap(
        await (await db())
          .from('spaces')
          .insert({ slug: input.slug, name: input.name, is_test: input.isTest })
          .select('*')
          .single(),
      );
      return toSpace(row);
    },
    async updateSpace(id, patch) {
      const row = unwrap(await (await db()).from('spaces').update(defined(patch)).eq('id', id).select('*').single());
      return toSpace(row);
    },
    async addMember(row) {
      check(
        await (await db())
          .from('space_members')
          .insert({ space_id: row.spaceId, profile_id: row.profileId, role: row.role }),
      );
    },
    async spaceDomains(spaceId) {
      return unwrap(await (await db()).from('space_domains').select('*').eq('space_id', spaceId).order('host')).map(
        toSpaceDomain,
      );
    },
    async addSpaceDomain(row) {
      check(
        await (await db())
          .from('space_domains')
          .insert({ host: row.host.toLowerCase(), space_id: row.spaceId, is_primary: row.isPrimary }),
      );
    },
    async removeSpaceDomain(host) {
      check(await (await db()).from('space_domains').delete().eq('host', host.toLowerCase()));
    },

    // branding
    async branding(spaceId) {
      const row = unwrapMaybe(
        await (await db()).from('space_branding').select('*').eq('space_id', spaceId).maybeSingle(),
      );
      return row && toBranding(row);
    },
    async saveBranding(b) {
      const row = unwrap(
        await (await db())
          .from('space_branding')
          .upsert(
            {
              space_id: b.spaceId,
              colors: b.colors,
              font_heading: b.fontHeading,
              font_body: b.fontBody,
              logo_path: b.logoPath,
              favicon_path: b.faviconPath,
            },
            { onConflict: 'space_id' },
          )
          .select('*')
          .single(),
      );
      return toBranding(row);
    },

    // products + tree
    async products(spaceId) {
      return unwrap(
        await (await db()).from('products').select('*').eq('space_id', spaceId).order('position'),
      ).map(toProduct);
    },
    async product(id) {
      const row = unwrapMaybe(await (await db()).from('products').select('*').eq('id', id).maybeSingle());
      return row && toProduct(row);
    },
    async productBySlug(spaceId, slug) {
      const row = unwrapMaybe(
        await (await db()).from('products').select('*').eq('space_id', spaceId).eq('slug', slug).maybeSingle(),
      );
      return row && toProduct(row);
    },
    async modules(programId) {
      return unwrap(
        await (await db()).from('modules').select('*').eq('program_id', programId).order('position'),
      ).map(toModule);
    },
    async module(id) {
      const row = unwrapMaybe(await (await db()).from('modules').select('*').eq('id', id).maybeSingle());
      return row && toModule(row);
    },
    async steps(moduleIds) {
      if (moduleIds.length === 0) return [];
      return unwrap(
        await (await db()).from('steps').select('*').in('module_id', [...moduleIds]).order('position'),
      ).map(toStep);
    },
    async step(id) {
      const row = unwrapMaybe(await (await db()).from('steps').select('*').eq('id', id).maybeSingle());
      return row && toStep(row);
    },
    async parts(stepId) {
      return unwrap(await (await db()).from('parts').select('*').eq('step_id', stepId).order('position')).map(toPart);
    },
    async part(id) {
      const row = unwrapMaybe(await (await db()).from('parts').select('*').eq('id', id).maybeSingle());
      return row && toPart(row);
    },

    // programs row (program kind) and default access group (community kind) come from SQL triggers.
    async createProduct(input) {
      const c = await db();
      const position = await nextPosition(c, 'products', 'space_id', input.spaceId);
      const row = unwrap(
        await c
          .from('products')
          .insert({ space_id: input.spaceId, kind: input.kind, slug: input.slug, title: input.title, position })
          .select('*')
          .single(),
      );
      return toProduct(row);
    },
    async updateProduct(id, patch) {
      const row = unwrap(
        await (await db())
          .from('products')
          .update(
            defined({
              slug: patch.slug,
              title: patch.title,
              subtitle: patch.subtitle,
              status: patch.status,
              theme_override: patch.themeOverride,
              certificates: patch.certificates,
              cover_path: patch.coverPath,
            }),
          )
          .eq('id', id)
          .select('*')
          .single(),
      );
      return toProduct(row);
    },

    async createModule(input) {
      const c = await db();
      const position = await nextPosition(c, 'modules', 'program_id', input.programId);
      const row = unwrap(
        await c
          .from('modules')
          .insert({ program_id: input.programId, title: input.title, position })
          .select('*')
          .single(),
      );
      return toModule(row);
    },
    async updateModule(id, patch) {
      const row = unwrap(
        await (await db())
          .from('modules')
          .update(
            defined({
              title: patch.title,
              description: patch.description,
              status: patch.status,
              unlock_after_step_id: patch.unlockAfterStepId,
              unlock_quiz_part_id: patch.unlockQuizPartId,
              release_after_days: patch.releaseAfterDays,
              release_at: isoOrNull(patch.releaseAt),
            }),
          )
          .eq('id', id)
          .select('*')
          .single(),
      );
      return toModule(row);
    },
    // Steps, parts, progress, comments and notifications cascade in SQL.
    async deleteModule(id) {
      check(await (await db()).from('modules').delete().eq('id', id));
    },

    async createStep(input) {
      const c = await db();
      const position = await nextPosition(c, 'steps', 'module_id', input.moduleId);
      const row = unwrap(
        await c.from('steps').insert({ module_id: input.moduleId, title: input.title, position }).select('*').single(),
      );
      return toStep(row);
    },
    async updateStep(id, patch) {
      const row = unwrap(
        await (await db())
          .from('steps')
          .update(defined({ title: patch.title, description: patch.description, status: patch.status }))
          .eq('id', id)
          .select('*')
          .single(),
      );
      return toStep(row);
    },
    async deleteStep(id) {
      check(await (await db()).from('steps').delete().eq('id', id));
    },

    async createPart(input) {
      const c = await db();
      const position = await nextPosition(c, 'parts', 'step_id', input.stepId);
      const row = unwrap(
        await c.from('parts').insert({ step_id: input.stepId, kind: input.kind, position }).select('*').single(),
      );
      return toPart(row);
    },
    async updatePart(id, patch) {
      const row = unwrap(
        await (await db())
          .from('parts')
          .update(
            defined({
              title: patch.title,
              body: patch.text,
              vimeo_id: patch.vimeoId,
              aspect: patch.aspect,
              file_path: patch.filePath,
              file_size: patch.fileSize,
              pass_percent: patch.passPercent,
            }),
          )
          .eq('id', id)
          .select('*')
          .single(),
      );
      return toPart(row);
    },
    async deletePart(id) {
      check(await (await db()).from('parts').delete().eq('id', id));
    },

    // Atomic swap in SQL (move_row, security invoker: RLS applies).
    async move(table, id, direction) {
      check(await (await db()).rpc('move_row', { target_table: table, target_id: id, direction }));
    },

    // access
    async activeGrant(productId, profileId, now) {
      const rows = unwrap(
        await (await db())
          .from('grants')
          .select('*')
          .eq('product_id', productId)
          .eq('profile_id', profileId)
          .eq('status', 'active'),
      ).map(toGrant);
      return rows.find((g) => grantIsActive(g, now)) ?? null;
    },
    async grants(spaceId, profileId, now) {
      const rows = unwrap(
        await (await db())
          .from('grants')
          .select('*, products!inner(space_id)')
          .eq('products.space_id', spaceId)
          .eq('profile_id', profileId)
          .eq('status', 'active'),
      ).map(toGrant);
      return rows.filter((g) => grantIsActive(g, now));
    },
    async grantsForProduct(productId) {
      return unwrap(await (await db()).from('grants').select('*').eq('product_id', productId)).map(toGrant);
    },
    async grantsForOrder(orderId) {
      return unwrap(await (await db()).from('grants').select('*').eq('order_id', orderId)).map(toGrant);
    },
    async createGrant(input) {
      const row = unwrap(
        await (await db())
          .from('grants')
          .insert({
            product_id: input.productId,
            profile_id: input.profileId,
            source: input.source,
            order_id: input.orderId ?? null,
            access_group_id: input.accessGroupId ?? null,
            subscription_id: input.subscriptionId ?? null,
          })
          .select('*')
          .single(),
      );
      return toGrant(row);
    },
    async grantsForSubscription(subscriptionId) {
      return unwrap(await (await db()).from('grants').select('*').eq('subscription_id', subscriptionId)).map(toGrant);
    },
    async setGrantExpiry(id, expiresAt) {
      check(await (await db()).from('grants').update({ expires_at: isoOrNull(expiresAt) }).eq('id', id));
    },
    async revokeGrant(id) {
      check(await (await db()).from('grants').update({ status: 'revoked' }).eq('id', id));
    },

    // progress
    async completedStepIds(profileId, stepIds) {
      if (stepIds.length === 0) return new Set();
      const rows = unwrap(
        await (await db())
          .from('step_progress')
          .select('step_id')
          .eq('profile_id', profileId)
          .in('step_id', [...stepIds]),
      );
      return new Set(rows.map((r) => r.step_id));
    },
    async setStepComplete(profileId, stepId, done) {
      const c = await db();
      if (done) {
        check(
          await c
            .from('step_progress')
            .upsert({ profile_id: profileId, step_id: stepId }, { onConflict: 'profile_id,step_id', ignoreDuplicates: true }),
        );
      } else {
        check(await c.from('step_progress').delete().eq('profile_id', profileId).eq('step_id', stepId));
      }
    },

    // Staff + grant holders. Under a user session RLS narrows profiles to the caller's own row.
    async profilesInSpace(spaceId) {
      const c = await db();
      const [members, grants] = await Promise.all([
        c.from('space_members').select('profile_id').eq('space_id', spaceId),
        c.from('grants').select('profile_id, products!inner(space_id)').eq('products.space_id', spaceId),
      ]);
      const ids = [...new Set([...unwrap(members), ...unwrap(grants)].map((r) => r.profile_id))];
      if (ids.length === 0) return [];
      return unwrap(await c.from('profiles').select('*').in('id', ids)).map(toProfile);
    },
  };
}
