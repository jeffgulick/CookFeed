/* A creator's storefront, end to end: who the creator is, their free recipes, and what they have for sale, with a
   buy area that changes with who is looking. The seeded creators are Maria, Kenji and Dan. A suspended creator
   needs a changed database, so that case is covered by the unit tests and the API's own tests. */
import { PHONE, expect, openAs, test } from './support';

test('a visitor sees who the creator is, from the database', async ({ page }) => {
  await openAs(page, 'guest', '/creators/kenji-kitchen');
  const head = page.locator('[data-creator-head]');

  await expect(page.locator('main h1')).toHaveText('Kenji Watanabe');
  await expect(head.locator('.tag-good')).toHaveText('Verified creator');
  await expect(head).toContainText('@kenji-kitchen');
  await expect(head).toContainText('Japanese home cooking with a weeknight clock');
  await expect(head.locator('[data-stat="recipes"]')).toHaveText('2 published recipes');
  await expect(head.locator('[data-stat="saves"]')).toHaveText('7 times cooks saved these recipes');
  await expect(page).toHaveTitle('kenji-kitchen | Cookfeed');
});

test('a creator tile on Discover leads to the storefront', async ({ page }) => {
  await openAs(page, 'guest', '/');

  await page.locator('[data-creators]').getByRole('link', { name: 'Maria Conti' }).click();

  await expect(page).toHaveURL('/creators/maria-cooks');
  await expect(page.locator('main h1')).toHaveText('Maria Conti');
});

test('the recipes are listed most popular first, and newest first on request', async ({ page }) => {
  await openAs(page, 'guest', '/creators/kenji-kitchen');
  const titles = page.locator('[data-recipes] [data-recipe-id] h3');

  // Tamagoyaki has four saves and the newer Cucumber Sunomono three.
  await expect(titles).toHaveText(['Tamagoyaki', 'Cucumber Sunomono']);
  await expect(page.getByRole('button', { name: 'Most popular' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Newest' }).click();

  await expect(titles).toHaveText(['Cucumber Sunomono', 'Tamagoyaki']);
  await expect(page.getByRole('button', { name: 'Newest' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Most popular' })).toHaveAttribute('aria-pressed', 'false');
});

test('each recipe says when it was published and leads to the recipe', async ({ page }) => {
  await openAs(page, 'guest', '/creators/kenji-kitchen');
  const card = page.locator('[data-recipes] [data-recipe-id="16"]');

  await expect(card).toContainText('Published July 18, 2026');
  await expect(card).toContainText('Serves 2');
  await expect(card).toContainText('saved by 4 cooks');

  await card.getByRole('link', { name: 'Tamagoyaki' }).click();
  await expect(page).toHaveURL('/recipes/16');
});

test('what is for sale says what it is, what is in it and its price, and leads to the plan', async ({ page }) => {
  await openAs(page, 'guest', '/creators/kenji-kitchen');
  const card = page.locator('[data-for-sale] [data-product-id="3"]');

  await expect(card.locator('.pill')).toHaveText('Meal plan');
  await expect(card).toContainText('Monday, Tuesday, Wednesday dinners, each ready in 40 minutes or less. 3 recipes.');
  await expect(card.locator('[data-price]')).toHaveText('$12.99');

  await card.getByRole('link', { name: 'Three Weeknights in Japan' }).click();
  await expect(page).toHaveURL('/plans/3');
});

test('a visitor who signs in to buy comes back to the storefront, now as themselves', async ({ page }) => {
  await openAs(page, 'guest', '/creators/kenji-kitchen');

  await page.locator('[data-product-id="3"]').getByRole('link', { name: 'Sign in to buy' }).click();
  await expect(page).toHaveURL('/sign-in?next=%2Fcreators%2Fkenji-kitchen');

  await page.getByRole('button', { name: 'Sign in as Alex Rivera' }).click();
  await page.getByRole('link', { name: 'Back to the page you were on' }).click();

  // Alex bought Three Weeknights in Japan.
  await expect(page).toHaveURL('/creators/kenji-kitchen');
  await expect(page.locator('[data-product-id="3"] app-buy-area')).toContainText('You own this plan');
});

test('a cook is told what they own, and what is already in their cart', async ({ page }) => {
  // Alex paid for the Roman Pasta Collection, and cancelled the order for The Bread Box.
  await openAs(page, 'alex', '/creators/maria-cooks');
  await expect(page.locator('[data-product-id="1"] app-buy-area')).toContainText('You own this collection');
  await expect(page.locator('[data-product-id="1"]').getByRole('link', { name: 'See your orders' })).toHaveAttribute(
    'href',
    '/orders',
  );
  await expect(page.locator('[data-product-id="2"] app-buy-area')).not.toContainText('You own this');
});

test('a cook with the plan in their cart is led to the cart', async ({ page }) => {
  // The Bread Box is in Priya's seeded cart.
  await openAs(page, 'priya', '/creators/maria-cooks');

  await page.locator('[data-product-id="2"]').getByRole('link', { name: /In your cart/ }).click();

  await expect(page).toHaveURL('/cart');
});

test('a creator sees their own storefront without buying, and a way to the studio', async ({ page }) => {
  await openAs(page, 'kenji', '/creators/kenji-kitchen');

  await expect(page.locator('[data-own-storefront]')).toContainText('This is your storefront');
  await expect(page.locator('[data-product-id="3"] app-buy-area')).toHaveText(
    "This is your plan. Creators can't buy their own.",
  );

  await page.locator('[data-own-storefront]').getByRole('link', { name: 'My studio' }).click();
  await expect(page).toHaveURL('/studio');
});

test('the same creator is a shopper on someone else\'s storefront', async ({ page }) => {
  await openAs(page, 'kenji', '/creators/maria-cooks');

  await expect(page.locator('[data-own-storefront]')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText("Creators can't buy their own");
});

test('the admin, who cannot shop, sees the prices and no buying', async ({ page }) => {
  await openAs(page, 'admin', '/creators/kenji-kitchen');

  await expect(page.locator('[data-product-id="3"] [data-price]')).toHaveText('$12.99');
  await expect(page.locator('[data-product-id="3"] app-buy-area')).toHaveText('');
});

test.describe('a handle nobody has', () => {
  // The API answers 404 for this handle, and the browser logs every 404 it receives. That one line is expected.
  test.use({ expectedErrors: [/status of 404 \(Not Found\)/] });

  test('says so and leads back to Discover', async ({ page }) => {
    await openAs(page, 'guest', '/creators/nobody-here');

    await expect(page.locator('main h1')).toHaveText('Creator not found');
    await expect(page).toHaveTitle('Creator not found | Cookfeed');
    await page.getByRole('link', { name: 'Back to Discover' }).click();
    await expect(page).toHaveURL('/');
  });
});

test('a handle typed with capitals still finds the creator', async ({ page }) => {
  await openAs(page, 'guest', '/creators/Kenji-Kitchen');

  await expect(page.locator('main h1')).toHaveText('Kenji Watanabe');
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('the recipes are two across, and a plan has its picture above its text', async ({ page }) => {
    await openAs(page, 'guest', '/creators/kenji-kitchen');
    const cards = page.locator('[data-recipes] [data-recipe-id]');

    const [first, second] = await Promise.all([0, 1].map((i) => cards.nth(i).boundingBox()));
    expect(first!.y).toBeCloseTo(second!.y, 0);

    const plan = page.locator('[data-for-sale] [data-product-id="3"]');
    const picture = (await plan.locator('img').boundingBox())!;
    const title = (await plan.locator('h3').boundingBox())!;
    expect(picture.width).toBeGreaterThan(PHONE.width * 0.85);
    expect(title.y).toBeGreaterThanOrEqual(picture.y + picture.height);
  });
});
