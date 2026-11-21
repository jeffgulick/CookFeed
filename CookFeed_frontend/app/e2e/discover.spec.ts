/* Discover, end to end: a first-time visitor is told what Cookfeed is before anything else; the plans for sale,
   the trending recipes and the creators come from the database; and a signed-in cook is welcomed by name and shown
   what they already own. */
import { PHONE, expect, openAs, test } from './support';

test('a first-time visitor is told what Cookfeed is, how it works, and where to go next', async ({ page }) => {
  await openAs(page, 'guest', '/');

  await expect(page.locator('main h1')).toHaveText('Cook the week, shop once');
  await expect(page.locator('[data-how-it-works] h3')).toHaveText(['Watch', 'Plan', 'Shop once']);

  await page.locator('[data-hero]').getByRole('link', { name: 'Browse meal plans' }).click();
  await expect(page).toHaveURL('/plans');
});

test('a guest sees the plans and collections for sale, each with what it is, its rating and its price', async ({
  page,
}) => {
  await openAs(page, 'guest', '/');
  const tiles = page.locator('[data-plans] [data-product-id]');

  // The seed's four products for sale, newest first; the retired grilling collection is not among them.
  await expect(tiles.locator('h3')).toHaveText([
    'Family Week on a Budget',
    'The Bread Box',
    'Three Weeknights in Japan',
    'Roman Pasta Collection',
  ]);
  await expect(tiles.locator('[data-price]')).toHaveText(['$9.99', '$4.99', '$12.99', '$7.99']);
  await expect(page.locator('[data-plans] [data-owned]')).toHaveCount(0);

  await expect(tiles.nth(3)).toContainText('Recipe collection');
  await expect(tiles.nth(3)).toContainText('no reviews yet');
  await expect(tiles.nth(2)).toContainText('Meal plan');
  await expect(tiles.nth(2)).toContainText('by kenji-kitchen');
  await expect(tiles.nth(2).locator('[data-rating]')).toContainText('4.0');
  await expect(tiles.nth(2).locator('[data-rating]')).toContainText('(3 reviews)');
  // The oats are served twice, so the plan has more meals than recipes.
  await expect(tiles.nth(0)).toContainText('5 recipes, 6 meals');
});

test('a signed-in cook is welcomed by name and shown which plans they already own', async ({ page }) => {
  await openAs(page, 'alex', '/');
  const tiles = page.locator('[data-plans] [data-product-id]');

  await expect(page.locator('[data-greeting]')).toHaveText('Welcome back, Alex.');
  // Alex bought three of the four; only the Bread Box still shows a price.
  await expect(page.locator('[data-plans] [data-owned]')).toHaveText(['You own this', 'You own this', 'You own this']);
  await expect(page.locator('[data-plans] [data-price]')).toHaveText(['$4.99']);
  await expect(tiles.nth(1)).toContainText('The Bread Box');
});

test('signing out on the home page takes "You own this" away without a reload', async ({ page }) => {
  await openAs(page, 'alex', '/');
  await expect(page.locator('[data-plans] [data-owned]')).toHaveCount(3);

  await page.getByRole('button', { name: 'Alex Rivera' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();

  await expect(page.locator('[data-plans] [data-owned]')).toHaveCount(0);
  await expect(page.locator('[data-plans] [data-price]')).toHaveCount(4);
  await expect(page.locator('[data-greeting]')).toContainText('a shopping list built from what you cook');
});

test('a plan tile leads to the plan wherever it is clicked', async ({ page }) => {
  await openAs(page, 'guest', '/');
  const tile = page.locator('[data-plans] [data-product-id]').nth(2);

  await tile.scrollIntoViewIfNeeded();
  const picture = (await tile.locator('img').boundingBox())!;
  await page.mouse.click(picture.x + picture.width / 2, picture.y + picture.height / 2);

  await expect(page).toHaveURL('/plans/3');
});

test('the creators are listed in the order they joined, and each tile leads to a storefront', async ({ page }) => {
  await openAs(page, 'guest', '/');
  const tiles = page.locator('[data-creators] [data-creator-handle]');

  await expect(tiles.locator('h3')).toHaveText(['Maria Conti', 'Kenji Watanabe', 'Dan Okafor']);
  await expect(tiles.nth(0)).toContainText('@maria-cooks');
  // Maria and Kenji are verified; Dan is not.
  await expect(tiles.locator('.tag-good')).toHaveText(['Verified', 'Verified']);

  await tiles.nth(1).getByRole('link', { name: 'Kenji Watanabe' }).click();
  await expect(page).toHaveURL('/creators/kenji-kitchen');
});

test('the trending recipes are the six free recipes saved most, most saved first', async ({ page }) => {
  await openAs(page, 'guest', '/');
  const cards = page.locator('[data-trending] [data-recipe-id]');

  await expect(cards).toHaveCount(6);
  const saves = (await cards.allInnerTexts()).map((text) => Number(/saved by (\d+) cooks?/.exec(text)![1]));
  expect(saves).toEqual([...saves].sort((a, b) => b - a));

  // The seed's most-saved free recipe, with what its card says about it.
  await expect(cards.first()).toContainText('Sheet-Pan Chicken and Vegetables');
  await expect(cards.first()).toContainText('by dan-meal-preps');
  await expect(cards.first()).toContainText('saved by 7 cooks');
});

test('a card leads to its recipe wherever it is clicked', async ({ page }) => {
  await openAs(page, 'guest', '/');
  const first = page.locator('[data-trending] [data-recipe-id]').first();
  const id = await first.getAttribute('data-recipe-id');

  // The link is stretched over the whole card, so a click on the picture lands on it, as a person's would.
  await first.scrollIntoViewIfNeeded();
  const picture = (await first.locator('img').boundingBox())!;
  await page.mouse.click(picture.x + picture.width / 2, picture.y + picture.height / 2);

  await expect(page).toHaveURL(`/recipes/${id}`);
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('the recipes are two across, and the main buttons span the screen', async ({ page }) => {
    await openAs(page, 'guest', '/');
    const cards = page.locator('[data-trending] [data-recipe-id]');

    const [first, second, third] = await Promise.all([0, 1, 2].map((i) => cards.nth(i).boundingBox()));
    expect(first!.y).toBeCloseTo(second!.y, 0);
    expect(third!.y).toBeGreaterThan(first!.y);

    const button = (await page.locator('[data-hero] a').first().boundingBox())!;
    expect(button.width).toBeGreaterThan(PHONE.width * 0.7);
    expect(button.height).toBeGreaterThanOrEqual(44);
  });

  test('a plan spans the screen, with its whole cover picture above its text', async ({ page }) => {
    await openAs(page, 'guest', '/');
    const tiles = page.locator('[data-plans] [data-product-id]');

    const [first, second] = await Promise.all([0, 1].map((i) => tiles.nth(i).boundingBox()));
    expect(first!.width).toBeGreaterThan(PHONE.width * 0.85);
    expect(second!.y).toBeGreaterThan(first!.y);

    // The covers are 960 by 400 banners; the tile keeps that shape, so nothing is cropped away.
    const picture = (await tiles.first().locator('img').boundingBox())!;
    const title = (await tiles.first().locator('h3').boundingBox())!;
    expect(picture.width / picture.height).toBeCloseTo(960 / 400, 1);
    expect(title.y).toBeGreaterThanOrEqual(picture.y + picture.height);
  });
});
