import path from 'node:path';
import { defineConfig } from 'vitest/config';

const r = (p: string) => path.resolve(__dirname, p);

export default defineConfig({
  resolve: {
    // Mirrors the old jest moduleNameMapper. ORDER MATTERS: the specific
    // '@/...' mock entries must come before the '@/' catch-all, so this stays
    // an array (object form does not guarantee order).
    alias: [
      { find: /^@\/components\/ui\/tabs$/, replacement: r('__mocks__/ui-tabs.js') },
      // lucide-react is mocked via vi.mock in vitest.setup.ts, NOT an alias:
      // the mock is a Proxy (any icon name resolves), and CJS-interop of an
      // aliased Proxy module yields no named exports (a Proxy has no own keys).
      { find: /^@\/lib\/nostr\/nwc$/, replacement: r('__mocks__/nostr-nwc.js') },
      { find: /^@\//, replacement: r('src') + '/' },
      { find: /^next\/navigation$/, replacement: r('__mocks__/next-navigation.js') },
      { find: /^next\/server$/, replacement: r('__mocks__/next-server.js') },
      { find: /^isows\/.*/, replacement: r('__mocks__/isows.js') },
    ],
  },
  test: {
    // node by default. The suite spent 2285s constructing jsdom environments
    // against 166s of actual test execution — 240 of 291 files never touch a
    // DOM. Files that do declare it with `// @vitest-environment jsdom`.
    // NOT environmentMatchGlobs: Vitest 4 ignores it SILENTLY (no warning),
    // which ran every component test under node and failed 20 of them.
    environment: 'node',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    testTimeout: 30000,
    include: ['__tests__/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}'],
    exclude: [
      '**/node_modules/**',
      'tests/e2e/**',
      '.next/**',
      'playwright-report/**',
      'test-results/**',
      // Parallel-session worktrees under .claude/ carry their own tests;
      // without this they pollute the run (see the old jest.config rationale).
      '.claude/**',
      '**/*.spec.{ts,tsx}', // Playwright specs
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.{ts,tsx}', 'src/**/__tests__/**'],
      // Ratchet floor — set just below measured coverage so it can only go up.
      // Raise as tests are added; never lower to make a failing build pass.
      thresholds: {
        statements: 10,
        branches: 7,
        functions: 7,
        lines: 10,
      },
    },
  },
});
