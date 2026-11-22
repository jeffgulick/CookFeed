/* A meal plan or collection's page, end to end. What it shows depends on where the viewer stands with it: someone
   deciding sees the price and the pitch, with the premium recipes locked; a buyer sees the recipes opened and the
   shopping list; the creator and the admin see the plan without a pitch. Seed: Three Weeknights in Japan (3) is
   Kenji's and Alex bought it; Alex can open one of The Bread Box's (2) two recipes; Summer Grilling (5) is retired. */
import { PHONE, expect, openAs, test } from './support';

test('a visitor deciding sees what the plan is, its price, the pitch, and the recipes locked', async ({ page }) => {
  await openAs(page, 'guest', '/plans/3');

  await expect(page.locator('main h1')).toHaveText('Three Weeknights in Japan');
  await expect(page).toHaveTitle('Three Weeknights in Japan | Cookfeed');
  await expect(page.locator('[data-plan-head] .pill')).toHaveText('Meal plan');
  await expect(page.locator('[data-plan-head]')).toContainText('Monday, Tuesday, Wednesday dinners');
  await expect(page.locator('[data-price]')).toHaveText('$12.99');
  await expect(page.locator('[data-price-note]')).toHaveText('One-time purchase · yours to keep · 3 recipes');
  await expect(page.locator('app-buy-area')).toContainText('Sign in to buy');

  await expect(page.locator('[data-what-you-get] h2')).toHaveText('What your $12.99 gets you');
  await expect(page.locator('[data-what-you-get] li')).toHaveCount(5);

  const cards = page.locator('[data-included] [data-plan-recipe]');
  await expect(cards.locator('[data-label]')).toHaveText(['Monday dinner', 'Tuesday dinner', 'Wednesday dinner']);
  await expect(cards.locator('h3')).toHaveText([
    'Chicken Teriyaki, the Real Way',
    '10-Minute Ginger Garlic Stir-Fry',
    'Onigiri Three Ways',
  ]);
  await expect(cards.locator('[data-locked]')).toHaveText(Array(3).fill('Included when you buy the plan'));
  await expect(cards.locator('a')).toHaveCount(0);

  await expect(page.locator('[data-what-you-buy]')).toContainText(
    'Buy it and every ingredient for all 3 meals is listed here, combined, sorted by aisle.',
  );
  await expect(page.locator('[data-what-you-buy] table')).toHaveCount(0);
});

test('the byline leads to the creator and the rating to the reviews', async ({ page }) => {
  await openAs(page, 'guest', '/plans/3');

  await expect(page.locator('[data-plan-head]').getByRole('link', { name: /4\.0.*3 reviews/ })).toHaveAttribute(
    'href',
    '/plans/3/reviews',
  );
  await page.locator('[data-plan-head]').getByRole('link', { name: 'kenji-kitchen' }).click();
  await expect(page).toHaveURL('/creators/kenji-kitchen');
});

test('a buyer sees the recipes opened and everything to buy, with no price or pitch', async ({ page }) => {
  await openAs(page, 'alex', '/plans/3');

  await expect(page.locator('app-buy-area')).toContainText('You own this plan');
  await expect(page.locator('[data-price]')).toHaveCount(0);
  await expect(page.locator('[data-what-you-get]')).toHaveCount(0);

  const first = page.locator('[data-included] [data-plan-recipe]').first();
  await expect(first.getByRole('link', { name: 'Chicken Teriyaki, the Real Way' })).toHaveAttribute(
    'href',
    '/recipes/5?product=3',
  );
  await expect(first).toContainText('5 min prep · 15 min cook');
  await expect(first).toContainText('7 ingredients · 3 steps');
  await expect(first).toContainText('First: Sear the thighs skin-side down');
  await expect(page.locator('[data-included] [data-locked]')).toHaveCount(0);

  const list = page.locator('[data-what-you-buy]');
  await expect(list).toContainText(
    'For Chicken Teriyaki, the Real Way, 10-Minute Ginger Garlic Stir-Fry and Onigiri Three Ways.',
  );
  await expect(list).toContainText('Amounts as each recipe is written.');
  await expect(list.locator('tbody tr')).toHaveCount(22);
  // Sorted by aisle, then ingredient: Beverages comes first.
  await expect(list.locator('tbody tr').first()).toContainText('2 tbsp');
  await expect(list.locator('tbody tr').first()).toContainText('sake');
  await expect(list.locator('tbody tr').first()).toContainText('Beverages');
});

test('a cook who can open only some of a collection is told what is not on the list yet', async ({ page }) => {
  // Alex owns the focaccia through the Roman Pasta Collection, and has not bought the ciabatta.
  await openAs(page, 'alex', '/plans/2');

  await expect(page.locator('[data-plan-head] .pill')).toHaveText('Recipe collection');
  await expect(page.locator('[data-included] [data-locked]')).toHaveText(['Included when you buy the collection']);
  await expect(page.locator('[data-what-you-buy]')).toContainText('For No-Knead Focaccia.');
  await expect(page.locator('[data-what-you-buy]')).toContainText(
    'Not on this list yet: Rosemary Ciabatta. Its ingredients are added when you buy the collection.',
  );
});

test('the creator sees their own plan with its price and no pitch', async ({ page }) => {
  await openAs(page, 'kenji', '/plans/3');

  await expect(page.locator('[data-price]')).toHaveText('$12.99');
  await expect(page.locator('app-buy-area')).toHaveText("This is your plan. Creators can't buy their own.");
  await expect(page.locator('[data-what-you-get]')).toHaveCount(0);
  await expect(page.locator('[data-included] [data-locked]')).toHaveCount(0);
});

test('the admin sees the plan with nothing to buy and the premium recipes closed', async ({ page }) => {
  await openAs(page, 'admin', '/plans/3');

  await expect(page.locator('app-buy-area')).toHaveText('');
  await expect(page.locator('[data-what-you-buy]')).toHaveCount(0);
  await expect(page.locator('[data-included] [data-locked]')).toHaveText(Array(3).fill('Premium recipe'));
});

test('a retired plan says it is no longer for sale', async ({ page }) => {
  await openAs(page, 'guest', '/plans/5');

  await expect(page.locator('main h1')).toHaveText('Summer Grilling (retired)');
  await expect(page.locator('app-buy-area')).toHaveText('No longer for sale');
  await expect(page.locator('[data-included]')).toContainText('This collection has no recipes listed.');
  await expect(page.locator('[data-what-you-buy]')).toHaveCount(0);
});

test('a plan tile on Discover opens the plan', async ({ page }) => {
  await openAs(page, 'guest', '/');

  await page.locator('[data-plans]').getByRole('link', { name: 'The Bread Box' }).click();

  await expect(page).toHaveURL('/plans/2');
  await expect(page.locator('main h1')).toHaveText('The Bread Box');
});

test.describe('an address that names no plan', () => {
  // The API answers 404 for the plan and for its list, and the browser logs each 404 it receives.
  test.use({ expectedErrors: [/status of 404 \(Not Found\)/] });

  test('says so and leads back to the plans', async ({ page }) => {
    await openAs(page, 'guest', '/plans/999');

    await expect(page.locator('main h1')).toHaveText('Plan not found');
    await expect(page.locator('main')).toContainText('There is no meal plan or collection at this address.');
    await expect(page.getByRole('link', { name: 'See every plan and collection' })).toHaveAttribute('href', '/plans');
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('the recipes are two across and the shopping list fits the screen', async ({ page }) => {
    await openAs(page, 'alex', '/plans/3');
    const cards = page.locator('[data-included] [data-plan-recipe]');

    const [first, second] = await Promise.all([0, 1].map((i) => cards.nth(i).boundingBox()));
    expect(first!.y).toBeCloseTo(second!.y, 0);

    const table = (await page.locator('[data-what-you-buy] table').boundingBox())!;
    expect(table.x + table.width).toBeLessThanOrEqual(PHONE.width);
  });
});
