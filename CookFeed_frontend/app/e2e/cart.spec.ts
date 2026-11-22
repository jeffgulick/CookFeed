/* The cart, end to end: who has one, adding a plan from its page and from a storefront, the count in the header, the
   totals, and taking lines out. The tests that change the cart sign in as Noor, whom no other spec uses, and run in
   order: each builds on the cart the one before left, and the last leaves it empty. */
import { expect, openAs, test } from './support';

test.describe('who has a cart', () => {
  test('a visitor is asked to sign in, and comes back to the cart', async ({ page }) => {
    await openAs(page, 'guest', '/cart');

    await expect(page.locator('main h1')).toHaveText('Your cart');
    await page.locator('main').getByRole('link', { name: 'Sign in to see your cart' }).click();
    await expect(page).toHaveURL('/sign-in?next=%2Fcart');
  });

  test('the admin is told admin accounts do not shop', async ({ page }) => {
    await openAs(page, 'admin', '/cart');

    await expect(page.locator('main')).toContainText('Admin accounts do not shop, so there is no cart.');
    await expect(page.getByRole('button', { name: 'Place order' })).toHaveCount(0);
  });

  test('a cook sees what is already in their cart, and the header counts it', async ({ page }) => {
    // The seed puts The Bread Box in Priya's cart.
    await openAs(page, 'priya', '/cart');

    await expect(page.locator('[data-cart-line] h2')).toHaveText(['The Bread Box']);
    await expect(page.locator('[data-item-count]')).toContainText('1 item');
    await expect(page.locator('[data-total]')).toHaveText('$4.99');
    await expect(page.locator('header [data-cart-count]')).toHaveText('1');
    await expect(page.locator('header').getByRole('link', { name: 'Cart, 1 item' })).toBeVisible();
  });
});

test.describe('filling and emptying a cart', () => {
  test.describe.configure({ mode: 'serial' });

  test('an empty cart says so and cannot be ordered', async ({ page }) => {
    await openAs(page, 'noor', '/cart');

    await expect(page.locator('main')).toContainText('Your cart is empty.');
    await expect(page.locator('[data-item-count]')).toContainText('0 items');
    await expect(page.getByRole('button', { name: 'Place order' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Empty cart' })).toHaveCount(0);
    await expect(page.locator('header [data-cart-count]')).toHaveCount(0);
  });

  test('a plan is added from its page, and the header counts it', async ({ page }) => {
    await openAs(page, 'noor', '/plans/3');

    await page.getByRole('button', { name: 'Add to cart' }).click();

    await expect(page.locator('[data-toast]')).toContainText('Three Weeknights in Japan added to your cart.');
    await expect(page.locator('header [data-cart-count]')).toHaveText('1');
    await expect(page.getByRole('button', { name: 'Add to cart' })).toHaveCount(0);

    await page.locator('main').getByRole('link', { name: /In your cart/ }).click();
    await expect(page).toHaveURL('/cart');
    await expect(page.locator('[data-cart-line] h2')).toHaveText(['Three Weeknights in Japan']);
    await expect(page.locator('[data-cart-line]')).toContainText('by kenji-kitchen');
    await expect(page.locator('[data-total]')).toHaveText('$12.99');
  });

  test('a second plan is added from a storefront, and the cart adds them up', async ({ page }) => {
    await openAs(page, 'noor', '/creators/maria-cooks');

    await page.locator('[data-product-id="2"]').getByRole('button', { name: 'Add to cart' }).click();
    await expect(page.locator('header [data-cart-count]')).toHaveText('2');

    await page.locator('header').getByRole('link', { name: 'Cart, 2 items' }).click();
    await expect(page.locator('[data-cart-line] h2')).toHaveText(['Three Weeknights in Japan', 'The Bread Box']);
    await expect(page.locator('[data-item-count]')).toContainText('2 items');
    await expect(page.locator('[data-subtotal]')).toHaveText('$17.98');
    await expect(page.locator('[data-total]')).toHaveText('$17.98');
  });

  test('the cart is still there after a reload', async ({ page }) => {
    await openAs(page, 'noor', '/cart');
    await page.reload();

    await expect(page.locator('[data-cart-line]')).toHaveCount(2);
  });

  test('a line is taken out only after confirming', async ({ page }) => {
    await openAs(page, 'noor', '/cart');
    const breadBox = page.locator('[data-cart-line]').filter({ hasText: 'The Bread Box' });

    await breadBox.getByRole('button', { name: 'Take out of cart' }).click();
    await expect(page.getByRole('dialog')).toContainText('Take The Bread Box out of your cart?');
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('[data-cart-line]')).toHaveCount(2);

    await breadBox.getByRole('button', { name: 'Take out of cart' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Take it out' }).click();

    await expect(page.locator('[data-cart-line] h2')).toHaveText(['Three Weeknights in Japan']);
    await expect(page.locator('[data-toast]')).toContainText('The Bread Box is out of your cart.');
    await expect(page.locator('[data-total]')).toHaveText('$12.99');
    await expect(page.locator('header [data-cart-count]')).toHaveText('1');
  });

  test('Empty cart takes everything out after confirming', async ({ page }) => {
    await openAs(page, 'noor', '/cart');

    await page.getByRole('button', { name: 'Empty cart' }).click();
    await expect(page.getByRole('dialog')).toContainText('Remove all 1 item from your cart?');
    await page.getByRole('dialog').getByRole('button', { name: 'Empty cart' }).click();

    await expect(page.locator('main')).toContainText('Your cart is empty.');
    await expect(page.locator('[data-cart-line]')).toHaveCount(0);
    await expect(page.locator('header [data-cart-count]')).toHaveCount(0);
  });
});
