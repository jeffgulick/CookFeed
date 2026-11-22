/* Writing and deleting a review, end to end. Priya owns Family Week on a Budget and has not reviewed it; nobody
   has. A review changes the plan's rating, which the plan lists sort by, so this spec runs after all the others
   (playwright.config.ts), each test building on the one before, and the last one deletes the review again. */
import { PHONE, contentWidth, expect, openAs, test, violations } from './support';

test.describe.configure({ mode: 'serial' });

const WORDS = 'One shopping trip covered the whole week, and the kids ate all of it.';

test('a buyer who has not reviewed the plan is offered the form, under their own name', async ({ page }) => {
  await openAs(page, 'priya', '/plans/4/reviews');

  const form = page.locator('[data-review-form]');
  await expect(form).toContainText('Posting as Priya Shah');
  await expect(form).toContainText('Would you recommend this plan to another home cook?');
  await expect(form.getByRole('radio', { name: 'Yes' })).toBeChecked();
  await expect(page.locator('[data-summary]')).toContainText('No reviews yet.');
});

test('the form says what is missing, and posts nothing', async ({ page }) => {
  await openAs(page, 'priya', '/plans/4/reviews');

  await page.getByRole('button', { name: 'Post review' }).click();

  await expect(page.locator('[data-review-form]')).toContainText('Choose a rating.');
  await expect(page.locator('[data-review-form]')).toContainText('Write at least 15 characters.');
  await expect(page.locator('[data-review]')).toHaveCount(0);
  // The form with its messages showing has no accessibility violation, contrast included.
  expect(await violations(page)).toEqual([]);
});

test('the form fits a phone, with no accessibility violation', async ({ page }) => {
  await page.setViewportSize(PHONE);
  await openAs(page, 'priya', '/plans/4/reviews');

  await expect(page.locator('[data-review-form]')).toBeVisible();
  expect(await contentWidth(page)).toBeLessThanOrEqual(PHONE.width);
  expect(await violations(page)).toEqual([]);
});

test('a buyer posts a review, and it is on the page with the rating', async ({ page }) => {
  await openAs(page, 'priya', '/plans/4/reviews');

  await page.getByRole('radio', { name: '5 stars' }).check();
  await page.getByLabel('Your review').fill(WORDS);
  await page.getByRole('button', { name: 'Post review' }).click();

  const review = page.locator('[data-review]');
  await expect(review).toHaveCount(1);
  await expect(review.locator('[data-reviewer]')).toHaveText('Priya Shah');
  await expect(review).toContainText(WORDS);
  await expect(review.getByLabel('5 out of 5 stars')).toBeVisible();
  await expect(page.locator('[data-average]')).toHaveText('5.0');
  await expect(page.locator('[data-review-count]')).toHaveText('1 review');
  await expect(page.locator('[data-toast]')).toContainText('Thanks, Priya Shah. Your review is at the top of the list.');
  // The form gives way to the line that says she has reviewed it.
  await expect(page.locator('[data-review-form]')).toHaveCount(0);
  await expect(page.locator('[data-review-gate]')).toContainText('You have reviewed this plan. Thank you!');
});

test('everyone sees the review, and only its author can delete it', async ({ page }) => {
  await openAs(page, 'guest', '/plans/4/reviews');

  await expect(page.locator('[data-review] [data-reviewer]')).toHaveText(['Priya Shah']);
  await expect(page.getByRole('button', { name: 'Delete my review' })).toHaveCount(0);
});

test('the author deletes the review after confirming, and may write another', async ({ page }) => {
  await openAs(page, 'priya', '/plans/4/reviews');

  await page.getByRole('button', { name: 'Delete my review' }).click();
  await expect(page.getByRole('dialog')).toContainText('Delete your review of Family Week on a Budget?');
  await page.getByRole('dialog').getByRole('button', { name: 'Delete review' }).click();

  await expect(page.locator('[data-review]')).toHaveCount(0);
  await expect(page.locator('[data-summary]')).toContainText('No reviews yet.');
  await expect(page.locator('[data-toast]')).toContainText('Your review is deleted.');
  await expect(page.locator('[data-review-form]')).toBeVisible();
});
