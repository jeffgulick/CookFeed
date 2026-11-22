/* Saving a recipe, end to end: a cook saves a recipe from its page, finds it in My kitchen, and unsaves it there.
   Saving changes a number every visitor sees ("saved by 5 cooks") and the order of the most-saved lists, so this
   spec runs after all the others (playwright.config.ts), signed in as Tomas, and leaves the saves as it found
   them. The seed has Caprese Salad saved by 5 cooks, and not by Tomas. */
import { expect, openAs, test } from './support';

test.describe.configure({ mode: 'serial' });

test('a cook saves a recipe from its page, and the count goes up', async ({ page }) => {
  await openAs(page, 'tomas', '/recipes/15');
  await expect(page.locator('[data-facts]')).toContainText('saved by 5 cooks');

  await page.getByRole('button', { name: 'Save recipe' }).click();

  await expect(page.locator('[data-save-area]')).toContainText('Saved in My kitchen');
  await expect(page.getByRole('button', { name: 'Unsave' })).toBeVisible();
  await expect(page.locator('[data-facts]')).toContainText('saved by 6 cooks');
  await expect(page.locator('[data-toast]')).toContainText('Caprese Salad is saved in My kitchen.');
});

test('the save is still there after a reload, and the recipe is in My kitchen', async ({ page }) => {
  await openAs(page, 'tomas', '/recipes/15');
  await expect(page.locator('[data-save-area]')).toContainText('Saved in My kitchen');

  await openAs(page, 'tomas', '/kitchen');
  // The newest save comes first.
  await expect(page.locator('[data-saved-recipes] [data-recipe-id] h3').first()).toHaveText('Caprese Salad');
  await expect(page.locator('[data-saved-recipes] [data-recipe-id]')).toHaveCount(6);
});

test('everyone sees the new count', async ({ page }) => {
  await openAs(page, 'guest', '/recipes/15');

  await expect(page.locator('[data-facts]')).toContainText('saved by 6 cooks');
});

test('a cook unsaves it from My kitchen, and the count goes back', async ({ page }) => {
  await openAs(page, 'tomas', '/kitchen');

  await page.getByRole('button', { name: 'Unsave Caprese Salad' }).click();

  await expect(page.locator('[data-saved-recipes] [data-recipe-id]')).toHaveCount(5);
  await expect(page.locator('[data-toast]')).toContainText('Caprese Salad is no longer saved.');

  await openAs(page, 'tomas', '/recipes/15');
  await expect(page.locator('[data-facts]')).toContainText('saved by 5 cooks');
  await expect(page.getByRole('button', { name: 'Save recipe' })).toBeVisible();
});
