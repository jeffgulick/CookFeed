/* The marketplace rules of DesignDocument section 3, as each seeded account sees them on screen. The rule
   logic itself is unit-tested in tests/rules.test.js; these check that every page shows what it decides. */

const { test, expect, signInAs, textOf, GUEST, ALEX, KENJI, ADMIN } = require("./support");

test.describe("a signed-out visitor", () => {
  test.beforeEach(async ({ page }) => { await signInAs(page, GUEST); });

  test("Discover lists the four products for sale and six public trending recipes", async ({ page }) => {
    await page.goto("index.html");
    await expect(page.locator(".product-tile")).toHaveCount(4);
    await expect(page.locator("#trendingRecipes .recipe-card")).toHaveCount(6);
    await expect(page.locator("#trendingRecipes")).not.toContainText("Onigiri");
    await expect(page.locator("#trendingRecipes .recipe-title").first()).toHaveText("Brown Butter Chocolate Chip Cookies");
  });

  test("a plan offers sign-in links, and its ProductOnly recipe is locked and off the list", async ({ page }) => {
    await page.goto("product.html?id=3");
    await expect(page.locator("#buyArea")).toHaveText("Sign in to buy");
    await expect(page.locator("#planRecipes .sign-in-to")).toHaveCount(2);
    await expect(page.locator(".recipe-card.locked")).toHaveCount(1);
    await expect(page.locator(".recipe-card.locked a")).toHaveCount(0);
    await expect(page.locator("#lockedNote")).toContainText("Onigiri Three Ways");
    await expect(page.locator("#shoppingRows")).not.toContainText("salmon");
  });

  test("a ProductOnly recipe's page says which plan it comes with", async ({ page }) => {
    await page.goto("recipe.html?id=6");
    await expect(page.locator("main")).toContainText("only for cooks who bought the plan");
    await expect(page.locator("main a", { hasText: "Three Weeknights in Japan" })).toBeVisible();
  });

  test("the review form is replaced by a sign-in link", async ({ page }) => {
    await page.goto("reviews.html?product=3");
    await expect(page.locator("#reviewForm")).toBeHidden();
    expect(await textOf(page, "#reviewGate")).toMatch(/^Sign in to write a review/);
    await expect(page.locator("#reviewCount")).toHaveText("3");
  });
});

test.describe("Alex, a home cook with seeded orders", () => {
  test.beforeEach(async ({ page }) => { await signInAs(page, ALEX); });

  test("starts with The Bread Box in the cart", async ({ page }) => {
    await page.goto("cart.html");
    await expect(page.locator("#cartLines")).toContainText("The Bread Box");
    await expect(page.locator("#cartCount")).toHaveText("1");
  });

  test("sees three orders, one of them cancelled", async ({ page }) => {
    await page.goto("orders.html");
    await expect(page.locator(".order-card")).toHaveCount(3);
    await expect(page.locator(".order-card.cancelled")).toHaveCount(1);
  });

  test("may review Roman Pasta, but not Three Weeknights again or the cancelled Bread Box", async ({ page }) => {
    await page.goto("reviews.html?product=1");
    await expect(page.locator("#reviewForm")).toBeVisible();
    await page.goto("reviews.html?product=3");
    expect(await textOf(page, "#reviewGate")).toMatch(/^You have reviewed/);
    await expect(page.locator(".remove-review")).toHaveCount(1);
    await page.goto("reviews.html?product=2");
    expect(await textOf(page, "#reviewGate")).toMatch(/^Only cooks who bought/);
  });

  test("opens Chicken Parm through Roman Pasta, and has six saved recipes", async ({ page }) => {
    await page.goto("recipe.html?id=4");
    await expect(page.locator("#ownedNote")).toHaveText("Yours through Roman Pasta Collection");
    await page.goto("kitchen.html");
    await expect(page.locator("#savedRecipes .recipe-card")).toHaveCount(6);
  });
});

test.describe("Kenji, a creator", () => {
  test.beforeEach(async ({ page }) => { await signInAs(page, KENJI); });

  test("cannot buy or review his own plan, but can buy Maria's", async ({ page }) => {
    await page.goto("product.html?id=3");
    expect(await textOf(page, "#buyArea")).toMatch(/^This is your plan/);
    await expect(page.locator(".buy-button")).toHaveCount(0);
    await page.goto("reviews.html?product=3");
    expect(await textOf(page, "#reviewGate")).toMatch(/^This is your own plan/);
    await page.goto("product.html?id=1");
    await expect(page.locator("#buyArea .buy-button")).toHaveCount(1);
  });

  test("opens his own ProductOnly recipe and his draft, and sees his own storefront", async ({ page }) => {
    await page.goto("recipe.html?id=6");
    await expect(page.locator("main h1")).toHaveText("Onigiri Three Ways");
    await page.goto("recipe.html?id=13");
    await expect(page.locator("#ownedNote")).toContainText("A draft");
    await page.goto("creator.html?handle=kenji-kitchen");
    await expect(page.locator("#ownStorefront")).toBeVisible();
  });
});

test.describe("the admin", () => {
  test.beforeEach(async ({ page }) => { await signInAs(page, ADMIN); });

  test("sees no shop links, cart, save, buy or review controls", async ({ page }) => {
    await page.goto("index.html");
    await expect(page.locator(".cart-chip")).toBeHidden();
    await expect(page.locator(".navlink[href='kitchen.html']")).toBeHidden();
    await expect(page.locator(".save-button, .sign-in-to")).toHaveCount(0);
    await page.goto("product.html?id=3");
    await expect(page.locator("#buyArea")).toHaveText("");
    await page.goto("reviews.html?product=3");
    expect(await textOf(page, "#reviewGate")).toMatch(/^Admin accounts/);
    await page.goto("cart.html");
    await expect(page.locator("#cartArea")).toContainText("Admin accounts do not shop");
  });
});

test("Family Week counts 5 recipes and 6 meals, and buys the oats for both mornings", async ({ page }) => {
  await signInAs(page, GUEST);
  await page.goto("product.html?id=4");
  await expect(page.locator("#priceNote")).toContainText("5 recipes, 6 meals");
  await expect(page.locator("#shoppingRows tr", { hasText: "rolled oats" })).toContainText("5 c");
});

test("save counts read naturally: 1 cook, 7 cooks", async ({ page }) => {
  await signInAs(page, GUEST);
  await page.goto("product.html?id=4");
  await expect(page.locator(".recipe-card", { hasText: "Weeknight Beef Tacos" }).locator(".save-text")).toHaveText("saved by 1 cook");
  await page.goto("product.html?id=3");
  await expect(page.locator(".recipe-card", { hasText: "Chicken Teriyaki" }).locator(".save-text")).toHaveText("saved by 7 cooks");
  await page.goto("recipe.html?id=10");
  await expect(page.locator("#savedBy")).toHaveText("saved by 1 cook");
});

test("a storefront lists only the creator's public published recipes, with Q2's totals", async ({ page }) => {
  await signInAs(page, GUEST);
  await page.goto("creator.html?handle=kenji-kitchen");
  await expect(page.locator("#creatorRecipes .recipe-title")).toHaveText(
    ["Chicken Teriyaki, the Real Way", "10-Minute Ginger Garlic Stir-Fry"]);
  await expect(page.locator("#recipeCount")).toHaveText("2");
  await expect(page.locator("#totalSaves")).toHaveText("9");
});
