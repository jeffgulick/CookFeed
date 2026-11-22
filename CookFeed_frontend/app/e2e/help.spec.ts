/* The Help page, end to end: the questions a first-time visitor asks, answered on one page, with the way on to the
   pages the answers name. */
import { expect, openAs, test } from './support';

test('a visitor finds the common questions answered', async ({ page }) => {
  await openAs(page, 'guest', '/help');

  await expect(page.locator('main h1')).toHaveText('Questions and answers');
  await expect(page).toHaveTitle('Help | Cookfeed');

  const questions = page.locator('main h2');
  await expect(questions.first()).toHaveText('What is the difference between a meal plan and a collection?');
  await expect(questions.filter({ hasText: 'What do I get when I buy one?' })).toHaveCount(1);
  await expect(questions.filter({ hasText: 'Who can write a review?' })).toHaveCount(1);

  // Each question has an answer under it.
  const count = await questions.count();
  expect(count).toBeGreaterThanOrEqual(6);
  await expect(page.locator('main [data-answer]')).toHaveCount(count);
  await expect(page.locator('main')).toContainText('Family Week on a Budget has 5 recipes and 6 meals');
});

test('the answers lead on to the pages they name', async ({ page }) => {
  await openAs(page, 'guest', '/help');

  await page.locator('main').getByRole('link', { name: 'pick an account' }).click();
  await expect(page).toHaveURL('/sign-in');

  await page.goBack();
  await page.locator('main').getByRole('link', { name: 'Browse the plans' }).click();
  await expect(page).toHaveURL('/plans');
});
