import { defineConfig } from '@playwright/test';

/* Browser smoke tests for the Angular app (e2e/). They drive the real app in Chromium against the real API and the
   seeded database, so they check what a person would see: every page opens cleanly as each kind of account, the
   navigation is right for who is signed in, a phone gets the phone layout, the keyboard works, and no page has an
   accessibility violation.

   The two servers the tests need are started here when they are not already running: the API (which needs the
   database container up; see CookFeed_api/README.md) and the app's development server. In CI both are always
   started fresh. */
export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  // CI keeps an HTML report to upload when the job fails; locally the list is enough.
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4200',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
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
