// Push part of the fake repo. Same rules as supabase/migrations/*_push_subscriptions.sql
// (save_push_subscription, endpoint/key checks).
import { ConstraintError, INVALID_PUSH_SUBSCRIPTION } from '../errors';
import type { Repo } from '../repo';
import type { PushSubscription } from '../types';
import type { Db } from './db';

type PushRepo = Pick<Repo, 'savePushSubscription' | 'deletePushSubscription' | 'hasPushSubscription' | 'pushSubscriptions' | 'deletePushSubscriptions'>;

const KEY_MAX = 200;
const keyOk = (key: string) => key.length >= 1 && key.length <= KEY_MAX;
const valid = (row: PushSubscription) =>
  row.endpoint.startsWith('https://') &&
  row.endpoint.length <= 2000 &&
  keyOk(row.p256dh) &&
  keyOk(row.auth) &&
  (row.userAgent ?? '').length <= 500;

export function createFakePushRepo(db: Db): PushRepo {
  return {
    async savePushSubscription(row) {
      if (!db.spaceProfiles.some((p) => p.spaceId === row.spaceId && p.profileId === row.profileId)) {
        throw new Error('no profile on this space');
      }
      if (!valid(row)) throw new ConstraintError(INVALID_PUSH_SUBSCRIPTION);
      db.pushSubscriptions = [...db.pushSubscriptions.filter((s) => s.endpoint !== row.endpoint), { ...row }];
    },
    async deletePushSubscription(profileId, endpoint) {
      db.pushSubscriptions = db.pushSubscriptions.filter((s) => !(s.profileId === profileId && s.endpoint === endpoint));
    },
    async hasPushSubscription(spaceId, profileId, endpoint) {
      return db.pushSubscriptions.some((s) => s.spaceId === spaceId && s.profileId === profileId && s.endpoint === endpoint);
    },
    async pushSubscriptions(spaceId, profileIds) {
      const ids = new Set(profileIds);
      return db.pushSubscriptions.filter((s) => s.spaceId === spaceId && ids.has(s.profileId)).map((s) => ({ ...s }));
    },
    async deletePushSubscriptions(endpoints) {
      const dead = new Set(endpoints);
      db.pushSubscriptions = db.pushSubscriptions.filter((s) => !dead.has(s.endpoint));
    },
  };
}
