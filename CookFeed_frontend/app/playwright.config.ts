import { defineConfig } from '@playwright/test';

/* Browser smoke tests for the Angular app (e2e/). They drive the real app in Chromium against the real API and the
   seeded database, so they check what a person would see: every page opens cleanly as each kind of account, the
   navigation is right for who is signed in, a phone gets the phone layout, the keyboard works, and no page has an
   accessibility violation.

   The two servers the tests need are started here when they are not already running: the API (which needs the
   database container up; see CookFeed_api/README.md) and the app's development server. In CI both are always
   started fresh.

   To test an app that is already running somewhere else (another port, say), set COOKFEED_APP_URL to its address:
   the tests then use it and start nothing. */
const appUrl = process.env['COOKFEED_APP_URL'];

export default defineConfig({
  testDir: 'e2e',
  // Puts the database back to the seed before the run, so the specs that buy and save start clean every time.
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  // CI keeps an HTML report to upload when the job fails; locally the list is enough.
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: appUrl ?? 'http://localhost:4200',
    trace: 'retain-on-failure',
  },
  // Saving a recipe and reviewing a plan change a count, a rating and an order that every visitor sees, so those
  // two specs run after the rest have finished; everything else runs in parallel. A creator unpublishing a recipe
  // and retiring a plan take them off the pages those two read, so that spec runs last of all.
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' }, testIgnore: /(saves|review-write|studio-write)\.spec\.ts/ },
    {
      name: 'after',
      use: { browserName: 'chromium' },
      testMatch: /(saves|review-write)\.spec\.ts/,
      dependencies: ['chromium'],
    },
    {
      name: 'last',
      use: { browserName: 'chromium' },
      testMatch: /studio-write\.spec\.ts/,
      dependencies: ['after'],
    },
  ],
  webServer: appUrl ? undefined : [
    {
      command: 'dotnet run --project src/Cookfeed.Api',
      cwd: '../../CookFeed_api',
      url: 'http://localhost:5032/api/feed',
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
    {
      command: 'npm start',
      url: 'http://localhost:4200',
      reuseExistingServer: !process.env['CI'],
      timeout: 180_000,
    },
  ],
});
