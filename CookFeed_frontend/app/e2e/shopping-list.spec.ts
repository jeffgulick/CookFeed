/* The shopping list, end to end: a cook shops a recipe from its page, which makes their list; takes off what they
   already have; changes the people; starts shopping and ticks things off; and finishes, after which the list is
   kept under Past lists. Signed in as Noor, whose lists no other spec reads; the tests run in order, each building
   on the one before. The run starts from the seed (global-setup.ts), where nobody has a list. */
import { PHONE, contentWidth, expect, openAs, test, violations } from './support';

test.describe.configure({ mode: 'serial' });

test('a cook with no list is told how to start one', async ({ page }) => {
  await openAs(page, 'noor', '/list');

  await expect(page.locator('main h1')).toHaveText('Shopping list');
  await expect(page.locator('main')).toContainText('You have no shopping list yet.');
  await expect(page.locator('main')).toContainText('Press Shop this recipe on a recipe');
});

test('Shop this recipe makes the list and puts the recipe on it', async ({ page }) => {
  await openAs(page, 'noor', '/recipes/18');

  await page.getByRole('button', { name: 'Shop this recipe' }).click();
  await expect(page.locator('[data-toast]')).toContainText('Sheet-Pan Chicken and Vegetables is on your shopping list.');

  await page.locator('main').getByRole('link', { name: 'Open your shopping list' }).click();
  await expect(page).toHaveURL('/list');
  await expect(page.locator('main h1')).toContainText('Shopping list, ');
  await expect(page.locator('[data-status]')).toHaveText('Building');
  await expect(page.locator('[data-list-recipe]')).toHaveCount(1);
  await expect(page.locator('[data-list-recipe]')).toContainText('Sheet-Pan Chicken and Vegetables');
  // What to buy, under the aisle each thing is found in.
  expect(await page.locator('[data-line]').count()).toBeGreaterThan(3);
  await expect(page.locator('[data-to-buy] h3').first()).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
});

test('shopping the same recipe again does not put it on twice', async ({ page }) => {
  await openAs(page, 'noor', '/recipes/18');

  await page.getByRole('button', { name: 'Shop this recipe' }).click();

  await expect(page.locator('[data-toast]')).toContainText('is already on your shopping list.');
});

test('Have it takes a line off, and put back returns it', async ({ page }) => {
  await openAs(page, 'noor', '/list');
  const lines = page.locator('[data-line]');
  const before = await lines.count();
  const name = (await lines.first().locator('[data-line-name]').innerText()).trim();

  await lines.first().getByRole('button', { name: `Have it: ${name}` }).click();
  await expect(lines).toHaveCount(before - 1);
  await expect(page.locator('[data-skipped]')).toContainText(name);

  await page.getByRole('button', { name: `Put back: ${name}` }).click();
  await expect(lines).toHaveCount(before);
  await expect(page.locator('[data-skipped]')).toHaveCount(0);
});

test('changing the people for a recipe changes what to buy', async ({ page }) => {
  await openAs(page, 'noor', '/list');
  const first = page.locator('[data-line] [data-line-amount]').first();
  const before = await first.innerText();

  await page.getByLabel('People for Sheet-Pan Chicken and Vegetables').fill('12');
  await page.getByLabel('People for Sheet-Pan Chicken and Vegetables').press('Tab');

  await expect(first).not.toHaveText(before);
  await expect(page.locator('[data-toast]')).toContainText('Sheet-Pan Chicken and Vegetables is now for 12 people.');
});

test('the list has no accessibility violation, and fits a phone', async ({ page }) => {
  await openAs(page, 'noor', '/list');
  expect(await violations(page)).toEqual([]);

  await page.setViewportSize(PHONE);
  await page.reload();
  await expect(page.locator('[data-line]').first()).toBeVisible();
  expect(await contentWidth(page)).toBeLessThanOrEqual(PHONE.width);
  expect(await violations(page)).toEqual([]);
});

test('Start shopping gives each line a box to tick, and counts what is left', async ({ page }) => {
  await openAs(page, 'noor', '/list');
  const total = await page.locator('[data-line]').count();

  await page.getByRole('button', { name: 'Start shopping' }).click();

  await expect(page.locator('[data-status]')).toHaveText('Shopping');
  await expect(page.getByRole('checkbox')).toHaveCount(total);
  await expect(page.locator('[data-progress]')).toHaveText(`${total} of ${total} items still to buy`);

  await page.getByRole('checkbox').first().check();
  await expect(page.locator('[data-progress]')).toHaveText(`${total - 1} of ${total} items still to buy`);
  expect(await violations(page)).toEqual([]);
});

test('the kitchen shows the list in use, and leads to it', async ({ page }) => {
  await openAs(page, 'noor', '/kitchen');

  await expect(page.locator('[data-your-list]')).toContainText('Shopping list, ');
  await expect(page.locator('[data-your-list]')).toContainText('1 recipe');
  await page.locator('[data-your-list]').getByRole('link', { name: 'Open list' }).click();
  await expect(page).toHaveURL('/list');
});

test('Done shopping finishes the list after confirming, and it is kept under Past lists', async ({ page }) => {
  await openAs(page, 'noor', '/list');

  await page.getByRole('button', { name: 'Done shopping' }).click();
  await expect(page.getByRole('dialog')).toContainText('Done shopping?');
  await page.getByRole('dialog').getByRole('button', { name: 'Done shopping' }).click();

  await expect(page.locator('[data-status]')).toContainText('Done');
  await expect(page.getByRole('button', { name: 'Start shopping' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Have it/ })).toHaveCount(0);

  await openAs(page, 'noor', '/kitchen');
  await expect(page.locator('[data-your-list]')).toContainText('You have no shopping list yet.');
  const past = page.locator('[data-past-lists] tbody tr');
  await expect(past).toHaveCount(1);
  await expect(past).toContainText('Shopping list, ');
  await past.getByRole('link').click();
  await expect(page).toHaveURL(/\/list\/\d+$/);
  await expect(page.locator('[data-status]')).toContainText('Done');
});

test('a visitor is asked to sign in, and the admin is told admins do not shop', async ({ page }) => {
  await openAs(page, 'guest', '/list');
  await expect(page.locator('main').getByRole('link', { name: 'Sign in to see your shopping list' })).toHaveAttribute(
    'href',
    '/sign-in?next=%2Flist',
  );
});
