/* A plan's reviews page, end to end: the rating in three numbers, the reviews with a sort and two filters, and a
   line that says who may review. Seed: Three Weeknights in Japan (3) has three reviews, by Alex (5 stars), Priya
   (4) and Dan (3, does not recommend); the Roman Pasta Collection (1) has none. */
import { expect, openAs, test } from './support';

test('a visitor sees the rating in three numbers and the reviews newest first', async ({ page }) => {
  await openAs(page, 'guest', '/plans/3/reviews');

  await expect(page.locator('main h1')).toHaveText('Three Weeknights in Japan');
  await expect(page).toHaveTitle('Reviews of Three Weeknights in Japan | Cookfeed');
  await expect(page.locator('[data-average]')).toHaveText('4.0');
  await expect(page.locator('[data-review-count]')).toHaveText('3 reviews');
  await expect(page.locator('[data-recommend]')).toContainText('67%');
  await expect(page.locator('[data-recommend]')).toContainText('would recommend this plan');

  const reviews = page.locator('[data-review]');
  await expect(reviews.locator('[data-reviewer]')).toHaveText(['Alex Rivera', 'Priya Shah', 'Dan Okafor']);
  await expect(reviews.first().getByLabel('5 out of 5 stars')).toBeVisible();
  await expect(reviews.first()).toContainText('Recommends');
  await expect(reviews.first()).toContainText('August 12, 2026');
  await expect(reviews.first()).toContainText('I bought this on a Sunday');
  await expect(reviews.last()).toContainText('Does not recommend');
  await expect(page.locator('[data-showing]')).toHaveText('Showing all 3 reviews');
});

test('the reviews can be narrowed by stars and by recommendation, sorted, and reset', async ({ page }) => {
  await openAs(page, 'guest', '/plans/3/reviews');
  const names = page.locator('[data-review] [data-reviewer]');

  await page.getByRole('button', { name: /^3 ★ 1 review/ }).click();
  await expect(names).toHaveText(['Dan Okafor']);
  await expect(page.locator('[data-showing]')).toHaveText('Showing 1 of 3 reviews');

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(names).toHaveCount(3);

  await page.getByLabel('Recommends only').check();
  await expect(names).toHaveText(['Alex Rivera', 'Priya Shah']);

  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByLabel('Sort').selectOption('Lowest rated');
  await expect(names).toHaveText(['Dan Okafor', 'Priya Shah', 'Alex Rivera']);
});

test('a visitor is asked to sign in to write a review', async ({ page }) => {
  await openAs(page, 'guest', '/plans/3/reviews');

  await expect(page.locator('[data-review-gate]')).toContainText('Only cooks who bought this plan can review it.');
  await page.getByRole('link', { name: 'Sign in to write a review' }).click();
  await expect(page).toHaveURL('/sign-in?next=%2Fplans%2F3%2Freviews');
});

for (const [account, says] of [
  ['sam', 'Only cooks who bought this plan can review it, so every review comes from someone who cooked it.'],
  ['alex', 'You have reviewed this plan. Thank you!'],
  ['kenji', 'This is your own plan. Creators cannot review their own.'],
  ['admin', 'Admin accounts do not write reviews.'],
] as const) {
  test(`${account} is told where they stand with reviewing`, async ({ page }) => {
    await openAs(page, account, '/plans/3/reviews');

    await expect(page.locator('[data-review-gate]')).toContainText(says);
  });
}

test('a plan nobody has reviewed says so, with nothing to sort', async ({ page }) => {
  await openAs(page, 'guest', '/plans/1/reviews');

  await expect(page.locator('[data-summary]')).toContainText('No reviews yet.');
  await expect(page.locator('[data-summary]')).toContainText('Cooks who buy this collection can review it here.');
  await expect(page.locator('[data-review-tools]')).toHaveCount(0);
});

test('the plan page leads to its reviews, and the reviews lead back', async ({ page }) => {
  await openAs(page, 'guest', '/plans/3');

  await page.getByRole('link', { name: /Read the reviews/ }).click();
  await expect(page).toHaveURL('/plans/3/reviews');

  await page.getByRole('link', { name: /Back to Three Weeknights in Japan/ }).click();
  await expect(page).toHaveURL('/plans/3');
});

test.describe('an address that names no plan', () => {
  // The API answers 404, and the browser logs that response.
  test.use({ expectedErrors: [/status of 404 \(Not Found\)/] });

  test('says there is no plan there', async ({ page }) => {
    await openAs(page, 'guest', '/plans/999/reviews');

    await expect(page.locator('main h1')).toHaveText('Plan not found');
  });
});
