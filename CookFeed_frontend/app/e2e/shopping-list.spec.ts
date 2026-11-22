/* The shopping list, end to end: a cook shops a recipe from its page, which makes their list; takes off what they
   already have; changes the people; starts shopping and ticks things off; and finishes, after which the list is
   kept under Past lists. Then the cook shops the finished list again, starts a second list beside it, and picks
   which list a recipe goes on. Signed in as Noor, whose lists no other spec reads; the tests run in order, each building
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

  // The link leads to the list the recipe went on.
  await page.locator('main').getByRole('link', { name: 'Open your shopping list' }).click();
  await expect(page).toHaveURL(/\/list\/\d+$/);
  await expect(page.locator('main h1')).toContainText('Shopping list, ');
  await expect(page.locator('[data-status]')).toHaveText('Building');
  await expect(page.locator('[data-list-recipe]')).toHaveCount(1);
  await expect(page.locator('[data-list-recipe]')).toContainText('Sheet-Pan Chicken and Vegetables');
  // What to buy, under the aisle each thing is found in.
  expect(await page.locator('[data-line]').count()).toBeGreaterThan(3);
  await expect(page.locator('[data-to-buy] h3').first()).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
});

test('with a list in use, Shop this recipe asks which list; Cancel adds nothing', async ({ page }) => {
  await openAs(page, 'noor', '/recipes/18');

  await page.getByRole('button', { name: 'Shop this recipe' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add to which shopping list?' });

  await expect(dialog).toBeVisible();
  // The list in use, picked to begin with, and the way to start another.
  await expect(dialog.getByRole('radio')).toHaveCount(2);
  await expect(dialog.getByRole('radio').first()).toBeChecked();
  await expect(dialog.getByRole('radio').first()).toHaveAccessibleName(/^Shopping list, .* 1 recipe · Building$/);
  await expect(dialog.getByRole('radio').last()).toHaveAccessibleName(/^A new list/);
  expect(await violations(page)).toEqual([]);

  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator('[data-toast] p')).toHaveCount(0);
});

test('shopping the same recipe onto the same list does not put it on twice', async ({ page }) => {
  await openAs(page, 'noor', '/recipes/18');

  await page.getByRole('button', { name: 'Shop this recipe' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Add to list' }).click();

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
  await expect(page).toHaveURL(/\/list\/\d+$/);
  await expect(page.locator('[data-status]')).toHaveText('Shopping');
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

test('Shop again makes a new list from a finished one, which stays in Past lists', async ({ page }) => {
  await openAs(page, 'noor', '/kitchen');

  await page.locator('[data-past-lists] tbody tr').getByRole('button', { name: /^Shop again/ }).click();

  await expect(page).toHaveURL(/\/list\/\d+$/);
  await expect(page.locator('[data-toast]')).toContainText('1 recipe is on a new list.');
  await expect(page.locator('[data-status]')).toHaveText('Building');
  // The same recipe for the same people as the finished list (12, set in an earlier test).
  await expect(page.locator('[data-list-recipe]')).toHaveCount(1);
  await expect(page.getByLabel('People for Sheet-Pan Chicken and Vegetables')).toHaveValue('12');

  await openAs(page, 'noor', '/kitchen');
  await expect(page.locator('[data-your-list] [data-open-list]')).toHaveCount(1);
  await expect(page.locator('[data-past-lists] tbody tr')).toHaveCount(1);
});

test('a finished list offers Shop again on its own page too', async ({ page }) => {
  await openAs(page, 'noor', '/kitchen');
  await page.locator('[data-past-lists] tbody tr').getByRole('link').click();

  await expect(page.locator('[data-status]')).toContainText('Done');
  await expect(page.locator('[data-hint]')).toHaveText('This list is done and kept as a record. Shop again makes a new list from it.');
  await expect(page.locator('main').getByRole('button', { name: 'Shop again' })).toBeVisible();
});

test('a cook starts a second list beside the first, and the kitchen shows both, each leading to its own', async ({ page }) => {
  await openAs(page, 'noor', '/recipes/15');

  await page.getByRole('button', { name: 'Shop this recipe' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add to which shopping list?' });
  await dialog.getByRole('radio', { name: /^A new list/ }).check();
  await dialog.getByRole('button', { name: 'Add to list' }).click();
  await expect(page.locator('[data-toast]')).toContainText('Caprese Salad is on your shopping list.');

  await openAs(page, 'noor', '/kitchen');
  await expect(page.locator('[data-your-list] h2')).toHaveText('Your shopping lists');
  const lists = page.locator('[data-your-list] [data-open-list]');
  await expect(lists).toHaveCount(2);
  // Newest first; a second list made the same day is numbered.
  await expect(lists.first()).toContainText('(2)');
  await expect(lists.first()).toContainText('1 recipe · Building');
  expect(await violations(page)).toEqual([]);

  await lists.first().getByRole('link', { name: 'Open list' }).click();
  await expect(page.locator('main h1')).toContainText('(2)');
  await expect(page.locator('[data-list-recipe]')).toHaveText(/Caprese Salad/);
  await expect(page.locator('[data-list-recipe]')).toHaveCount(1);

  await openAs(page, 'noor', '/kitchen');
  await lists.last().getByRole('link', { name: 'Open list' }).click();
  await expect(page.locator('[data-list-recipe]')).toHaveText(/Sheet-Pan Chicken and Vegetables/);
});

test('a recipe goes on the list the cook picks, not the newest', async ({ page }) => {
  await openAs(page, 'noor', '/recipes/16');

  await page.getByRole('button', { name: 'Shop this recipe' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add to which shopping list?' });
  // Two lists in use, newest first, and A new list.
  await expect(dialog.getByRole('radio')).toHaveCount(3);
  await dialog.getByRole('radio').nth(1).check();
  await dialog.getByRole('button', { name: 'Add to list' }).click();
  await expect(page.locator('[data-toast]')).toContainText('Tamagoyaki is on your shopping list.');

  await page.locator('main').getByRole('link', { name: 'Open your shopping list' }).click();
  await expect(page.locator('main h1')).not.toContainText('(2)');
  await expect(page.locator('[data-list-recipe]')).toHaveCount(2);
  await expect(page.locator('[data-list-recipe]').last()).toContainText('Tamagoyaki');
});

test('a visitor is asked to sign in, and the admin is told admins do not shop', async ({ page }) => {
  await openAs(page, 'guest', '/list');
  await expect(page.locator('main').getByRole('link', { name: 'Sign in to see your shopping list' })).toHaveAttribute(
    'href',
    '/sign-in?next=%2Flist',
  );
});
