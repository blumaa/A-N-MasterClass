import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

// Feature list read off disk: a hardcoded list silently stops guarding new features.
const FEATURES_DIR = fileURLToPath(new URL('./src/features', import.meta.url));
if (!existsSync(FEATURES_DIR)) {
  throw new Error(`${FEATURES_DIR} missing — feature-boundary lint would silently pass.`);
}
const FEATURES = readdirSync(FEATURES_DIR, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

const APP_IMPORT = { group: ['@/app', '@/app/**'], message: 'Do not import from app/ — imports stay unidirectional.' };

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts', '**/database.types.ts']),
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
  // Feature must not import another feature; compose in app/.
  ...FEATURES.map((name) => ({
    files: [`src/features/${name}/**/*.{ts,tsx}`],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@/features/*/**', `!@/features/${name}/**`], message: 'Features must not import other features — compose them in app/.' },
          APP_IMPORT,
        ],
      }],
    },
  })),
  // Shared layers must not depend on any feature or on app/.
  {
    files: ['src/{components,lib,config,hooks,types,test-utils}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@/features', '@/features/**'], message: 'Shared modules must not depend on a feature.' },
          APP_IMPORT,
        ],
      }],
    },
  },
]);
