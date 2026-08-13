import { defineConfig, devices } from '@playwright/test';
import fs from 'fs';
import path from 'path';

/**
 * Playwright Configuration for OrangeCat
 * Optimized for real-time development with MCP integration
 * Supports Brave browser and automated testing workflows
 */
const authFile = path.resolve(__dirname, 'tests/.auth/user.json');

// Local development machines may provide a system browser instead of the
// Playwright-managed binary (for example, Ubuntu versions that Playwright does
// not publish browser bundles for yet). CI keeps the managed Chromium default;
// set PLAYWRIGHT_CHANNEL=chrome locally to use the installed Chrome channel.
const browserChannel = process.env.PLAYWRIGHT_CHANNEL as 'chrome' | 'msedge' | undefined;
const channelOverride = browserChannel ? { channel: browserChannel } : {};

export default defineConfig({
  testDir: process.env.E2E_TEST_DIR || 'tests/e2e',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : 4,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI ? 'line' : 'list',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Take screenshot on failure */
    screenshot: 'only-on-failure',
    /* Record video on failure */
    video: 'retain-on-failure',
    /* Enable headless mode for automation */
    headless: true,
    /* Reuse logged-in session if available */
    storageState: fs.existsSync(authFile) ? authFile : undefined,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
        ...channelOverride,
      },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    /* Mobile-first release viewports. Keep both common narrow widths explicit:
       a regression at 375px can be hidden by the extra 15px available at 390px. */
    {
      name: 'mobile-375',
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
        viewport: { width: 375, height: 812 },
        ...channelOverride,
      },
    },
    {
      name: 'mobile-390',
      use: {
        ...devices['Pixel 5'],
        browserName: 'chromium',
        viewport: { width: 390, height: 844 },
        ...channelOverride,
      },
    },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Global setup to create storage state if credentials are provided */
  globalSetup: './tests/setup/global-setup.cjs',

  /* Run your local dev server before starting the tests */
  // No webServer; this config targets existing environments via baseURL
});
