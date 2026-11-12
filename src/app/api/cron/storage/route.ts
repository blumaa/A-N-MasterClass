// Scheduled Storage cleanup: GET with `Authorization: Bearer <CRON_SECRET>` (Vercel Cron or any scheduler).
import type { NextRequest } from 'next/server';
import { cronSecret } from '@/config/cron';
import { cleanupStorage } from '@/lib/storage/cleanup';
import { runStorageCron } from '@/lib/storage/storageCron';

export async function GET(req: NextRequest) {
  return runStorageCron(req.headers.get('authorization'), cronSecret(), cleanupStorage);
}
