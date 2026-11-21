/* Keyboard and screen-reader basics: the skip link, a focus ring that can be seen, where focus goes after moving to
   another page, and the account menu by keyboard. */
import { contrast, expect, openAs, test } from './support';

test('the first Tab reaches a visible skip link that moves focus to the content', async ({ page }) => {
  await openAs(page, 'alex', '/');

  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'Skip to content' });
  await expect(skip).toBeFocused();
  expect(await skip.evaluate((link) => link.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);

  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
  await expect(page).toHaveURL('/');
});

test('the focus ring is at least 3px and 3:1 against the page and a card', async ({ page }) => {
  await openAs(page, 'guest', '/');

  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const ring = await page.evaluate(() => {
    const focused = document.activeElement as HTMLElement;
    const style = getComputedStyle(focused);
    const card = document.querySelector('.card') as HTMLElement;
    return {
      width: parseFloat(style.outlineWidth),
      color: style.outlineColor,
      paper: getComputedStyle(document.documentElement).backgroundColor,
      card: getComputedStyle(card).backgroundColor,
    };
  });

  expect(ring.width).toBeGreaterThanOrEqual(3);
  expect(contrast(ring.color, ring.paper)).toBeGreaterThanOrEqual(3);
  expect(contrast(ring.color, ring.card)).toBeGreaterThanOrEqual(3);
});

test('after moving to another page, focus is on that page, not left in the navigation', async ({ page }) => {
  await openAs(page, 'alex', '/');

  await page.locator('nav[data-nav="top"]').getByRole('link', { name: 'Help' }).click();

  await expect(page).toHaveURL('/help');
  await expect(page.locator('#main')).toBeFocused();
});

test('the account menu opens with Enter, moves with the arrow keys, and Escape returns focus to it', async ({ page }) => {
  await openAs(page, 'alex', '/');
  const account = page.getByRole('button', { name: 'Alex Rivera' });

  await account.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Switch account' })).toBeFocused();

  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('menuitem', { name: 'Sign out' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(account).toBeFocused();
});
