// Contract tests: Supabase repo against the linked project (ksb). Needs SUPABASE_SECRET_KEY in
// .env.local; skipped without it. Writes only inside an is_test space it creates and deletes.
import { defineConfig } from 'vitest/config';
import { existsSync } from 'node:fs';
import tsconfigPaths from 'vite-tsconfig-paths';
import { fileURLToPath } from 'node:url';

// Node's own .env parser; .env.local is gitignored and holds the ksb keys.
if (existsSync('.env.local')) process.loadEnvFile('.env.local');

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: { alias: { 'server-only': fileURLToPath(new URL('./test/emptyModule.ts', import.meta.url)) } },
  test: {
    environment: 'node',
    include: ['src/**/*.contract.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
