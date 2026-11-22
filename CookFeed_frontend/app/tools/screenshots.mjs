// Takes the screenshots kept in docs/screenshots, on a laptop-sized and a phone-sized screen, and runs an
// accessibility check (axe, WCAG 2.1 A and AA, color contrast included) on each page it opens.
//
// Run it with the API and the app both running (npm start):   node tools/screenshots.mjs
// It prints any accessibility violation it finds and exits with an error if there is one.
import { AxeBuilder } from '@axe-core/playwright';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const base = process.env.COOKFEED_APP_URL ?? 'http://localhost:4200';
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'screenshots');

const SCREENS = {
  desktop: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
};

// Each shot: a file name, the page, who is signed in (an account id, or null for a guest), and anything to do first.
const SHOTS = [
  { name: 'discover-guest', path: '/', user: null },
  { name: 'discover-home-cook', path: '/', user: 1 },
  { name: 'sign-in', path: '/sign-in', user: null },
  { name: 'creator-guest', path: '/creators/kenji-kitchen', user: null },
  { name: 'plan-deciding', path: '/plans/3', user: null },
  { name: 'plan-buyer', path: '/plans/3', user: 1 },
  { name: 'plan-creator', path: '/plans/3', user: 4, only: 'desktop' },
  {
    name: 'plan-what-you-buy',
    path: '/plans/3',
    user: 1,
    only: 'phone',
    before: (page) => page.getByRole('heading', { name: "What you'll buy" }).scrollIntoViewIfNeeded(),
  },
  { name: 'creator-buyer', path: '/creators/maria-cooks', user: 1 },
  { name: 'creator-own-storefront', path: '/creators/kenji-kitchen', user: 4, only: 'desktop' },
  {
    name: 'creator-for-sale',
    path: '/creators/maria-cooks',
    user: 2,
    only: 'phone',
    before: (page) => page.getByRole('heading', { name: 'For sale' }).scrollIntoViewIfNeeded(),
  },
  { name: 'sign-in-creator', path: '/sign-in', user: 4 },
  {
    name: 'discover-plans',
    path: '/',
    user: 1,
    only: 'phone',
    before: (page) => page.getByRole('heading', { name: 'Meal plans and collections' }).scrollIntoViewIfNeeded(),
  },
  {
    name: 'discover-creators',
    path: '/',
    user: null,
    only: 'phone',
    before: (page) => page.getByRole('heading', { name: 'Creators' }).scrollIntoViewIfNeeded(),
  },
  {
    name: 'discover-trending',
    path: '/',
    user: 1,
    only: 'phone',
    before: (page) => page.getByRole('heading', { name: 'Trending recipes' }).scrollIntoViewIfNeeded(),
  },
  {
    name: 'more-sheet',
    path: '/',
    user: 4,
    only: 'phone',
    before: (page) => page.getByRole('button', { name: 'More' }).click(),
  },
  {
    name: 'account-menu',
    path: '/',
    user: 1,
    only: 'desktop',
    before: (page) => page.getByRole('button', { name: 'Alex Rivera' }).click(),
  },
];

await mkdir(out, { recursive: true });
const browser = await chromium.launch();
let violations = 0;

for (const [screen, options] of Object.entries(SCREENS)) {
  for (const shot of SHOTS.filter((s) => !s.only || s.only === screen)) {
    const context = await browser.newContext(options);
    if (shot.user !== null) {
      await context.addInitScript((id) => localStorage.setItem('cookfeed.userId', String(id)), shot.user);
    }
    const page = await context.newPage();
    await page.goto(base + shot.path, { waitUntil: 'networkidle' });
    await shot.before?.(page);
    await page.waitForTimeout(300);

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    for (const violation of results.violations) {
      violations += violation.nodes.length;
      console.log(`[${screen}] ${shot.name}: ${violation.id} (${violation.nodes.length}) ${violation.help}`);
      for (const node of violation.nodes.slice(0, 3)) {
        console.log(`    ${node.target.join(' ')}  ${node.failureSummary?.split('\n')[1]?.trim() ?? ''}`);
      }
    }

    const file = path.join(out, `${shot.name}-${screen}.png`);
    // A phone shot is one screenful, as the phone shows it, with the tabs at the bottom; a full-page shot would
    // paint the fixed tabs across the middle. A laptop shot is the whole page.
    await page.screenshot({ path: file, fullPage: screen === 'desktop' && !shot.before });
    console.log(`saved ${path.relative(process.cwd(), file)}`);
    await context.close();
  }
}

await browser.close();
console.log(violations === 0 ? 'No accessibility violations.' : `${violations} accessibility violation(s).`);
process.exit(violations === 0 ? 0 : 1);
