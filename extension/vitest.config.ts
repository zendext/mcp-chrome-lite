import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      // Match WXT's path aliases from .wxt/tsconfig.json
      '@': rootDir,
      '~': rootDir,
      'mcp-chrome-lite-shared': `${repoRoot}/packages/shared/src/index.ts`,
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/lite/**/*.test.ts'],
    exclude: ['node_modules', '.output', 'dist', '.wxt'],
    setupFiles: ['tests/vitest.setup.ts'],
    environmentOptions: {
      jsdom: {
        // Provide a stable URL for anchor/href tests
        url: 'https://example.com/',
      },
    },
    // Auto-cleanup mocks between tests
    clearMocks: true,
    restoreMocks: true,
    typecheck: {
      enabled: false,
    },
  },
});
