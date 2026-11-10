// Studio payment settings DAL (G28): each space's own PayPal REST app, sandbox + live.
// Owner only (payments.manage, G15). The secret is write-only: never read back to the UI.
import { viewerCan, type Viewer } from '@/lib/auth/viewer';
import type { CommandResult } from '@/lib/data/commandResult';
import type { Repo } from '@/lib/data/repo';
import { PAYMENT_ENVS, type PaymentEnv } from '@/lib/data/types';

export type CredentialsView = { clientId: string; webhookId: string | null; hasSecret: boolean; updatedAt: Date };
export type PaymentsView = Record<PaymentEnv, CredentialsView | null>;
export type PaymentsInput = { env: PaymentEnv; clientId: string; secret: string; webhookId: string };

const invalid = (message: string): CommandResult => ({ ok: false, error: 'invalid', message });

async function envView(repo: Repo, spaceId: string, env: PaymentEnv): Promise<CredentialsView | null> {
  const [row, secret] = await Promise.all([repo.paymentCredentials(spaceId, env), repo.paymentSecret(spaceId, env)]);
  return row ? { clientId: row.clientId, webhookId: row.webhookId, hasSecret: secret !== null, updatedAt: row.updatedAt } : null;
}

export async function studioPayments(repo: Repo, viewer: Viewer): Promise<PaymentsView | null> {
  if (!viewerCan(viewer, 'payments.manage')) return null;
  const [sandbox, live] = await Promise.all(PAYMENT_ENVS.map((env) => envView(repo, viewer.space.id, env)));
  return { sandbox: sandbox ?? null, live: live ?? null };
}

export async function savePayments(repo: Repo, viewer: Viewer, input: PaymentsInput, now: Date): Promise<CommandResult> {
  if (!viewerCan(viewer, 'payments.manage')) return { ok: false, error: 'forbidden' };
  const spaceId = viewer.space.id;
  const clientId = input.clientId.trim();
  const secret = input.secret.trim() || null;
  if (!clientId) return invalid('Client ID is required.');
  if (!secret && (await repo.paymentSecret(spaceId, input.env)) === null) return invalid('Secret is required the first time.');
  await repo.savePaymentCredentials(
    { spaceId, env: input.env, clientId, webhookId: input.webhookId.trim() || null, updatedAt: now },
    secret,
  );
  return { ok: true };
}
