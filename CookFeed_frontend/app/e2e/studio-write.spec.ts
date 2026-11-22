/* My studio, the changes: a creator unpublishes and publishes a recipe, and retires and restores a plan, each after
   confirming. These change what every visitor sees (a recipe leaves Discover, a plan leaves the store), so this
   spec runs after all the others have finished (the "last" project in playwright.config.ts), in order, and each
   test puts back what it changed. */
import { expect, openAs, test } from './support';

test.describe.configure({ mode: 'serial' });

test('unpublishing a recipe asks first; Cancel changes nothing', async ({ page }) => {
  await openAs(page, 'kenji', '/studio');
  const row = page.locator('[data-recipes] tbody tr').filter({ hasText: 'Cucumber Sunomono' });

  await row.getByRole('button', { name: 'Unpublish: Cucumber Sunomono' }).click();
  await expect(page.getByRole('dialog')).toContainText('Unpublish "Cucumber Sunomono"? Only you will see it.');
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  await expect(row.locator('td').nth(1)).toHaveText('Published');
});

test('a recipe is unpublished and becomes a draft, then published again', async ({ page }) => {
  await openAs(page, 'kenji', '/studio');
  const row = page.locator('[data-recipes] tbody tr').filter({ hasText: 'Cucumber Sunomono' });

  await row.getByRole('button', { name: 'Unpublish: Cucumber Sunomono' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Unpublish' }).click();

  await expect(page.locator('[data-toast]')).toContainText('"Cucumber Sunomono" is a draft again.');
  await expect(row.locator('td').nth(1)).toHaveText('Draft');
  await expect(page.locator('[data-stat]').first()).toHaveText('4 published recipes, free and premium, plus 2 drafts');

  // A visitor no longer finds it.
  await openAs(page, 'kenji', '/creators/kenji-kitchen');
  await expect(page.locator('main [data-recipe-id="17"]')).toHaveCount(0);

  await openAs(page, 'kenji', '/studio');
  await row.getByRole('button', { name: 'Publish: Cucumber Sunomono' }).click();
  await expect(page.getByRole('dialog')).toContainText('Publish "Cucumber Sunomono"? Anyone will be able to open and save it.');
  await page.getByRole('dialog').getByRole('button', { name: 'Publish' }).click();

  await expect(page.locator('[data-toast]')).toContainText('"Cucumber Sunomono" is published.');
  await expect(row.locator('td').nth(1)).toHaveText('Published');
  await expect(page.locator('[data-stat]').first()).toHaveText('5 published recipes, free and premium, plus 1 draft');
});

test('a plan is retired and leaves the store, then restored', async ({ page }) => {
  await openAs(page, 'kenji', '/studio');
  const row = page.locator('[data-products] tbody tr').filter({ hasText: 'Three Weeknights in Japan' });

  await row.getByRole('button', { name: 'Retire: Three Weeknights in Japan' }).click();
  await expect(page.getByRole('dialog')).toContainText(
    'Retire "Three Weeknights in Japan"? It leaves the store; everyone who bought it keeps it.',
  );
  await page.getByRole('dialog').getByRole('button', { name: 'Retire' }).click();

  await expect(page.locator('[data-toast]')).toContainText('"Three Weeknights in Japan" is retired.');
  await expect(row.locator('td').nth(4)).toHaveText('Retired');
  await expect(page.locator('[data-stat]').nth(1)).toHaveText('0 plans for sale');

  await row.getByRole('button', { name: 'Restore: Three Weeknights in Japan' }).click();
  await expect(page.getByRole('dialog')).toContainText('Put "Three Weeknights in Japan" back on sale?');
  await page.getByRole('dialog').getByRole('button', { name: 'Restore' }).click();

  await expect(page.locator('[data-toast]')).toContainText('"Three Weeknights in Japan" is for sale again.');
  await expect(row.locator('td').nth(4)).toHaveText('For sale');
  await expect(page.locator('[data-stat]').nth(1)).toHaveText('1 plan for sale');
});
