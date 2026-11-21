/* Discover, end to end: a first-time visitor is told what Cookfeed is before anything else, and the trending
   recipes come from the database, most saved first. */
import { PHONE, expect, openAs, test } from './support';

test('a first-time visitor is told what Cookfeed is, how it works, and where to go next', async ({ page }) => {
  await openAs(page, 'guest', '/');

  await expect(page.locator('main h1')).toHaveText('Cook the week, shop once');
  await expect(page.locator('[data-how-it-works] h3')).toHaveText(['Watch', 'Plan', 'Shop once']);

  await page.locator('[data-hero]').getByRole('link', { name: 'Browse meal plans' }).click();
  await expect(page).toHaveURL('/plans');
});

test('the trending recipes are the six free recipes saved most, most saved first', async ({ page }) => {
  await openAs(page, 'guest', '/');
  const cards = page.locator('[data-trending] [data-recipe-id]');

  await expect(cards).toHaveCount(6);
  const saves = (await cards.allInnerTexts()).map((text) => Number(/saved by (\d+) cooks?/.exec(text)![1]));
  expect(saves).toEqual([...saves].sort((a, b) => b - a));

  // The seed's most-saved free recipe, with what its card says about it.
  await expect(cards.first()).toContainText('Sheet-Pan Chicken and Vegetables');
  await expect(cards.first()).toContainText('by dan-meal-preps');
  await expect(cards.first()).toContainText('saved by 7 cooks');
});

test('a card leads to its recipe wherever it is clicked', async ({ page }) => {
  await openAs(page, 'guest', '/');
  const first = page.locator('[data-trending] [data-recipe-id]').first();
  const id = await first.getAttribute('data-recipe-id');

  // The link is stretched over the whole card, so a click on the picture lands on it, as a person's would.
  await first.scrollIntoViewIfNeeded();
  const picture = (await first.locator('img').boundingBox())!;
  await page.mouse.click(picture.x + picture.width / 2, picture.y + picture.height / 2);

  await expect(page).toHaveURL(`/recipes/${id}`);
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('the recipes are two across, and the main buttons span the screen', async ({ page }) => {
    await openAs(page, 'guest', '/');
    const cards = page.locator('[data-trending] [data-recipe-id]');

    const [first, second, third] = await Promise.all([0, 1, 2].map((i) => cards.nth(i).boundingBox()));
    expect(first!.y).toBeCloseTo(second!.y, 0);
    expect(third!.y).toBeGreaterThan(first!.y);

    const button = (await page.locator('[data-hero] a').first().boundingBox())!;
    expect(button.width).toBeGreaterThan(PHONE.width * 0.7);
    expect(button.height).toBeGreaterThanOrEqual(44);
  });
});
