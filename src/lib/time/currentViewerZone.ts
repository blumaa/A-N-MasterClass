// Server read of the viewer zone cookie (see viewerZone.ts).
import 'server-only';
import { cookies } from 'next/headers';
import { pickViewerZone, VIEWER_ZONE_COOKIE } from './viewerZone';

export async function currentViewerZone(fallback: string): Promise<string> {
  return pickViewerZone((await cookies()).get(VIEWER_ZONE_COOKIE)?.value, fallback);
}
