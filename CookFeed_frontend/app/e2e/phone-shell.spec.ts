/* The phone layout's fixed parts, in a browser that behaves as a phone's does (touch, a phone's viewport rules):
   the top bar and the tabs stay on the screen while the page scrolls, and a page inside another has a Back button,
   because an app opened from the home screen has no browser Back to press. */
import { Page } from '@playwright/test';
import { PHONE, expect, openAs, test } from './support';

/** How far the top bar and the tabs sit from the top and bottom edges of what the phone is showing; 0 is in place. */
function menuGaps(page: Page): Promise<{ top: number; bottom: number; side: number }> {
  return page.evaluate(() => {
    const seen = window.visualViewport!;
    const header = document.querySelector('header')!.getBoundingClientRect();
    const tabs = document.querySelector('nav[data-nav="tabs"]')!.getBoundingClientRect();
    return {
      top: Math.round(header.top - seen.offsetTop),
      bottom: Math.round(seen.offsetTop + seen.height - tabs.bottom),
      side: Math.round(tabs.width - seen.width),
    };
  });
}

test.describe('on a touch phone', () => {
  test.use({ viewport: { width: 412, height: 839 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

  test('the top bar and the tabs stay in place while the page scrolls', async ({ page }) => {
    await openAs(page, 'kenji', '/');

    await page.mouse.wheel(0, 700);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);

    expect(await menuGaps(page)).toEqual({ top: 0, bottom: 0, side: 0 });
  });

  test('something a few pixels wider than the screen does not push the top bar and the tabs off it', async ({ page }) => {
    await openAs(page, 'kenji', '/plans/1');
    // A phone browser widens its whole layout to fit the widest thing on the page, unless the page says not to;
    // fixed bars are then laid out in that wider, taller layout, part of which is off the screen.
    await page.evaluate(() => {
      const wide = document.createElement('div');
      wide.style.cssText = 'position:absolute;top:300px;left:0;width:419px;height:10px';
      document.body.append(wide);
    });

    await page.mouse.wheel(0, 700);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(300);

    expect(await menuGaps(page)).toEqual({ top: 0, bottom: 0, side: 0 });
  });
});

test.describe('Back, on a phone', () => {
  test.use({ viewport: PHONE });
  const back = (page: Page) => page.locator('header').getByRole('button', { name: 'Back' });

  test('the pages in the tabs have no Back button; a page opened from one has, and it returns there', async ({ page }) => {
    await openAs(page, 'guest', '/plans');
    await expect(back(page)).toHaveCount(0);

    await page.locator('[data-product-id="3"] a').first().click();
    await expect(page).toHaveURL('/plans/3');
    await expect(back(page)).toBeVisible();
    const box = (await back(page).boundingBox())!;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);

    await back(page).click();
    await expect(page).toHaveURL('/plans');
    await expect(back(page)).toHaveCount(0);
  });

  test('Back returns to where the cook came from, which need not be the level above', async ({ page }) => {
    await openAs(page, 'guest', '/');

    await page.locator('[data-product-id="3"] a').first().click();
    await expect(page).toHaveURL('/plans/3');
    await back(page).click();

    await expect(page).toHaveURL('/');
  });

  test('on a page opened by its address, Back goes up a level at a time', async ({ page }) => {
    await openAs(page, 'guest', '/plans/3/reviews');

    await back(page).click();
    await expect(page).toHaveURL('/plans/3');

    await back(page).click();
    await expect(page).toHaveURL('/plans');
  });

  test('a recipe opened from a plan goes back to the plan', async ({ page }) => {
    await openAs(page, 'alex', '/recipes/5?product=3');

    await back(page).click();
    await expect(page).toHaveURL('/plans/3');
  });

  test('the cart and a shopping list have Back too', async ({ page }) => {
    await openAs(page, 'alex', '/cart');
    await expect(back(page)).toBeVisible();

    await openAs(page, 'alex', '/list');
    await back(page).click();
    await expect(page).toHaveURL('/kitchen');
  });
});

test('a wide screen has no Back button: the browser has its own', async ({ page }) => {
  await openAs(page, 'guest', '/plans/3');

  await expect(page.locator('header [data-back]')).toBeHidden();
});
