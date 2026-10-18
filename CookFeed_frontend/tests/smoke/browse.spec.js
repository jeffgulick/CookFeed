/* The browse pages: Plans (every plan and collection for sale) and Recipes (every published recipe,
   free and premium), with their filters, sort and search, and what an owner sees on them. */

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
  test("lists six free and thirteen premium recipes, searches, and sorts", async ({ page }) => {
    await signInAs(page, GUEST);
    await page.goto("recipes.html");
    await expect(page.locator("#freeRecipes .recipe-card")).toHaveCount(6);
    await expect(page.locator("#premiumRecipes .recipe-card")).toHaveCount(13);
    await expect(page.locator("#premiumRecipes .recipe-card.locked")).toHaveCount(13);
    await expect(page.locator("#premiumRecipes .recipe-card", { hasText: "Onigiri" })).toContainText("In Three Weeknights in Japan");
    await expect(page.locator("#freeRecipes .recipe-title").first()).toHaveText("Sheet-Pan Chicken and Vegetables");
    await page.click("[data-sort='newest']");
    await expect(page.locator("#freeRecipes .recipe-title").first()).toHaveText("Black Bean Quesadillas");
    await page.fill("#recipeSearch", "tamago");
    await expect(page.locator("#freeRecipes .recipe-card")).toHaveCount(1);
    await expect(page.locator("#premiumRecipes .recipe-card")).toHaveCount(0);
    await expect(page.locator("#noPremium")).toBeVisible();
    await page.fill("#recipeSearch", "kenji");
    await expect(page.locator("#freeRecipes .recipe-card")).toHaveCount(2);
    await expect(page.locator("#premiumRecipes .recipe-card")).toHaveCount(3);
  });

  test("a buyer opens the premium recipes they own; the rest stay locked", async ({ page }) => {
    await signInAs(page, ALEX);
    await page.goto("recipes.html");
    await expect(page.locator("#premiumRecipes .recipe-card.locked")).toHaveCount(1);   // Rosemary Ciabatta
    await expect(page.locator("#premiumRecipes .recipe-card", { hasText: "Onigiri" })).toContainText("Yours through");
    await expect(page.locator("#premiumRecipes .recipe-card", { hasText: "Onigiri" }).locator("a").first()).toHaveAttribute("href", /recipe\.html\?id=6/);
    await signInAs(page, SAM);
    await page.goto("recipes.html");
    await expect(page.locator("#premiumRecipes .recipe-card.locked")).toHaveCount(13);
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
