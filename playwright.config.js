// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  // Live browser tests are *.spec.js; *.test.js are fast Node unit tests
  // (run via `npm run test:unit`), which Playwright must not pick up.
  testMatch: '**/*.spec.js',
  // Must comfortably exceed the 5-minute manual CAPTCHA-solve wait in
  // fixtures/extension.js, or Playwright kills the test (and, combined
  // with retries, opens a brand new browser window) before a human ever
  // gets a chance to solve it.
  timeout: 7 * 60_000,
  // No retries: a timed-out/failed live test retrying automatically just
  // spawns another real browser window against google.com unattended,
  // which is not something to do without a human actively watching.
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
});
