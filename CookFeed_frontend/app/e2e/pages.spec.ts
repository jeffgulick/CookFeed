/* Every page address, as each kind of account: it loads without a page or console error (support.ts), names
   itself in the tab and with one main heading, and every image it shows has loaded. */
import { ACCOUNTS, AccountName, BUILT_PAGES, PLACEHOLDER_PAGES, brokenImages, expect, openAs, test } from './support';

for (const account of Object.keys(ACCOUNTS) as AccountName[]) {
  test.describe(`as ${account}`, () => {
    for (const address of [...BUILT_PAGES, ...PLACEHOLDER_PAGES]) {
      test(address, async ({ page }) => {
        await openAs(page, account, address);

        await expect(page.locator('main h1')).toHaveCount(1);
        await expect(page).toHaveTitle(/ \| Cookfeed$/);
        expect(await brokenImages(page)).toEqual([]);
      });
    }
  });
}

test('each built page names itself in the browser tab', async ({ page }) => {
  for (const [address, title] of [
    ['/', 'Discover | Cookfeed'],
    ['/sign-in', 'Sign in | Cookfeed'],
    ['/plans', 'Plans & collections | Cookfeed'],
    ['/recipes', 'Recipes | Cookfeed'],
    ['/help', 'Help | Cookfeed'],
    ['/cart', 'Cart | Cookfeed'],
    ['/orders', 'Your orders | Cookfeed'],
    ['/kitchen', 'My kitchen | Cookfeed'],
    ['/list', 'Shopping list | Cookfeed'],
    ['/creators/kenji-kitchen', 'kenji-kitchen | Cookfeed'],
    ['/plans/3', 'Three Weeknights in Japan | Cookfeed'],
    ['/recipes/16', 'Tamagoyaki | Cookfeed'],
    ['/plans/3/reviews', 'Reviews of Three Weeknights in Japan | Cookfeed'],
  ]) {
    await openAs(page, 'guest', address);
    await expect(page, address).toHaveTitle(title);
  }
});

test('a page that is not converted yet says so, and leads back to Discover', async ({ page }) => {
  await openAs(page, 'admin', '/admin');

  await expect(page.locator('main h1')).toHaveText('Admin');
  await expect(page.locator('main')).toContainText('still being built');
  await page.getByRole('link', { name: 'Back to Discover' }).click();
  await expect(page).toHaveURL('/');
});

test('an address that names no page gets the same treatment, not a blank screen', async ({ page }) => {
  await openAs(page, 'guest', '/no-such-page');

  await expect(page.locator('main h1')).toHaveText('Page not found');
});
