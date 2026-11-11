// Fixture for *.contract.test.ts: one throwaway is_test space on the linked project, plus auth users
// made through it. cleanup() deletes the space (FK cascades) and the users.
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
    async cleanup() {
      await admin.from('spaces').delete().eq('id', data.id);
      for (const id of userIds) await admin.auth.admin.deleteUser(id);
    },
  };
}
