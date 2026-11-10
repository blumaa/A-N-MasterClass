// Claim links (G4): 10-day single-use link in the receipt so a new buyer can set a password.
// Only the sha256 hash is stored; the raw token lives in the email link alone.
import { createHash, randomBytes } from 'node:crypto';

export const CLAIM_TTL_DAYS = 10;
const TOKEN_BYTES = 32;

export const hashClaimToken = (token: string): string => createHash('sha256').update(token).digest('hex');

export function newClaimToken(now: Date): { token: string; hash: string; expiresAt: Date } {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  return { token, hash: hashClaimToken(token), expiresAt: new Date(now.getTime() + CLAIM_TTL_DAYS * 86_400_000) };
}
