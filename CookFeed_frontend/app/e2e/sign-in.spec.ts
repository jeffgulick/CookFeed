/* Signing in, end to end: the picker lists the accounts the database holds, choosing one changes what the app
   offers, the choice survives a reload, and signing out goes back to a guest. */
import { expect, openAs, test } from './support';

test('the picker lists the database accounts under what each is for', async ({ page }) => {
  await openAs(page, 'guest', '/sign-in');

  await expect(page.locator('[data-group="homeCooks"] [data-account-name]')).toHaveText([
    'Alex Rivera', 'Priya Shah', 'Sam Lee', 'Noor Haddad', 'Tomás Reyes', 'Grace Kim',
  ]);
  await expect(page.locator('[data-group="creators"] [data-account-name]')).toHaveText([
    'Maria Conti', 'Kenji Watanabe', 'Dan Okafor',
  ]);
  await expect(page.locator('[data-group="admins"] [data-account-name]')).toHaveText(['Cookfeed Admin']);
  await expect(page.getByRole('status')).toContainText('You are browsing as a guest');
});

test('picking a creator signs in, adds their studio to the navigation, and points them to it', async ({ page }) => {
  await openAs(page, 'guest', '/sign-in');

  await page.getByRole('button', { name: 'Sign in as Kenji Watanabe' }).click();

  await expect(page.getByRole('status')).toContainText('You are signed in as Kenji Watanabe');
  await expect(page.locator('[data-account-id="4"]')).toContainText('Signed in now');
  await expect(page.locator('nav[data-nav="top"]').getByRole('link', { name: 'My studio' })).toBeVisible();
  await expect(page.getByRole('status').getByRole('link', { name: 'Open My studio' })).toHaveAttribute('href', '/studio');
});

test('the choice survives a reload', async ({ page }) => {
  await openAs(page, 'guest', '/sign-in');
  await page.getByRole('button', { name: 'Sign in as Alex Rivera' }).click();

  await page.reload();

  await expect(page.getByRole('button', { name: 'Alex Rivera' })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('You are signed in as Alex Rivera');
});

test('signing out from the account menu goes back to a guest', async ({ page }) => {
  await openAs(page, 'alex', '/');

  await page.getByRole('button', { name: 'Alex Rivera' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();

  await expect(page.locator('header').getByRole('link', { name: 'Sign in' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('cookfeed.userId'))).toBeNull();
});

test('signing out on the sign-in page goes back to a guest', async ({ page }) => {
  await openAs(page, 'kenji', '/sign-in');

  await page.getByRole('button', { name: 'Sign out and browse as a guest' }).click();

  await expect(page.getByRole('status')).toContainText('You are browsing as a guest');
  await expect(page.locator('nav[data-nav="top"]').getByRole('link', { name: 'My studio' })).toHaveCount(0);
});

test('the app tells the API who is calling once an account is signed in, and not before', async ({ page }) => {
  const callers: (string | null)[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/feed')) {
      callers.push(request.headers()['x-user-id'] ?? null);
    }
  });

  await openAs(page, 'guest', '/');
  await page.evaluate(() => localStorage.setItem('cookfeed.userId', '7'));
  await page.reload();
  await page.waitForLoadState('networkidle');

  expect(callers).toEqual([null, '7']);
});
