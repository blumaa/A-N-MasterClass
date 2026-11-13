import type { NextConfig } from 'next';
import { securityHeaders } from './src/lib/security/csp';
import { siteImagePatterns } from './src/lib/storage/imagePatterns';

const nextConfig: NextConfig = {
  // Certificate PDF fonts are read from disk at runtime (src/lib/certificates/certificateFonts.ts).
  outputFileTracingIncludes: {
    '/\\[space\\]/programs/\\[program\\]/certificate': ['./src/lib/certificates/fonts/*.ttf'],
  },
  images: { remotePatterns: siteImagePatterns(process.env.NEXT_PUBLIC_SUPABASE_URL || undefined) },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders({
          dev: process.env.NODE_ENV === 'development',
          dataOrigin: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
        }),
      },
    ];
  },
};

export default nextConfig;
