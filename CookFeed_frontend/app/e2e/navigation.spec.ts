/* The navigation, in a real browser: what each account is offered (the prototype's rules.js, sections 3.1 and 3.8),
   and the two layouts. A wide screen has a bar of links across the top. A phone has tabs along the bottom, with the
   rest behind More, and no page scrolls sideways. */
import { PHONE, BUILT_PAGES, PLACEHOLDER_PAGES, contentWidth, expect, openAs, test } from './support';

const SHOPPER = ['Discover', 'Plans & collections', 'Recipes', 'My kitchen', 'Your orders', 'Help'];

test.describe('on a wide screen', () => {
  const top = 'nav[data-nav="top"]';

  for (const [account, links] of [
    ['guest', SHOPPER],
    ['alex', SHOPPER],
    ['kenji', [...SHOPPER, 'My studio']],
    ['admin', ['Discover', 'Plans & collections', 'Recipes', 'Help', 'Admin']],
  ] as const) {
    test(`${account} sees ${links.length} links across the top`, async ({ page }) => {
      await openAs(page, account, '/');

      await expect(page.locator(`${top} a`)).toHaveText([...links]);
      await expect(page.locator('nav[data-nav="tabs"]')).toBeHidden();
    });
  }

  test('a guest is offered Sign in and the cart; the admin is offered neither a cart nor a kitchen', async ({ page }) => {
    await openAs(page, 'guest', '/');
    await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Cart' })).toBeVisible();

    await page.evaluate(() => localStorage.setItem('cookfeed.userId', '6'));
    await page.reload();
    await expect(page.getByRole('link', { name: 'Cart' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cookfeed Admin' })).toBeVisible();
  });

  test('the link for the page being shown is marked as the current one', async ({ page }) => {
    await openAs(page, 'alex', '/');
    await expect(page.locator(`${top} a[aria-current="page"]`)).toHaveText('Discover');

    await page.locator(top).getByRole('link', { name: 'Recipes' }).click();
    await expect(page.locator(`${top} a[aria-current="page"]`)).toHaveText('Recipes');
  });

  test('the brand leads home', async ({ page }) => {
    await openAs(page, 'guest', '/help');

    await page.locator('header').getByRole('link', { name: 'Cookfeed' }).click();
    await expect(page).toHaveURL('/');
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });
  const tabs = 'nav[data-nav="tabs"]';

  test('the pages are tabs along the bottom, and the top bar keeps only the brand, the cart and the account', async ({ page }) => {
    await openAs(page, 'alex', '/');

    await expect(page.locator('nav[data-nav="top"]')).toBeHidden();
    await expect(page.locator(`${tabs} li`)).toHaveText(['Discover', 'Plans', 'Recipes', 'Kitchen', 'More']);
    const bar = (await page.locator(tabs).boundingBox())!;
    expect(bar.y + bar.height).toBeCloseTo(PHONE.height, 0);
  });

  test('the admin gets the console as a tab in place of the kitchen', async ({ page }) => {
    await openAs(page, 'admin', '/');

    await expect(page.locator(`${tabs} li`)).toHaveText(['Discover', 'Plans', 'Recipes', 'Admin', 'More']);
  });

  test('each tab is big enough to tap: at least 44 by 44', async ({ page }) => {
    await openAs(page, 'alex', '/');

    for (const tab of await page.locator(`${tabs} a, ${tabs} button`).all()) {
      const box = (await tab.boundingBox())!;
      expect(Math.min(box.width, box.height), await tab.innerText()).toBeGreaterThanOrEqual(44);
    }
  });

  test('the tab for the page being shown is marked as the current one', async ({ page }) => {
    await openAs(page, 'alex', '/');
    await expect(page.locator(`${tabs} a[aria-current="page"]`)).toHaveText('Discover');

    await page.locator(tabs).getByRole('link', { name: 'Plans' }).click();
    await expect(page.locator(`${tabs} a[aria-current="page"]`)).toHaveText('Plans');
  });

  test('More opens a sheet with the remaining pages and the account, and Escape closes it', async ({ page }) => {
    await openAs(page, 'kenji', '/');
    const more = page.locator(tabs).getByRole('button', { name: 'More' });
    const sheet = page.getByRole('dialog', { name: 'More' });

    await expect(sheet).toBeHidden();
    await more.click();

    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Signed in as Kenji Watanabe');
    await expect(sheet.locator('nav li')).toHaveText(['Your orders', 'My studio', 'Help', 'Switch account', 'Sign out']);

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(more).toBeFocused();
  });

  test('a link in the sheet goes to its page and closes the sheet', async ({ page }) => {
    await openAs(page, 'alex', '/');

    await page.locator(tabs).getByRole('button', { name: 'More' }).click();
    await page.getByRole('dialog', { name: 'More' }).getByRole('link', { name: 'Your orders' }).click();

    await expect(page).toHaveURL('/orders');
    await expect(page.getByRole('dialog', { name: 'More' })).toBeHidden();
  });

  test('signing out from the sheet leaves a guest, who is offered Sign in', async ({ page }) => {
    await openAs(page, 'alex', '/');

    await page.locator(tabs).getByRole('button', { name: 'More' }).click();
    await page.getByRole('dialog', { name: 'More' }).getByRole('button', { name: 'Sign out' }).click();

    await expect(page.locator('header').getByRole('link', { name: 'Sign in' })).toBeVisible();
  });

  for (const width of [320, 375]) {
    test(`no page is wider than a ${width}px screen`, async ({ page }) => {
      await page.setViewportSize({ width, height: PHONE.height });
      for (const address of [...BUILT_PAGES, ...PLACEHOLDER_PAGES]) {
        await openAs(page, 'kenji', address);
        expect(await contentWidth(page), address).toBeLessThanOrEqual(width);
      }
    });
  }
});
