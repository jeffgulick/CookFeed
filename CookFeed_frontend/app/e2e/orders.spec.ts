/* Your orders, end to end, reading the seed: Alex has two paid orders and a cancelled one; Sam has none. Each line
   shows the title and price paid at checkout. */
import { PHONE, contentWidth, expect, openAs, test } from './support';

test('a cook sees their orders newest first, with what each held and what was paid', async ({ page }) => {
  await openAs(page, 'alex', '/orders');

  await expect(page.locator('main h1')).toHaveText('Your orders');
  await expect(page).toHaveTitle('Your orders | Cookfeed');
  await expect(page.locator('[data-order-summary]')).toHaveText('3 orders, newest first.');

  const orders = page.locator('[data-order]');
  await expect(orders).toHaveCount(3);
  await expect(orders.locator('[data-status]')).toHaveText(['Cancelled', 'Paid', 'Paid']);

  // The first order Alex placed, last in the list: two plans, $20.98.
  const first = orders.last();
  await expect(first).toContainText('Order CF-00001');
  await expect(first.locator('li')).toHaveCount(2);
  await expect(first).toContainText('Roman Pasta Collection');
  await expect(first).toContainText('Three Weeknights in Japan');
  await expect(first.locator('[data-order-total]')).toHaveText('$20.98');

  // The meal plan bought on its own: the oats are on two mornings.
  await expect(orders.nth(1)).toContainText('5 recipes, 6 meals');
});

test('a cancelled order says nothing in it is owned', async ({ page }) => {
  await openAs(page, 'alex', '/orders');

  const cancelled = page.locator('[data-order]').first();
  await expect(cancelled).toContainText('The Bread Box');
  await expect(cancelled).toContainText('This order was cancelled, so nothing in it is yours.');
  await expect(page.locator('[data-order]').nth(1)).not.toContainText('nothing in it is yours');
});

test('an order line leads to its plan', async ({ page }) => {
  await openAs(page, 'alex', '/orders');

  await page.locator('[data-order]').nth(1).getByRole('link', { name: 'Family Week on a Budget' }).click();
  await expect(page).toHaveURL('/plans/4');
});

test('a cook with no orders is pointed to the plans', async ({ page }) => {
  await openAs(page, 'sam', '/orders');

  await expect(page.locator('[data-order-summary]')).toHaveText('Plans you buy show up here.');
  await expect(page.locator('main')).toContainText('No orders yet.');
  await page.locator('main').getByRole('link', { name: 'See the meal plans and collections' }).click();
  await expect(page).toHaveURL('/plans');
});

test('a visitor is asked to sign in, and comes back to the orders', async ({ page }) => {
  await openAs(page, 'guest', '/orders');
  await expect(page.locator('main').getByRole('link', { name: 'Sign in to see your orders' })).toHaveAttribute(
    'href',
    '/sign-in?next=%2Forders',
  );
});

test('the admin is told admin accounts do not place orders', async ({ page }) => {
  await openAs(page, 'admin', '/orders');

  await expect(page.locator('main')).toContainText('Admin accounts do not place orders.');
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('the orders fit the screen', async ({ page }) => {
    await openAs(page, 'alex', '/orders');

    await expect(page.locator('[data-order]')).toHaveCount(3);
    expect(await contentWidth(page)).toBeLessThanOrEqual(PHONE.width);
  });
});
