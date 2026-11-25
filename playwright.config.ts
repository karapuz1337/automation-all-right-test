import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 5_000 },
  outputDir: process.env.PW_OUTPUT_DIR ?? '.runtime/test-results',
  reporter: [
    ['list'],
    ['html', {
      open: 'never',
      outputFolder: process.env.PLAYWRIGHT_HTML_OUTPUT_DIR ?? '.runtime/playwright-report',
    }],
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
