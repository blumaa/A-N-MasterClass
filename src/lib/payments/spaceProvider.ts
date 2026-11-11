// Composition root for payments: the provider a space checks out with right now. Server only.
import 'server-only';
import { devAuthAllowed } from '@/config/dataSource';
import { paymentsEnv } from '@/config/payments';
import { getServiceRepo } from '@/lib/data/getRepo';
import { createFakeProvider, type FakeProvider } from './fake';
import { providerForSpace, type ProviderChoice } from './forSpace';

// globalThis keeps one fake provider (and its captures) across HMR reloads, like the fake repo.
const holder = globalThis as typeof globalThis & { __masterclassFakeProvider?: FakeProvider };

function fakeProvider(): FakeProvider | null {
  if (!devAuthAllowed(process.env)) return null;
  holder.__masterclassFakeProvider ??= createFakeProvider();
  return holder.__masterclassFakeProvider;
}

export const spaceProvider = (spaceId: string): Promise<ProviderChoice> =>
  providerForSpace(getServiceRepo(), spaceId, { env: paymentsEnv(), fake: fakeProvider() });
