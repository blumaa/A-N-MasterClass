// Which provider a space checks out with. PayPal when the space saved credentials for the
// current env; the fake provider only where dev login is allowed; otherwise not set up.
import type { Repo } from '@/lib/data/repo';
import type { PaymentEnv } from '@/lib/data/types';
import { createPayPalProvider } from './paypal';
import type { PaymentProvider } from './provider';

export type ProviderChoice =
  | { kind: 'ready'; provider: PaymentProvider; livemode: boolean; /** PayPal JS SDK client id; null = fake. */ clientId: string | null }
  | { kind: 'not_set_up' };

export type ProviderDeps = {
  env: PaymentEnv;
  /** Fake provider instance, or null where fake payments are not allowed. */
  fake: PaymentProvider | null;
  fetchImpl?: typeof fetch;
};

export async function providerForSpace(repo: Repo, spaceId: string, deps: ProviderDeps): Promise<ProviderChoice> {
  const [credentials, secret] = await Promise.all([repo.paymentCredentials(spaceId, deps.env), repo.paymentSecret(spaceId, deps.env)]);
  if (credentials && secret) {
    const provider = createPayPalProvider(
      { clientId: credentials.clientId, secret, env: deps.env, webhookId: credentials.webhookId },
      deps.fetchImpl,
    );
    return { kind: 'ready', provider, livemode: deps.env === 'live', clientId: credentials.clientId };
  }
  return deps.fake ? { kind: 'ready', provider: deps.fake, livemode: false, clientId: null } : { kind: 'not_set_up' };
}
