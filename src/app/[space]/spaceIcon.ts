// The space icon: one source for the favicon, the manifest icon and the push notification icon.
import 'server-only';
import type { BrandMarks } from '@/features/branding/api/branding';
import { siteImageSrc } from '@/lib/storage/siteImageSrc';

/** Public URL of the uploaded favicon, or null when the space has none. */
export const spaceIconSrc = ({ faviconPath }: Pick<BrandMarks, 'faviconPath'>): string | null =>
  faviconPath ? siteImageSrc(faviconPath) : null;
