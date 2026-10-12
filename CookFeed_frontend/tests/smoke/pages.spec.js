/* Every page address, as each kind of account: it loads without a page or console error (support.js),
   and every image it shows has loaded. */

const { test, expect, signInAs, brokenImages, PAGES, ACCOUNTS } = require("./support");

for (const [name, userId] of Object.entries(ACCOUNTS)) {
  test.describe(`as ${name}`, () => {
    for (const address of PAGES) {
      test(address, async ({ page }) => {
        await signInAs(page, userId);
        await page.goto(address);
        expect(await brokenImages(page)).toEqual([]);
      });
    }
  });
}

test("addresses that name nothing say so", async ({ page }) => {
  await signInAs(page, null);
  for (const [address, heading] of [["product.html?id=99", "Plan not found"],
    ["recipe.html?id=99", "Recipe not found"], ["recipe.html?id=13", "Recipe not found"],
    ["creator.html?handle=nobody", "Creator not found"], ["reviews.html?product=99", "Reviews not found"]]) {
    await page.goto(address);
    await expect(page.locator("main h1"), address).toHaveText(heading);
  }
});
