/* The browse pages: Plans (every plan and collection for sale) and Recipes (the free recipes only,
   never a plan's), with their filters, sort and search, and what an owner sees on them. */

const { test, expect, signInAs, GUEST, ALEX, SAM } = require("./support");

test.describe("Plans", () => {
  test("lists the four for sale, filters by type, and sorts by price", async ({ page }) => {
    await signInAs(page, GUEST);
    await page.goto("plans.html");
    await expect(page.locator("#allPlans .product-tile")).toHaveCount(4);
    await expect(page.locator("#planShowing")).toHaveText("Showing all 4 plans");
    await page.click("[data-type='MealPlan']");
    await expect(page.locator("#allPlans .product-tile")).toHaveCount(2);
    await expect(page.locator("#planShowing")).toHaveText("Showing 2 of 4");
    await page.click("[data-type='RecipeCollection']");
    await expect(page.locator("#allPlans .product-tile")).toHaveCount(2);
    await page.click("[data-type='all']");
    await page.selectOption("#planSort", "price");
    await expect(page.locator("#allPlans .product-tile").first()).toContainText("The Bread Box");
    await page.selectOption("#planSort", "rating");
    await expect(page.locator("#allPlans .product-tile").first()).toContainText("Three Weeknights in Japan");
  });

  test("marks the plans the viewer owns", async ({ page }) => {
    await signInAs(page, ALEX);
    await page.goto("plans.html");
    await expect(page.locator("#allPlans .product-tile", { hasText: "Family Week" })).toContainText("You own this");
    await expect(page.locator("#allPlans .product-tile", { hasText: "The Bread Box" })).not.toContainText("You own this");
  });
});

test.describe("Recipes", () => {
  test("lists the six free recipes only, searches, and sorts", async ({ page }) => {
    await signInAs(page, GUEST);
    await page.goto("recipes.html");
    await expect(page.locator("#freeRecipes .recipe-card")).toHaveCount(6);
    await expect(page.locator("#recipeShowing")).toHaveText("6 free recipes");
    // A premium recipe is sold in a plan, so it is not on this page at all, not even locked.
    await expect(page.locator("main .recipe-card.locked")).toHaveCount(0);
    await expect(page.locator("main .recipe-card", { hasText: "Onigiri" })).toHaveCount(0);
    await expect(page.locator("main a[href='plans.html']")).toHaveCount(1);
    await expect(page.locator("#freeRecipes .recipe-title").first()).toHaveText("Sheet-Pan Chicken and Vegetables");
    await page.click("[data-sort='newest']");
    await expect(page.locator("#freeRecipes .recipe-title").first()).toHaveText("Black Bean Quesadillas");
    await page.fill("#recipeSearch", "tamago");
    await expect(page.locator("#freeRecipes .recipe-card")).toHaveCount(1);
    await page.fill("#recipeSearch", "onigiri");
    await expect(page.locator("#freeRecipes .recipe-card")).toHaveCount(0);
    await expect(page.locator("#noFree")).toBeVisible();
    await page.fill("#recipeSearch", "kenji");
    await expect(page.locator("#freeRecipes .recipe-card")).toHaveCount(2);
  });

  test("a buyer sees the same six free recipes; what they bought lives on the plan page and in their kitchen", async ({ page }) => {
    await signInAs(page, ALEX);
    await page.goto("recipes.html");
    await expect(page.locator("#freeRecipes .recipe-card")).toHaveCount(6);
    await expect(page.locator("main .recipe-card", { hasText: "Onigiri" })).toHaveCount(0);
    await page.goto("product.html?id=3");
    await expect(page.locator("#planRecipes .recipe-card", { hasText: "Onigiri" }).locator("a").first()).toHaveAttribute("href", /recipe\.html\?id=6/);
  });
});

test("the nav reaches Plans and Recipes from every page", async ({ page }) => {
  await signInAs(page, GUEST);
  await page.goto("index.html");
  await expect(page.locator(".navlink[href='plans.html']")).toBeVisible();
  await expect(page.locator(".navlink[href='recipes.html']")).toBeVisible();
  await page.click("#seeAllPlans");
  await expect(page).toHaveURL(/plans\.html/);
  await page.goto("index.html");
  await page.click("#seeAllRecipes");
  await expect(page).toHaveURL(/recipes\.html/);
});
