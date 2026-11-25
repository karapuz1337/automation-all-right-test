import { defineConfig } from '@playwright/test';
import type { JobSummaryOptions } from './scripts/playwright-job-summary';

const summaryFile = process.env.PW_JOB_SUMMARY_FILE;

export default defineConfig({
  testDir: './tests',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 5_000 },
  outputDir: process.env.PW_OUTPUT_DIR ?? '.runtime/test-results',
  captureGitInfo: { commit: false, diff: false },
  reporter: [
    ['list'],
    ['html', {
      open: 'never',
      outputFolder: process.env.PLAYWRIGHT_HTML_OUTPUT_DIR ?? '.runtime/playwright-report',
    }],
    ...(summaryFile
      ? [['./scripts/playwright-job-summary.ts', { summaryFile } satisfies JobSummaryOptions] as const]
      : []),
  ],
  use: {
    actionTimeout: 10_000,
    navigationTimeout: 15_000,
    trace: 'off',
    screenshot: 'off',
    video: 'off',
  },
  projects: [
    {
      name: 'ui',
      testDir: './tests/ui',
      testMatch: 'saucedemo.spec.ts',
      use: { browserName: 'chromium', baseURL: 'https://www.saucedemo.com' },
    },
    {
      name: 'api',
      testDir: './tests/api',
      testMatch: 'bookings.spec.ts',
      use: { baseURL: 'https://restful-booker.herokuapp.com' },
    },
  ],
});
