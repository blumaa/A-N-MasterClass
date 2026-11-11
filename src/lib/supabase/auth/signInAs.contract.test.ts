// signInAs against the linked project: a server-issued session for a known profile, no email sent.
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { supabasePublic } from '@/config/supabase';
import type { Database } from '@/lib/db/database.types';
import { createContractSpace, contractEnabled, type ContractSpace } from '../repo/testing/contractSpace';
import { signInAs } from './signInAs';

const browserLike = () => {
  const { url, publishableKey } = supabasePublic();
  return createClient<Database>(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
};

describe.skipIf(!contractEnabled)('signInAs (Supabase contract)', () => {
  let fx: ContractSpace;
  beforeAll(async () => {
    fx = await createContractSpace('auth');
  });
  afterAll(async () => fx?.cleanup());

  it('gives the client a session for that profile', async () => {
    const id = await fx.newUser('buyer');
    const client = browserLike();
    await signInAs(fx.admin, client, id);
    const { data } = await client.auth.getClaims();
    expect(data?.claims.sub).toBe(id);
  });

  it('throws for an unknown profile', async () => {
    await expect(signInAs(fx.admin, browserLike(), crypto.randomUUID())).rejects.toThrow();
  });
});
