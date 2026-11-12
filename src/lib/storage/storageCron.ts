// Scheduled storage cleanup call: checks the cron secret, then runs the cleanup.
import { isCronCall } from '@/config/cron';

export type CleanupResult = { queued: number; removed: number };

export async function runStorageCron(
  authorization: string | null,
  secret: string | null,
  cleanup: () => Promise<CleanupResult>,
): Promise<Response> {
  if (!isCronCall(authorization, secret)) return new Response(null, { status: 401 });
  return Response.json(await cleanup(), { headers: { 'cache-control': 'no-store' } });
}
