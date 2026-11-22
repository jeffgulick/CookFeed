/* The Recipes page, end to end: every free recipe, searched and sorted. Seed: six free recipes, two each from
   Dan (dan-meal-preps), Maria (maria-cooks) and Kenji (kenji-kitchen). The premium recipes, such as Chicken
   Teriyaki, are sold inside plans and never listed here. */
import { PHONE, contentWidth, expect, openAs, test } from './support';

const MOST_SAVED = [
  'Sheet-Pan Chicken and Vegetables',
  'Cacio e Pepe',
  'Caprese Salad',
  'Tamagoyaki',
  'Black Bean Quesadillas',
  'Cucumber Sunomono',
];

test('a visitor sees every free recipe, most saved first, and how many there are', async ({ page }) => {
  await openAs(page, 'guest', '/recipes');

  await expect(page.locator('main h1')).toHaveText('Free recipes');
  await expect(page).toHaveTitle('Recipes | Cookfeed');
  await expect(page.locator('main [data-recipe-id] h3')).toHaveText(MOST_SAVED);
  await expect(page.locator('[data-showing]')).toHaveText('6 free recipes');
  await expect(page.locator('main [data-recipe-id]').first()).toContainText('by dan-meal-preps');
  await expect(page.getByRole('button', { name: 'Most saved' })).toHaveAttribute('aria-pressed', 'true');
});

test('the recipes can be sorted newest first', async ({ page }) => {
  await openAs(page, 'guest', '/recipes');

  await page.getByRole('button', { name: 'Newest' }).click();

  await expect(page.locator('main [data-recipe-id] h3')).toHaveText([
    'Black Bean Quesadillas',
    'Sheet-Pan Chicken and Vegetables',
    'Cucumber Sunomono',
    'Tamagoyaki',
    'Caprese Salad',
    'Cacio e Pepe',
  ]);
  await expect(page.getByRole('button', { name: 'Newest' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Most saved' })).toHaveAttribute('aria-pressed', 'false');
});

test('Find matches a recipe by its title or its creator, in any letter case', async ({ page }) => {
  await openAs(page, 'guest', '/recipes');
  const titles = page.locator('main [data-recipe-id] h3');
  const find = page.getByLabel('Find');

  await find.fill('CAPRESE');
  await expect(titles).toHaveText(['Caprese Salad']);
  await expect(page.locator('[data-showing]')).toHaveText('1 free recipe');

  await find.fill('kenji');
  await expect(titles).toHaveText(['Tamagoyaki', 'Cucumber Sunomono']);

  // A creator's name, not only the handle.
  await find.fill('maria conti');
  await expect(titles).toHaveText(['Cacio e Pepe', 'Caprese Salad']);

  await find.fill('');
  await expect(titles).toHaveText(MOST_SAVED);
});

test('a search that matches nothing says so, and a premium recipe is never listed', async ({ page }) => {
  await openAs(page, 'guest', '/recipes');

  // Chicken Teriyaki is published, but sold inside Three Weeknights in Japan.
  await page.getByLabel('Find').fill('teriyaki');

  await expect(page.locator('main')).toContainText('No free recipe matches.');
  await expect(page.locator('main [data-recipe-id]')).toHaveCount(0);
  await expect(page.locator('[data-showing]')).toHaveText('0 free recipes');
});

test('a card leads to its recipe, and the page leads to the plans', async ({ page }) => {
  await openAs(page, 'guest', '/recipes');

  await page.getByRole('link', { name: 'Tamagoyaki' }).click();
  await expect(page).toHaveURL('/recipes/16');

  await page.goBack();
  await page.locator('main').getByRole('link', { name: 'meal plans and collections' }).click();
  await expect(page).toHaveURL('/plans');
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('the search and sort fit the screen', async ({ page }) => {
    await openAs(page, 'guest', '/recipes');

    await expect(page.locator('main [data-recipe-id]')).toHaveCount(6);
    expect(await contentWidth(page)).toBeLessThanOrEqual(PHONE.width);
  });
});
