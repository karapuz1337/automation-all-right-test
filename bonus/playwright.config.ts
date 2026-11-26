import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '../.runtime/bonus-generated',
  testMatch: 'generated-*.spec.ts',
  outputDir: '../.runtime/bonus-test-results',
  reporter: 'list',
  captureGitInfo: { commit: false, diff: false },
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 5_000 },
  use: {
    browserName: 'chromium',
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    serviceWorkers: 'block',
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
});
