/* My studio, for creators: what they publish, what they sell, and what it has earned, read from the seed. Kenji has
   five published recipes (three premium, in his one plan), a draft with no ingredients, and three sales. Dan has a
   retired plan with no recipes. The tests that publish and retire are in studio-write.spec.ts. */
import { Page } from '@playwright/test';
import { PHONE, contentWidth, expect, openAs, test, violations } from './support';

/** Dan (users.id 5), a creator no other spec signs in as. */
async function openAsDan(page: Page, address: string): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('cookfeed.userId', '5'));
  await page.goto(address);
  await page.waitForLoadState('networkidle');
}

const recipeRow = (page: Page, title: string) => page.locator('[data-recipes] tbody tr').filter({ hasText: title });

test('a creator sees what they publish, what they sell and what it has earned', async ({ page }) => {
  await openAs(page, 'kenji', '/studio');

  await expect(page).toHaveTitle('My studio | Cookfeed');
  await expect(page.locator('main h1')).toHaveText('Your recipes and plans');
  await expect(page.locator('[data-lede]')).toContainText('What you publish, what you sell, and what it has earned.');
  await expect(page.locator('main').getByRole('link', { name: 'See your storefront' })).toHaveAttribute(
    'href',
    '/creators/kenji-kitchen',
  );
  await expect(page.locator('[data-stat]')).toHaveText([
    '5 published recipes, free and premium, plus 1 draft',
    '1 plan for sale',
    '3 sales',
    '$38.97 earned',
    '11 saves of your recipes',
  ]);
  await expect(page.locator('main h2')).toHaveText(['My recipes', 'My plans and collections', 'Sales', 'Reviews of my plans']);
  await expect(page.locator('[data-suspended]')).toHaveCount(0);
});

test('each recipe shows its status, who may open it, and why a button is off', async ({ page }) => {
  await openAs(page, 'kenji', '/studio');

  await expect(page.locator('[data-recipes] thead th')).toHaveText(['Recipe', 'Status', 'Access', 'Saved by', 'In plans', 'Actions']);
  await expect(page.locator('[data-recipes] tbody tr')).toHaveCount(6);

  // A free, published recipe in no plan: it can be unpublished.
  const free = recipeRow(page, 'Tamagoyaki');
  await expect(free.locator('td')).toContainText(['Tamagoyaki', 'Published', 'Free', '4 cooks', 'none']);
  await expect(free).toContainText('Serves 2');
  await expect(free.getByRole('link', { name: 'Tamagoyaki' })).toHaveAttribute('href', '/recipes/16');
  await expect(free.getByRole('button', { name: 'Unpublish: Tamagoyaki' })).toBeEnabled();

  // A premium recipe in a plan stays published while the plan holds it; the reason is text, not a tooltip.
  const premium = recipeRow(page, 'Chicken Teriyaki, the Real Way');
  await expect(premium.locator('td')).toContainText(['Published', 'Premium', '3 cooks', 'Three Weeknights in Japan']);
  await expect(premium.getByRole('button', { name: /^Unpublish/ })).toBeDisabled();
  await expect(premium.locator('[data-why-not]')).toHaveText(
    '"Chicken Teriyaki, the Real Way" is in Three Weeknights in Japan. Take it out of the plan first.',
  );

  // A draft with no ingredients cannot be published yet.
  const draft = recipeRow(page, 'Miso Soup (draft)');
  await expect(draft.locator('td')).toContainText(['Draft', 'Free', '0 cooks', 'none']);
  await expect(draft.getByRole('button', { name: /^Publish/ })).toBeDisabled();
  await expect(draft.locator('[data-why-not]')).toHaveText('Add at least one ingredient first.');
});

test('each plan shows its price, what is in it, whether it is for sale and how many sold', async ({ page }) => {
  await openAs(page, 'kenji', '/studio');

  await expect(page.locator('[data-products] thead th')).toHaveText(['Plan', 'Type', 'Price', 'Contents', 'Status', 'Sold', 'Actions']);
  const row = page.locator('[data-products] tbody tr');
  await expect(row).toHaveCount(1);
  await expect(row.locator('td')).toContainText(['Three Weeknights in Japan', 'Meal plan', '$12.99', '3 recipes', 'For sale', '3']);
  await expect(row.getByRole('link', { name: 'Three Weeknights in Japan', exact: true })).toHaveAttribute('href', '/plans/3');
  await expect(row.getByRole('button', { name: 'Retire: Three Weeknights in Japan' })).toBeEnabled();
  await expect(row.getByRole('link', { name: /^Reviews/ })).toHaveAttribute('href', '/plans/3/reviews');
});

test('the sales are listed newest first at the price of the time, and the reviews under them', async ({ page }) => {
  await openAs(page, 'kenji', '/studio');

  await expect(page.locator('[data-sales-summary]')).toHaveText(
    '3 sales, $38.97 earned. Each line is the price at the time of purchase.',
  );
  await expect(page.locator('[data-sales] thead th')).toHaveText(['Date', 'Buyer', 'Plan', 'Paid', 'Status']);
  const sales = page.locator('[data-sales] tbody tr');
  await expect(sales).toHaveCount(3);
  await expect(sales.first().locator('td')).toHaveText(['August 11, 2026', 'Alex Rivera', 'Three Weeknights in Japan', '$12.99', 'Paid']);

  const reviews = page.locator('[data-studio-reviews] [data-review]');
  await expect(reviews).toHaveCount(3);
  await expect(reviews.first()).toContainText('on Three Weeknights in Japan');
  await expect(reviews.first().getByRole('img')).toHaveAccessibleName(/^[1-5] out of 5 stars$/);
});

test('a retired plan says so, and says why it cannot go back on sale', async ({ page }) => {
  await openAsDan(page, '/studio');

  const retired = page.locator('[data-products] tbody tr').filter({ hasText: 'Summer Grilling (retired)' });
  await expect(retired.locator('td')).toContainText(['Retired']);
  await expect(retired.getByRole('button', { name: /^Restore/ })).toBeDisabled();
  await expect(retired.locator('[data-why-not]')).toHaveText('"Summer Grilling (retired)" has no recipes. Add at least one first.');
  await expect(page.locator('[data-stat]').nth(1)).toHaveText('1 plan for sale');
});

test('a visitor is asked to sign in, and an account that is not a creator is told who has a studio', async ({ page }) => {
  await openAs(page, 'guest', '/studio');
  await expect(page.locator('main h1')).toHaveText('Your recipes and plans');
  await expect(page.locator('main').getByRole('link', { name: 'Sign in to open your studio' })).toHaveAttribute(
    'href',
    '/sign-in?next=%2Fstudio',
  );
  await expect(page.locator('[data-no-studio]')).toContainText('The studio is where creators publish recipes and sell plans.');

  await page.evaluate(() => localStorage.setItem('cookfeed.userId', '1'));
  await page.reload();
  await expect(page.locator('[data-no-studio]')).toHaveText('Only creators have a studio. Sign in as Maria, Kenji or Dan to see one.');
  await expect(page.locator('[data-recipes]')).toHaveCount(0);
});

test('the studio has no accessibility violation', async ({ page }) => {
  await openAs(page, 'kenji', '/studio');
  await expect(page.locator('[data-recipes] tbody tr')).toHaveCount(6);

  expect(await violations(page)).toEqual([]);
});

test.describe('on a phone', () => {
  test.use({ viewport: PHONE });

  test('the tables scroll inside their own boxes, so the page is no wider than the screen', async ({ page }) => {
    await openAs(page, 'kenji', '/studio');
    await expect(page.locator('[data-recipes] tbody tr')).toHaveCount(6);

    expect(await contentWidth(page)).toBeLessThanOrEqual(PHONE.width);
    expect(await violations(page)).toEqual([]);
  });
});
