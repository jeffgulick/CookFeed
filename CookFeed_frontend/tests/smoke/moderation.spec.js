/* Access and moderation (design sections 3.3, 3.5 and 3.8): buyers keep what they paid for, the creator
   cannot undo the admin, nothing goes on sale that a buyer could not open, and the rating counts only
   reviews by cooks who still own the plan. */

const { test, expect, signInAs, ALEX, KENJI, ADMIN } = require("./support");
const DAN = 5;

const as = (page, id) => page.evaluate((userId) => localStorage.setItem("cookfeed.userId", String(userId)), id);

test("a recipe in a plan, or one cooks bought, stays published: the studio says why instead of a tooltip", async ({ page }) => {
  await signInAs(page, KENJI);
  await page.goto("studio.html");
  const teriyaki = page.locator("#recipeRows tr", { hasText: "Chicken Teriyaki" });
  await expect(teriyaki.locator("button[data-action='publish']")).toBeDisabled();
  await expect(teriyaki.locator(".action-note")).toContainText("Three Weeknights in Japan");
});

test("the admin takes a recipe down for everyone; its plan stops selling and the creator cannot put it back", async ({ page }) => {
  await signInAs(page, ADMIN);
  await page.goto("admin.html");
  const row = page.locator("#recipeRows tr", { hasText: "Chicken Teriyaki" });
  await row.locator("[data-action='recipe']").click();
  await expect(page.locator("#confirmMessage")).toContainText("bought it lose");
  await page.click("#confirmOk");
  await expect(row.locator("[data-action='recipe']")).toHaveText("Put back");
  await expect(page.locator("#productRows tr", { hasText: "Three Weeknights" })).toContainText("Not for sale");
  await expect(page.locator(".toast")).toContainText("taken down");

  await as(page, KENJI);
  await page.goto("studio.html");
  await expect(page.locator("#recipeRows tr", { hasText: "Chicken Teriyaki" }).locator(".action-note")).toContainText("Cookfeed took");

  await as(page, ADMIN);
  await page.goto("admin.html");
  await page.locator("#recipeRows tr", { hasText: "Chicken Teriyaki" }).locator("[data-action='recipe']").click();
  await page.click("#confirmOk");
  await expect(page.locator("#productRows tr", { hasText: "Three Weeknights" })).toContainText("For sale");
});

test("the admin never publishes a creator's draft, and a plan with no recipes cannot go back on sale", async ({ page }) => {
  await signInAs(page, ADMIN);
  await page.goto("admin.html");
  await expect(page.locator("#recipeRows tr", { hasText: "Miso Soup" })).toContainText("Creator's draft");
  await expect(page.locator("#recipeRows tr", { hasText: "Miso Soup" }).locator("button")).toHaveCount(0);
  await page.locator("#productRows tr", { hasText: "Summer Grilling" }).locator("[data-action='product']").click();
  await page.click("#confirmOk");
  await expect(page.locator(".toast")).toContainText("has no recipes");
  await expect(page.locator("#productRows tr", { hasText: "Summer Grilling" })).toContainText("Retired");
});

test("a plan the admin retired cannot be restored from the studio", async ({ page }) => {
  await signInAs(page, ADMIN);
  await page.goto("admin.html");
  await page.locator("#productRows tr", { hasText: "Three Weeknights" }).locator("[data-action='product']").click();
  await page.click("#confirmOk");
  await expect(page.locator(".toast")).toContainText("retired");
  await as(page, KENJI);
  await page.goto("studio.html");
  await page.locator("#productRows tr", { hasText: "Three Weeknights" }).locator("[data-action='active']").click();
  await page.click("#confirmOk");
  await expect(page.locator(".toast")).toContainText("Cookfeed retired");
  await expect(page.locator("#productRows tr", { hasText: "Three Weeknights" })).toContainText("Retired");
});

test("a refunded buyer's review stops counting; the author still sees it and can remove it", async ({ page }) => {
  await signInAs(page, ADMIN);
  await page.goto("reviews.html?product=3");
  const before = await page.locator("#reviewList .review").count();
  await page.goto("admin.html");
  await page.locator("#orderRows tr", { hasText: "CF-00001" }).locator("[data-action='order']").click();
  await page.click("#confirmOk");
  await expect(page.locator(".toast")).toContainText("refunded");
  await as(page, KENJI);                                                   // anyone: the public view
  await page.goto("reviews.html?product=3");
  await expect(page.locator("#reviewList .review")).toHaveCount(before - 1);
  await as(page, ALEX);
  await page.goto("reviews.html?product=3");
  await expect(page.locator("#reviewList")).toContainText("Not counted: order refunded");
  await expect(page.locator(".remove-review")).toHaveCount(1);
});

test("the author of a hidden review sees it, marked, and can remove it and write a new one", async ({ page }) => {
  await signInAs(page, ADMIN);
  await page.goto("admin.html");
  await page.locator("#reviewRows tr", { hasText: "Dan" }).filter({ hasText: "Three Weeknights" }).locator("[data-action='review']").click();
  await page.click("#confirmOk");
  await expect(page.locator(".toast")).toContainText("hidden");
  await as(page, DAN);
  await page.goto("reviews.html?product=3");
  await expect(page.locator("#reviewList")).toContainText("Hidden by Cookfeed");
  await page.click(".remove-review");
  await page.click("#confirmOk");
  await expect(page.locator("#reviewList")).not.toContainText("Hidden by Cookfeed");
});

test("making a saved recipe premium asks first and says who loses it", async ({ page }) => {
  await signInAs(page, KENJI);
  await page.goto("studio.html");
  await page.locator("#recipeRows tr", { hasText: "Tamagoyaki" }).locator("button[data-action='visibility']").click();
  await expect(page.locator("#confirmMessage")).toContainText("who saved it lose it");
  await page.click("#confirmCancel");
  await expect(page.locator("#recipeRows tr", { hasText: "Tamagoyaki" })).toContainText("Free");
});
