/* A recipe's page, end to end: the recipe a cook follows, with ingredients that rescale for the people they are
   cooking for and steps that jump the video. A premium recipe opens only for its buyers and its creator; anyone
   else is told which plan it comes with. Seed: Tamagoyaki (16) is free; Chicken Teriyaki (5) is premium, in Three
   Weeknights in Japan (3), which Alex bought; Miso Soup (13) is Kenji's draft. */
import { expect, openAs, test } from './support';

test('a visitor opens a free recipe: who made it, what goes in, and how to make it', async ({ page }) => {
  await openAs(page, 'guest', '/recipes/16');

  await expect(page.locator('main h1')).toHaveText('Tamagoyaki');
  await expect(page).toHaveTitle('Tamagoyaki | Cookfeed');
  await expect(page.locator('[data-crumb]')).toHaveText('Kenji Watanabe › Recipes');
  await expect(page.locator('[data-recipe-head] .pill')).toHaveText('Recipe');
  await expect(page.locator('[data-facts]')).toHaveText('Serves 2 · 15 min total · saved by 4 cooks');

  await expect(page.locator('[data-ingredients] h2')).toHaveText('Ingredients for 2');
  await expect(page.locator('[data-ingredients] li')).toHaveCount(5);
  await expect(page.locator('[data-ingredients] li').first()).toHaveText('4 ea egg');
  await expect(page.locator('[data-ingredients] li').last()).toHaveText('1 tsp vegetable oil, for the pan');

  await expect(page.locator('[data-method] li')).toHaveCount(3);
  await expect(page.locator('[data-method] li').first()).toContainText('Beat the eggs with the soy sauce');
  await expect(page.locator('[data-method] li').first().getByRole('button')).toHaveText('Watch at 0:08');

  await page.locator('[data-recipe-foot]').getByRole('link', { name: /See every recipe from kenji-kitchen/ }).click();
  await expect(page).toHaveURL('/creators/kenji-kitchen');
});

test('a visitor is asked to sign in to save, and told what signing in offers', async ({ page }) => {
  await openAs(page, 'guest', '/recipes/16');

  await expect(page.locator('[data-save-note]')).toHaveText(
    'Sign in to keep this recipe in My kitchen, put it on your week, and shop it.',
  );
  await page.getByRole('link', { name: 'Sign in to save' }).click();
  await expect(page).toHaveURL('/sign-in?next=%2Frecipes%2F16');
});

test('the ingredients rescale for the people being cooked for', async ({ page }) => {
  await openAs(page, 'guest', '/recipes/16');
  const first = page.locator('[data-ingredients] li').first();

  await page.getByRole('button', { name: 'One more person' }).click();
  await page.getByRole('button', { name: 'One more person' }).click();
  await expect(page.locator('[data-ingredients] h2')).toHaveText('Ingredients for 4');
  await expect(first).toHaveText('8 ea egg');

  await page.getByLabel('Cooking for').fill('60');
  await expect(page.locator('[data-servings-error]')).toHaveText('Choose between 1 and 50 people.');
  await expect(first).toHaveText('8 ea egg');

  await page.getByRole('button', { name: 'Reset to 2 as written' }).click();
  await expect(first).toHaveText('4 ea egg');
  await expect(page.locator('[data-servings-error]')).toHaveText('');
});

test('a step jumps the video to its moment', async ({ page }) => {
  await openAs(page, 'guest', '/recipes/16');

  await expect(page.locator('[data-player-note]')).toHaveText('Tap a step below to jump to that moment.');
  await page.getByRole('button', { name: 'Watch at 0:16' }).click();

  await expect(page.locator('[data-player-note]')).toHaveText('Step 2 of 3');
  await expect(page.locator('[data-player-time]')).toHaveText('0:16');
  await expect(page.locator('[data-method] li[aria-current="step"]')).toContainText('Pour a thin layer');
});

test('a buyer opens a premium recipe from its plan and is led back to the plan', async ({ page }) => {
  await openAs(page, 'alex', '/plans/3');

  await page.locator('[data-included]').getByRole('link', { name: 'Chicken Teriyaki, the Real Way' }).click();
  await expect(page).toHaveURL('/recipes/5?product=3');

  await expect(page.locator('main h1')).toHaveText('Chicken Teriyaki, the Real Way');
  await expect(page.locator('[data-crumb]')).toHaveText('Three Weeknights in Japan › Monday dinner');
  await expect(page.locator('[data-recipe-head] .pill')).toHaveText('Monday dinner');
  await expect(page.locator('[data-owned-note]')).toHaveText('Yours through Three Weeknights in Japan');
  await expect(page.locator('[data-recipe-foot]')).toContainText('One of 3 recipes in Three Weeknights in Japan.');

  await page.locator('[data-recipe-foot]').getByRole('link', { name: /Back to Three Weeknights in Japan/ }).click();
  await expect(page).toHaveURL('/plans/3');
});

test('its creator opens a premium recipe and is told who else can', async ({ page }) => {
  await openAs(page, 'kenji', '/recipes/5');

  await expect(page.locator('[data-owned-note]')).toHaveText('Only buyers of your plans can open this recipe.');
});

test('a creator opens their own draft, marked as one', async ({ page }) => {
  await openAs(page, 'kenji', '/recipes/13');

  await expect(page.locator('[data-recipe-head] .pill')).toHaveText('Draft');
  await expect(page.locator('[data-owned-note]')).toHaveText('A draft. Only you can see it until you publish it.');
});

test.describe('a premium recipe the viewer has not bought', () => {
  // The API answers 403 for it, and the browser logs that response.
  test.use({ expectedErrors: [/status of 403 \(Forbidden\)/] });

  test('names the plan it comes with, for a visitor', async ({ page }) => {
    await openAs(page, 'guest', '/recipes/5');

    await expect(page.locator('main h1')).toHaveText('Chicken Teriyaki, the Real Way');
    await expect(page.locator('[data-locked]')).toContainText(
      'This recipe comes with Three Weeknights in Japan. Buy it to open the recipe.',
    );
    await expect(page.locator('[data-ingredients]')).toHaveCount(0);

    await page.locator('[data-locked]').getByRole('link', { name: 'Three Weeknights in Japan' }).click();
    await expect(page).toHaveURL('/plans/3');
  });

  test('tells the admin, who never buys, who can open it', async ({ page }) => {
    await openAs(page, 'admin', '/recipes/5');

    await expect(page.locator('[data-locked]')).toHaveText(
      'A premium recipe. Only its creator and the cooks who own its plan can open it.',
    );
  });
});

test.describe('an address with no recipe a visitor may see', () => {
  // The API answers 404, and the browser logs that response.
  test.use({ expectedErrors: [/status of 404 \(Not Found\)/] });

  test('says there is no recipe there, for an id that names none', async ({ page }) => {
    await openAs(page, 'guest', '/recipes/999');

    await expect(page.locator('main h1')).toHaveText('Recipe not found');
    await expect(page.locator('main')).toContainText('There is no recipe at this address.');
  });

  test('says the same for someone else\'s draft, so a draft stays private', async ({ page }) => {
    await openAs(page, 'guest', '/recipes/13');

    await expect(page.locator('main h1')).toHaveText('Recipe not found');
  });
});
