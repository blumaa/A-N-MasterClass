// Server-issued sign-in for a profile the server already trusts (new buyer after checkout, claim link; G4).
// The admin API makes a magic-link token without sending mail; verifying its hash on `client` stores the
// session there (cookies, for the per-request server client).
// Docs: https://supabase.com/docs/reference/javascript/auth-admin-generatelink , .../auth-verifyotp
import type { Db } from '../server';

export async function signInAs(admin: Db, client: Db, profileId: string): Promise<void> {
  const found = await admin.auth.admin.getUserById(profileId);
  if (found.error) throw found.error;
  const email = found.data.user.email;
  if (!email) throw new Error(`profile ${profileId} has no email`);

  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) throw link.error;

  const verified = await client.auth.verifyOtp({ type: 'email', token_hash: link.data.properties.hashed_token });
  if (verified.error) throw verified.error;
}
