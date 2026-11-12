// Push service worker per space host (proxy.ts rewrites /push-sw.js here), so each space has its
// own worker, subscription and endpoint. no-cache: browsers must pick up a changed worker.
// Docs: node_modules/next/dist/docs (Progressive Web Apps guide, "Service worker" headers).
import { SERVICE_WORKER } from '@/lib/push/serviceWorker';

export function GET() {
  return new Response(SERVICE_WORKER, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
