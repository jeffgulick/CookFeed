/* My kitchen, end to end, reading the seed: the plans a cook bought and the recipes they saved. Alex owns three
   plans and saved six recipes; Sam has bought nothing and saved five. */
import { PHONE, contentWidth, expect, openAs, test } from './support';

test('a cook sees the plans they bought, each leading to its page', async ({ page }) => {
  await openAs(page, 'alex', '/kitchen');

  await expect(page.locator('main h1')).toHaveText('Your kitchen');
  await expect(page).toHaveTitle('My kitchen | Cookfeed');

  const plans = page.locator('[data-your-plans] [data-product-id]');
  await expect(plans.locator('h3')).toHaveText([
    'Roman Pasta Collection',
    'Three Weeknights in Japan',
    'Family Week on a Budget',
  ]);
  await expect(plans.nth(2)).toContainText('Meal plan');
  await expect(plans.nth(2)).toContainText('5 recipes, 6 meals · yours to keep');

  await plans.nth(1).getByRole('link', { name: 'Three Weeknights in Japan' }).click();
  await expect(page).toHaveURL('/plans/3');
});

test('a cook sees the recipes they saved, newest first, each leading to its recipe', async ({ page }) => {
  await openAs(page, 'alex', '/kitchen');

  const saved = page.locator('[data-saved-recipes] [data-recipe-id]');
  await expect(saved.locator('h3')).toHaveText([
    '10-Minute Ginger Garlic Stir-Fry',
    'Brown Butter Chocolate Chip Cookies',
    'Chicken Teriyaki, the Real Way',
    'Saturday Buttermilk-Style Pancakes',
    'No-Knead Focaccia',
    '15-Minute Spaghetti Carbonara',
  ]);
  await expect(saved.first().getByRole('button', { name: 'Unsave 10-Minute Ginger Garlic Stir-Fry' })).toBeVisible();

  await saved.nth(2).getByRole('link', { name: 'Chicken Teriyaki, the Real Way' }).click();
  await expect(page).toHaveURL('/recipes/5');
});

test('a cook who has bought nothing is pointed to the plans', async ({ page }) => {
  await openAs(page, 'sam', '/kitchen');

  await expect(page.locator('[data-your-plans]')).toContainText('You have not bought a plan yet.');
  await expect(page.locator('[data-saved-recipes] [data-recipe-id]')).toHaveCount(5);
  await page.locator('[data-your-plans]').getByRole('link', { name: 'See the meal plans and collections' }).click();
  await expect(page).toHaveURL('/plans');
});

test('a visitor is asked to sign in, and comes back to the kitchen', async ({ page }) => {
  await openAs(page, 'guest', '/kitchen');

  await expect(page.locator('main').getByRole('link', { name: 'Sign in to see your kitchen' })).toHaveAttribute(
    'href',
    '/sign-in?next=%2Fkitchen',
  );
});

test('the admin is told admin accounts have no kitchen', async ({ page }) => {
  await openAs(page, 'admin', '/kitchen');

  await expect(page.locator('main')).toContainText('Admin accounts do not save recipes or shop.');
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('the kitchen fits the screen', async ({ page }) => {
    await openAs(page, 'alex', '/kitchen');

    await expect(page.locator('[data-saved-recipes] [data-recipe-id]')).toHaveCount(6);
    expect(await contentWidth(page)).toBeLessThanOrEqual(PHONE.width);
  });
});
