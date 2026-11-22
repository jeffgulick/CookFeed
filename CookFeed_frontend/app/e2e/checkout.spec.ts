/* Buying, end to end: a cook puts a plan in the cart, places the order, gets a receipt, owns the plan, and finds the
   order in Your orders. Signed in as Grace, whom no other spec uses; the tests run in order, each building on the
   one before. The run starts from the seed (global-setup.ts), where Grace has bought nothing. */
import { expect, openAs, test } from './support';

test.describe.configure({ mode: 'serial' });

test('a cook places an order and gets a receipt', async ({ page }) => {
  await openAs(page, 'grace', '/plans/2');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.locator('main').getByRole('link', { name: /In your cart/ }).click();

  await page.getByRole('button', { name: 'Place order' }).click();
  await expect(page.getByRole('dialog')).toContainText('Place this order for $4.99?');
  await page.getByRole('dialog').getByRole('button', { name: 'Place order' }).click();

  await expect(page.locator('main h1')).toHaveText('Thank you');
  const receipt = page.locator('[data-receipt]');
  await expect(receipt.getByRole('heading', { name: 'Order confirmed' })).toBeFocused();
  await expect(receipt).toContainText(/Order CF-\d{5}/);
  await expect(receipt).toContainText('You paid $4.99 for 1 plan');
  await expect(receipt).toContainText('The Bread Box');
  await expect(page.locator('header [data-cart-count]')).toHaveCount(0);

  await receipt.getByRole('link', { name: 'Open your plan' }).click();
  await expect(page).toHaveURL('/plans/2');
  await expect(page.locator('main')).toContainText('You own this collection');
});

test('what was bought cannot be bought again, and its recipes open', async ({ page }) => {
  await openAs(page, 'grace', '/plans/2');

  await expect(page.getByRole('button', { name: 'Add to cart' })).toHaveCount(0);
  await expect(page.locator('main')).toContainText('You own this collection');

  // A premium recipe of the collection, locked until now.
  await page.locator('main [data-plan-recipe] a').first().click();
  await expect(page.locator('[data-owned-note]')).toContainText('Yours through The Bread Box');
});

test('the order is in Your orders', async ({ page }) => {
  await openAs(page, 'grace', '/orders');

  await expect(page.locator('[data-order-summary]')).toHaveText('1 order, newest first.');
  const order = page.locator('[data-order]');
  await expect(order).toHaveCount(1);
  await expect(order).toContainText(/Order CF-\d{5}/);
  await expect(order.locator('[data-status]')).toHaveText('Paid');
  await expect(order).toContainText('The Bread Box');
  await expect(order.locator('[data-order-total]')).toHaveText('$4.99');

  await order.getByRole('link', { name: 'The Bread Box' }).click();
  await expect(page).toHaveURL('/plans/2');
});

test('the cart is empty after the order', async ({ page }) => {
  await openAs(page, 'grace', '/cart');

  await expect(page.locator('main')).toContainText('Your cart is empty.');
});
