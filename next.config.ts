import type { NextConfig } from 'next';
import { securityHeaders } from './src/lib/security/csp';

const nextConfig: NextConfig = {
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
