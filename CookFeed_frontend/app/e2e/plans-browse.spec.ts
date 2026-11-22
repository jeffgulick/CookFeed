/* The Plans page, end to end: every meal plan and collection for sale, filtered by kind and sorted. Seed: four for
   sale, newest first Family Week on a Budget (meal plan, $9.99), The Bread Box (collection, $4.99), Three Weeknights
   in Japan (meal plan, $12.99, the only one reviewed) and the Roman Pasta Collection ($7.99). */
import { PHONE, contentWidth, expect, openAs, test } from './support';

const NEWEST = ['Family Week on a Budget', 'The Bread Box', 'Three Weeknights in Japan', 'Roman Pasta Collection'];

test('a visitor sees everything for sale, newest first, and how many there are', async ({ page }) => {
  await openAs(page, 'guest', '/plans');

  await expect(page.locator('main h1')).toHaveText('Meal plans and collections');
  await expect(page).toHaveTitle('Plans & collections | Cookfeed');
  await expect(page.locator('main [data-product-id] h3')).toHaveText(NEWEST);
  await expect(page.locator('[data-showing]')).toHaveText('Showing all 4 plans');
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('the list can be narrowed to meal plans or to collections, and widened again', async ({ page }) => {
  await openAs(page, 'guest', '/plans');
  const titles = page.locator('main [data-product-id] h3');

  await page.getByRole('button', { name: 'Meal plans', exact: true }).click();
  await expect(titles).toHaveText(['Family Week on a Budget', 'Three Weeknights in Japan']);
  await expect(page.locator('[data-showing]')).toHaveText('Showing 2 of 4');
  await expect(page.getByRole('button', { name: 'Meal plans', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'All', exact: true })).toHaveAttribute('aria-pressed', 'false');

  await page.getByRole('button', { name: 'Collections', exact: true }).click();
  await expect(titles).toHaveText(['The Bread Box', 'Roman Pasta Collection']);

  await page.getByRole('button', { name: 'All', exact: true }).click();
  await expect(titles).toHaveText(NEWEST);
});

test('the list can be sorted by price and by rating', async ({ page }) => {
  await openAs(page, 'guest', '/plans');
  const titles = page.locator('main [data-product-id] h3');

  await page.getByLabel('Sort by').selectOption('Price, low to high');
  await expect(titles).toHaveText([
    'The Bread Box',
    'Roman Pasta Collection',
    'Family Week on a Budget',
    'Three Weeknights in Japan',
  ]);

  // The one reviewed plan leads; the rest follow in the order they were added.
  await page.getByLabel('Sort by').selectOption('Best rated');
  await expect(titles.first()).toHaveText('Three Weeknights in Japan');

  // A sort keeps the filter.
  await page.getByRole('button', { name: 'Collections', exact: true }).click();
  await page.getByLabel('Sort by').selectOption('Price, low to high');
  await expect(titles).toHaveText(['The Bread Box', 'Roman Pasta Collection']);
});

test('a signed-in cook sees which plans they own, and a tile leads to its plan', async ({ page }) => {
  await openAs(page, 'alex', '/plans');

  await expect(page.locator('main [data-owned]')).toHaveCount(3);
  await expect(page.locator('main [data-price]')).toHaveText(['$4.99']);

  await page.getByRole('link', { name: 'The Bread Box' }).click();
  await expect(page).toHaveURL('/plans/2');
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('the filter and sort fit the screen', async ({ page }) => {
    await openAs(page, 'guest', '/plans');

    await expect(page.locator('main [data-product-id]')).toHaveCount(4);
    expect(await contentWidth(page)).toBeLessThanOrEqual(PHONE.width);
  });
});
