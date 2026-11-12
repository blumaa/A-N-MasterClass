// Fixture for *.contract.test.ts: one throwaway is_test space on the linked project, plus auth users
// made through it. cleanup() deletes the space (FK cascades) and the users.
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { supabasePublic } from '@/config/supabase';
import type { Database } from '@/lib/db/database.types';
import { adminClient } from '../../admin';
import type { Db } from '../context';

export const contractEnabled = Boolean(process.env.SUPABASE_SECRET_KEY);

export type ContractSpace = {
  admin: Db;
  spaceId: string;
  slug: string;
  /** Unique, lowercase email for this run. */
  email: (name: string) => string;
  /** Auth user (+ profiles row via trigger); deleted by cleanup(). */
  newUser: (name: string) => Promise<string>;
  /** Publishable-key client signed in as a user made by newUser, for checks that read auth.uid(). */
  signIn: (name: string, id: string) => Promise<Db>;
  cleanup: () => Promise<void>;
};

export async function createContractSpace(domain: string): Promise<ContractSpace> {
  const admin = adminClient();
  const run = `${domain}-${Date.now().toString(36)}`;
  const slug = `contract-${run}`;
  const { data, error } = await admin.from('spaces').insert({ slug, name: `Contract ${domain}`, is_test: true }).select('id').single();
  if (error) throw error;
  const userIds: string[] = [];
  const email = (name: string) => `contract+${run}-${name}@example.com`.toLowerCase();

  return {
    admin,
    spaceId: data.id,
    slug,
    email,
    async newUser(name) {
      const created = await admin.auth.admin.createUser({ email: email(name), email_confirm: true });
      if (created.error) throw created.error;
      userIds.push(created.data.user.id);
      return created.data.user.id;
    },
    async signIn(name, id) {
      const password = randomUUID();
      const upd = await admin.auth.admin.updateUserById(id, { password });
      if (upd.error) throw upd.error;
      const { url, publishableKey } = supabasePublic();
      const client = createClient<Database>(url, publishableKey, { auth: { persistSession: false } });
      const signed = await client.auth.signInWithPassword({ email: email(name), password });
      if (signed.error) throw signed.error;
      return client;
    },
    async cleanup() {
      await admin.from('spaces').delete().eq('id', data.id);
      for (const id of userIds) await admin.auth.admin.deleteUser(id);
    },
  };
}
