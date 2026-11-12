// Push Supabase repo against the linked project. save_push_subscription reads auth.uid(), so saves
// run as signed-in users; reads and bulk deletes use the service client (RLS: 160-push-subscriptions.test.sql).
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabasePublic } from '@/config/supabase';
import { ConstraintError, INVALID_PUSH_SUBSCRIPTION } from '@/lib/data/errors';
import type { PushSubscription } from '@/lib/data/types';
import type { Database } from '@/lib/db/database.types';
import { createPushRepo, type PushRepo } from './push';
import { contractEnabled, createContractSpace, type ContractSpace } from './testing/contractSpace';

describe.skipIf(!contractEnabled)('push repo (Supabase contract)', () => {
  let fx: ContractSpace;
  let service: PushRepo;
  let a: string, b: string;
  let asA: PushRepo, asB: PushRepo;

  const run = randomUUID();
  const sub = (over: Partial<PushSubscription> = {}): PushSubscription => ({
    spaceId: fx.spaceId,
    profileId: a,
    endpoint: `https://push.test/contract/${run}/1`,
    p256dh: 'k',
    auth: 'a',
    userAgent: null,
    ...over,
  });

  async function signedIn(name: string, id: string): Promise<PushRepo> {
    const password = randomUUID();
    const upd = await fx.admin.auth.admin.updateUserById(id, { password });
    if (upd.error) throw upd.error;
    const { url, publishableKey } = supabasePublic();
    const client = createClient<Database>(url, publishableKey, { auth: { persistSession: false } });
    const signed = await client.auth.signInWithPassword({ email: fx.email(name), password });
    if (signed.error) throw signed.error;
    return createPushRepo({ db: async () => client, admin: () => fx.admin });
  }

  beforeAll(async () => {
    fx = await createContractSpace('push');
    service = createPushRepo({ db: async () => fx.admin, admin: () => fx.admin });
    [a, b] = await Promise.all([fx.newUser('a'), fx.newUser('b')]);
    const ins = await fx.admin.from('space_profiles').insert([
      { space_id: fx.spaceId, profile_id: a, display_name: 'A' },
      { space_id: fx.spaceId, profile_id: b, display_name: 'B' },
    ]);
    if (ins.error) throw ins.error;
    [asA, asB] = await Promise.all([signedIn('a', a), signedIn('b', b)]);
  });

  afterAll(async () => {
    await fx?.cleanup();
  });

  it('saves one row per endpoint, as the caller', async () => {
    await asA.savePushSubscription(sub({ userAgent: 'agent' }));
    await asA.savePushSubscription(sub({ p256dh: 'k2' }));
    expect(await service.pushSubscriptions(fx.spaceId, [a, b])).toEqual([sub({ p256dh: 'k2' })]);
    expect(await asA.hasPushSubscription(fx.spaceId, a, sub().endpoint)).toBe(true);
    expect(await asB.hasPushSubscription(fx.spaceId, a, sub().endpoint)).toBe(false);
  });

  it('moves the endpoint to the account that saves it last', async () => {
    await asB.savePushSubscription(sub({ profileId: b }));
    expect(await service.pushSubscriptions(fx.spaceId, [a, b])).toEqual([sub({ profileId: b })]);
  });

  it('maps the endpoint check', async () => {
    await expect(asA.savePushSubscription(sub({ endpoint: 'http://push.test/x' }))).rejects.toThrow(
      new ConstraintError(INVALID_PUSH_SUBSCRIPTION),
    );
  });

  it('deletes own rows only, and dead rows in bulk', async () => {
    await asA.deletePushSubscription(a, sub().endpoint);
    expect(await service.pushSubscriptions(fx.spaceId, [b])).toHaveLength(1);
    await asB.deletePushSubscription(b, sub().endpoint);
    expect(await service.pushSubscriptions(fx.spaceId, [b])).toEqual([]);
    await asA.savePushSubscription(sub({ endpoint: `${sub().endpoint}-2` }));
    await service.deletePushSubscriptions([`${sub().endpoint}-2`]);
    expect(await service.pushSubscriptions(fx.spaceId, [a])).toEqual([]);
  });
});
