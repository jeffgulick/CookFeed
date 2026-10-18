/* The Admin console (design section 3.8): what the admin can do, and what each action changes on the store
   for everyone else. Each change must also land in the audit log. */

const { test, expect, signInAs, textOf, GUEST, ALEX, ADMIN, SAM } = require("./support");

async function become(page, userId) {
  await page.evaluate((id) => localStorage.setItem("cookfeed.userId", String(id)), userId);
}

test("the console is only for the admin", async ({ page }) => {
  await signInAs(page, GUEST);
  await page.goto("admin.html");
  await expect(page.locator("#adminArea .sign-in-to")).toHaveCount(1);
  await signInAs(page, SAM);
  await page.goto("admin.html");
  await expect(page.locator("#adminArea")).toContainText("Only the admin account");
});

test("the console shows the whole store from the seed", async ({ page }) => {
  await signInAs(page, ADMIN);
  await page.goto("admin.html");
  await expect(page.locator("#statReviews")).toHaveText("3");
  await expect(page.locator("#statCreators")).toHaveText("3");
  await expect(page.locator("#statProducts")).toHaveText("4");
  await expect(page.locator("#statOrders")).toHaveText("5");
  await expect(page.locator("#statActions")).toHaveText("0");
  await expect(page.locator("#reviewRows tr")).toHaveCount(3);
  await expect(page.locator("#creatorRows tr")).toHaveCount(3);
  await expect(page.locator("#productRows tr")).toHaveCount(5);
  await expect(page.locator("#recipeRows tr")).toHaveCount(20);
  await expect(page.locator("#orderRows tr")).toHaveCount(6);
  await expect(page.locator("#userRows tr")).toHaveCount(10);
  await expect(page.locator("#logRows")).toContainText("Nothing yet");
  await page.fill("#orderSearch", "alex");
  await expect(page.locator("#orderRows tr")).toHaveCount(3);
  await expect(page.locator("#orderShowing")).toHaveText("Showing 3 of 6 orders");
});

test("hiding a review takes it off the store and out of the rating; the log records it", async ({ page }) => {
  await signInAs(page, ADMIN);
  await page.goto("admin.html");
  await page.locator("#reviewRows tr", { hasText: "Priya Shah" }).locator("button[data-action='review']").click();
  await page.click("#confirmOk");
  await expect(page.locator("#reviewRows tr", { hasText: "Priya Shah" })).toContainText("Hidden");
  await expect(page.locator("#statActions")).toHaveText("1");
  await expect(page.locator("#logRows")).toContainText("HideReview");
  await expect(page.locator("#logRows")).toContainText("review by Priya Shah on Three Weeknights in Japan");

  // The admin still sees it on the reviews page, marked; a guest does not, and the count drops to 2.
  await page.goto("reviews.html?product=3");
  await expect(page.locator(".review")).toHaveCount(3);
  await expect(page.locator(".review.hidden-review")).toHaveCount(1);
  await expect(page.locator("#reviewCount")).toHaveText("2");
  await become(page, "");
  await page.evaluate(() => localStorage.removeItem("cookfeed.userId"));
  await page.goto("reviews.html?product=3");
  await expect(page.locator(".review")).toHaveCount(2);
  await expect(page.locator("#reviewCount")).toHaveText("2");
  await page.goto("index.html");
  await expect(page.locator(".product-tile", { hasText: "Three Weeknights" })).toContainText("2 reviews");
});

test("suspending a creator takes their plans off the store; buyers keep them; restoring puts them back", async ({ page }) => {
  await signInAs(page, ADMIN);
  await page.goto("admin.html");
  await page.locator("#creatorRows tr", { hasText: "dan-meal-preps" }).locator("button[data-action='suspend']").click();
  await page.click("#confirmOk");
  await expect(page.locator("#creatorRows tr", { hasText: "dan-meal-preps" })).toContainText("Suspended");
  await expect(page.locator("#statProducts")).toHaveText("3");
  await expect(page.locator("#productRows tr", { hasText: "Family Week" })).toContainText("Creator suspended");

  await become(page, SAM);
  await page.goto("index.html");
  await expect(page.locator(".product-tile")).toHaveCount(3);
  await page.goto("product.html?id=4");
  await expect(page.locator("#buyArea")).toHaveText("No longer for sale");
  await page.goto("creator.html?handle=dan-meal-preps");
  await expect(page.locator("#suspendedNote")).toBeVisible();
  await expect(page.locator("#creatorProducts")).toContainText("Nothing for sale");

  await become(page, ALEX);
  await page.goto("product.html?id=4");
  await expect(page.locator("#buyArea")).toContainText("You own this plan");

  await become(page, ADMIN);
  await page.goto("admin.html");
  await page.locator("#creatorRows tr", { hasText: "dan-meal-preps" }).locator("button[data-action='suspend']").click();
  await page.click("#confirmOk");
  await expect(page.locator("#statProducts")).toHaveText("4");
  await expect(page.locator("#logRows tr")).toHaveCount(2);
});

test("a refund takes the plan back from the buyer", async ({ page }) => {
  await signInAs(page, ADMIN);
  await page.goto("admin.html");
  await page.locator("#orderRows tr", { hasText: "CF-00002" }).locator("button[data-action='order']").click();
  await page.click("#confirmOk");
  await expect(page.locator("#orderRows tr", { hasText: "CF-00002" })).toContainText("Refunded");
  await expect(page.locator("#orderRows tr", { hasText: "CF-00002" }).locator("button")).toHaveCount(0);
  await expect(page.locator("#statOrders")).toHaveText("4");
  await expect(page.locator("#logRows")).toContainText("RefundOrder");

  await become(page, ALEX);
  await page.goto("orders.html");
  await expect(page.locator(".order-card", { hasText: "CF-00002" })).toContainText("refunded, so nothing in it is yours");
  await page.goto("recipe.html?id=9");
  await expect(page.locator("main")).toContainText("only for cooks who bought the plan");
  await page.goto("product.html?id=4");
  await expect(page.locator("#buyArea .buy-button")).toHaveCount(1);
});

test("verifying a creator, retiring a plan and unpublishing a recipe show on the store", async ({ page }) => {
  await signInAs(page, ADMIN);
  await page.goto("admin.html");
  await page.locator("#creatorRows tr", { hasText: "dan-meal-preps" }).locator("button[data-action='verify']").click();
  await page.click("#confirmOk");
  await expect(page.locator("#creatorRows tr", { hasText: "dan-meal-preps" })).toContainText("Verified");
  await page.locator("#productRows tr", { hasText: "Roman Pasta" }).locator("button[data-action='product']").click();
  await page.click("#confirmOk");
  await expect(page.locator("#productRows tr", { hasText: "Roman Pasta" })).toContainText("Retired");
  await page.locator("#recipeRows tr", { hasText: "Tamagoyaki" }).locator("button[data-action='recipe']").click();
  await page.click("#confirmOk");
  await expect(page.locator("#recipeRows tr", { hasText: "Tamagoyaki" })).toContainText("Draft");
  await expect(page.locator("#statActions")).toHaveText("3");

  await become(page, SAM);
  await page.goto("creator.html?handle=dan-meal-preps");
  await expect(page.locator("#creatorName")).toContainText("Verified creator");
  await page.goto("index.html");
  await expect(page.locator(".product-tile")).toHaveCount(3);
  await expect(page.locator("#trendingRecipes .recipe-card")).toHaveCount(5);
  await page.goto("recipe.html?id=16");
  expect(await textOf(page, "main h1")).toBe("Recipe not found");
});
