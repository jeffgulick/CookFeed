/* Shared by the smoke specs: a test() that fails on any page or console error, signing in as a seeded account, and
   the small measurements several specs need. Every test gets a fresh browser context, so the signed-in account
   never carries over between tests. */
import { AxeBuilder } from '@axe-core/playwright';
import { Page, test as base, expect } from '@playwright/test';

export { expect };

/** The seeded accounts the specs sign in as (users.id in seed.sql). null browses as a guest. */
export const ACCOUNTS = { guest: null, alex: 1, priya: 2, kenji: 4, admin: 6, sam: 7 } as const;
export type AccountName = keyof typeof ACCOUNTS;

/** The pages converted from the prototype so far. Add each page here as it is built. */
export const BUILT_PAGES = ['/', '/sign-in'];

/** Addresses that still show the "being built" placeholder. Move each to BUILT_PAGES as it is converted. */
export const PLACEHOLDER_PAGES = ['/plans', '/recipes', '/kitchen', '/orders', '/cart', '/help', '/studio', '/admin'];

export const PHONE = { width: 375, height: 760 };

export const test = base.extend({
  page: async ({ page }, use) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') {
        errors.push(message.text());
      }
    });
    await use(page);
    expect(errors, 'errors raised while the test ran').toEqual([]);
  },
});

/** Opens an address signed in as the account (the same stored id the sign-in page sets), or as a guest. */
export async function openAs(page: Page, account: AccountName, address: string): Promise<void> {
  const id = ACCOUNTS[account];
  if (id !== null) {
    // Runs before the app on every load of this page, but signs in only on the first: a test that then signs out or
    // switches account keeps what it did across a reload. A guest needs nothing: a fresh context stores no account.
    await page.addInitScript((userId) => {
      if (sessionStorage.getItem('cookfeed.e2e.started') === null) {
        sessionStorage.setItem('cookfeed.e2e.started', 'yes');
        localStorage.setItem('cookfeed.userId', String(userId));
      }
    }, id);
  }
  await page.goto(address);
  await page.waitForLoadState('networkidle');
}

/** The src of every shown image that failed to load. */
export function brokenImages(page: Page): Promise<(string | null)[]> {
  return page.evaluate(() =>
    [...document.images]
      .filter((image) => image.offsetParent !== null && (!image.complete || image.naturalWidth === 0))
      .map((image) => image.getAttribute('src')),
  );
}

/** How wide the page's content is; wider than the screen means it scrolls sideways. */
export function contentWidth(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth);
}

/** The accessibility violations axe finds on the page as it is now (WCAG 2.1 A and AA, color contrast included). */
export async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  return results.violations.flatMap((violation) =>
    violation.nodes.map((node) => `${violation.id}: ${node.target.join(' ')}`),
  );
}

/** The WCAG contrast ratio of two computed colors, such as "rgb(194, 65, 12)". */
export function contrast(first: string, second: string): number {
  const luminance = (rgb: string) => {
    const [r, g, b] = (rgb.match(/\d+(\.\d+)?/g) ?? [])
      .slice(0, 3)
      .map(Number)
      .map((value) => value / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}
