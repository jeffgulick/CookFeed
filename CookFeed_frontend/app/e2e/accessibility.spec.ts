/* Accessibility, checked by axe in a real browser, where color contrast can be measured: no WCAG 2.1 A or AA
   violation on any page, on a wide screen or a phone, for a guest or a signed-in account, with a menu or a sheet
   open or closed. An automated check finds what a tool can find; the keyboard specs cover what it cannot. */
import { BUILT_PAGES, PHONE, PLACEHOLDER_PAGES, expect, openAs, test, violations } from './support';

for (const [screen, viewport] of [
  ['a wide screen', { width: 1280, height: 800 }],
  ['a phone', PHONE],
] as const) {
  test.describe(`on ${screen}`, () => {
    test.use({ viewport });

    for (const address of BUILT_PAGES) {
      for (const account of ['guest', 'alex', 'kenji', 'admin'] as const) {
        test(`${address} as ${account}`, async ({ page }) => {
          await openAs(page, account, address);

          expect(await violations(page)).toEqual([]);
        });
      }
    }

    test('a page that is not converted yet', async ({ page }) => {
      await openAs(page, 'alex', PLACEHOLDER_PAGES[0]);

      expect(await violations(page)).toEqual([]);
    });
  });
}

test('the account menu, open', async ({ page }) => {
  await openAs(page, 'alex', '/');

  await page.getByRole('button', { name: 'Alex Rivera' }).click();
  await expect(page.getByRole('menu')).toBeVisible();

  expect(await violations(page)).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('the More sheet, open', async ({ page }) => {
    await openAs(page, 'kenji', '/');

    await page.getByRole('button', { name: 'More' }).click();
    await expect(page.getByRole('dialog', { name: 'More' })).toBeVisible();

    expect(await violations(page)).toEqual([]);
  });
});
