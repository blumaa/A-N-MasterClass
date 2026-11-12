'use client';
// Stores the browser time zone in a cookie before the page paints (Next guide "Preventing
// flash before hydration", InlineScript pattern): runnable in server HTML, text/plain when
// React renders it in the browser, so client navigations neither warn nor run it twice.
import { VIEWER_ZONE_SCRIPT } from '@/lib/time/viewerZone';

export function ViewerZoneScript() {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: VIEWER_ZONE_SCRIPT }}
    />
  );
}
