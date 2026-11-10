// Payment webhook (G28 backup path). Signature first, against the raw body; only then parse.
// Unknown or other-space orders still answer 200: retrying cannot make them known.
import type { Repo } from '@/lib/data/repo';
import type { ProviderChoice } from '@/lib/payments/forSpace';
import { applyProviderEvent } from './fulfil';

export async function receiveWebhook(
  repo: Repo,
  resolveProvider: (spaceId: string) => Promise<ProviderChoice>,
  spaceSlug: string,
  headers: Headers,
  rawBody: string,
  now: Date,
): Promise<200 | 401 | 404> {
  const space = await repo.spaceBySlug(spaceSlug);
  if (!space) return 404;
  const choice = await resolveProvider(space.id);
  if (choice.kind !== 'ready') return 404;
  if (!(await choice.provider.verifyWebhook(headers, rawBody))) return 401;
  await applyProviderEvent(repo, choice.provider, space.id, choice.provider.parseEvent(rawBody), now);
  return 200;
}
