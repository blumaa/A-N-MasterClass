// Supabase Repo: web push subscriptions. Semantics mirror src/lib/data/fake/fakePushRepo.ts;
// rules live in *_push_subscriptions.sql and *_push_settings.sql.
import type { Repo } from '@/lib/data/repo';
import type { NotificationType, PushSubscription } from '@/lib/data/types';
import { check, unwrap, type RepoCtx, type Row } from './context';

export type PushRepo = Pick<Repo, 'savePushSubscription' | 'deletePushSubscription' | 'hasPushSubscription' | 'pushSubscriptions' | 'deletePushSubscriptions' | 'pushMutes' | 'setPushMute'>;

const COLUMNS = 'space_id, profile_id, endpoint, p256dh, auth, user_agent';
type SubRow = Pick<Row<'push_subscriptions'>, 'space_id' | 'profile_id' | 'endpoint' | 'p256dh' | 'auth' | 'user_agent'>;

const toSub = (r: SubRow): PushSubscription => ({
  spaceId: r.space_id,
  profileId: r.profile_id,
  endpoint: r.endpoint,
  p256dh: r.p256dh,
  auth: r.auth,
  userAgent: r.user_agent,
});

// Saves and own deletes run as the caller; sending reads and dead-row cleanup use admin().
export function createPushRepo({ db, admin }: RepoCtx): PushRepo {
  return {
    async savePushSubscription(row) {
      check(
        await (await db()).rpc('save_push_subscription', {
          target_space: row.spaceId,
          target_endpoint: row.endpoint,
          key_p256dh: row.p256dh,
          key_auth: row.auth,
          // The SQL arg takes null; generated types mark every arg non-null.
          agent: row.userAgent as string,
        }),
      );
    },
    async deletePushSubscription(profileId, endpoint) {
      check(await (await db()).from('push_subscriptions').delete().eq('profile_id', profileId).eq('endpoint', endpoint));
    },
    async hasPushSubscription(spaceId, profileId, endpoint) {
      const rows = unwrap(
        await (await db())
          .from('push_subscriptions')
          .select('endpoint')
          .eq('space_id', spaceId)
          .eq('profile_id', profileId)
          .eq('endpoint', endpoint)
          .limit(1),
      );
      return rows.length > 0;
    },
    async pushSubscriptions(spaceId, profileIds) {
      if (profileIds.length === 0) return [];
      const rows = unwrap(
        await admin().from('push_subscriptions').select(COLUMNS).eq('space_id', spaceId).in('profile_id', [...profileIds]),
      );
      return rows.map(toSub);
    },
    async deletePushSubscriptions(endpoints) {
      if (endpoints.length === 0) return;
      check(await admin().from('push_subscriptions').delete().in('endpoint', [...endpoints]));
    },
    async pushMutes(spaceId, profileIds) {
      if (profileIds.length === 0) return [];
      const rows = unwrap(
        await admin().from('push_mutes').select('profile_id, type').eq('space_id', spaceId).in('profile_id', [...profileIds]).order('created_at'),
      );
      // The type check in SQL mirrors NOTIFICATION_TYPES.
      return rows.map((r) => ({ profileId: r.profile_id, type: r.type as NotificationType }));
    },
    async setPushMute(spaceId, profileId, type, muted) {
      const table = (await db()).from('push_mutes');
      if (muted) {
        check(await table.upsert({ space_id: spaceId, profile_id: profileId, type }, { ignoreDuplicates: true }));
      } else {
        check(await table.delete().eq('space_id', spaceId).eq('profile_id', profileId).eq('type', type));
      }
    },
  };
}
