/* A plan's page (product.html?id=) and buying it: a plan the cook owns drops its price and sales copy and
   leads with Shop this plan and Add to my week; every viewer sees a read-only "What you'll buy", with no tick
   boxes, Send buttons, Print or people box of its own (the shopping list does that). The receipt leads to the
   plan and the week, an empty cart or order history leads to the plans, and Sign in to save comes back. */

const { test, expect, signInAs, textOf, GUEST, ALEX, KENJI, ADMIN, SAM } = require("./support");

test("a plan the cook owns leads with Shop this plan and Add to my week, and no price or sales copy", async ({ page }) => {
  await signInAs(page, ALEX);
  await page.goto("product.html?id=4");                                 // Family Week on a Budget, owned
  await expect(page.locator(".buybar #shopPlan")).toBeVisible();
  await expect(page.locator(".buybar #planPlan")).toBeVisible();
  await expect(page.locator("#shopPlan")).toHaveCount(1);              // one Shop this plan on the page
  await expect(page.locator("#priceTag")).toBeHidden();
  await expect(page.locator("#priceNote")).toBeHidden();
  await expect(page.locator(".what-you-get")).toBeHidden();
  await expect(page.locator(".cta-foot")).toBeHidden();
  expect(await textOf(page, "#buyArea")).toContain("You own this plan");
});

test("What you'll buy is read-only: no ticks, Send, Print, progress or people box", async ({ page }) => {
  await signInAs(page, ALEX);
  await page.goto("product.html?id=4");
  await expect(page.locator("main h2", { hasText: "What you'll buy" })).toHaveCount(1);
  await expect(page.locator("#shoppingRows tr", { hasText: "rolled oats" })).toContainText("5 c");   // both mornings
  await expect(page.locator("#shoppingRows input")).toHaveCount(0);
  for (const gone of ["#sendInstacart", "#sendFavor", "#printButton", "#servingsInput", ".list-progress", "#clearHave"]) {
    await expect(page.locator(gone)).toHaveCount(0);
  }
});

test("What you'll buy is what the cook bought, not the plan as it is now", async ({ page }) => {
  await signInAs(page, ALEX);
  await page.goto("product.html?id=1");                                 // Roman Pasta: the focaccia was taken out after
  await expect(page.locator("#buyFrom")).toContainText("No-Knead Focaccia");
});

test("a plan not owned keeps its price and sales copy, and offers no shopping", async ({ page }) => {
  await signInAs(page, SAM);
  await page.goto("product.html?id=4");
  await expect(page.locator("#priceTag")).toBeVisible();
  await expect(page.locator("#priceNote")).toContainText("5 recipes, 6 meals");
  await expect(page.locator(".what-you-get")).toBeVisible();
  await expect(page.locator("#shopPlan")).toBeHidden();
  await expect(page.locator("#planPlan")).toBeHidden();
  await expect(page.locator("#listPreview")).toContainText("every ingredient for all 6 meals");
});

test("the pitch is only for someone deciding: not the creator, the admin, or a plan no longer for sale", async ({ page }) => {
  await signInAs(page, KENJI);
  await page.goto("product.html?id=3");                                 // his own plan
  await expect(page.locator("#priceTag")).toBeVisible();               // he still sees what it sells for
  await expect(page.locator(".what-you-get")).toBeHidden();
  await expect(page.locator(".cta-foot")).toBeHidden();
  await signInAs(page, ADMIN);
  await page.goto("product.html?id=3");
  await expect(page.locator(".what-you-get")).toBeHidden();
  await expect(page.locator("#buySection")).toBeHidden();
  await expect(page.locator(".lock-label").first()).toHaveText(/Premium recipe/);
  await expect(page.locator("main")).not.toContainText("when you buy");
  await signInAs(page, SAM);
  await page.goto("product.html?id=5");                                 // retired
  expect(await textOf(page, "#buyArea")).toBe("No longer for sale");
  await expect(page.locator("#priceTag")).toBeHidden();
  await expect(page.locator(".what-you-get")).toBeHidden();
  await expect(page.locator("#buySection")).toBeHidden();
});

test("an owner's plan page shows the recipes they bought", async ({ page }) => {
  await signInAs(page, ALEX);
  await page.goto("product.html?id=1");
  await expect(page.locator("#planRecipes .recipe-card", { hasText: "No-Knead Focaccia" })).toHaveCount(1);
  await expect(page.locator("#planRecipes .recipe-card.locked")).toHaveCount(0);
});

test("the receipt leads to the plan and the week, with no Still deciding", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-14T12:00:00"));      // a Wednesday
  await signInAs(page, SAM);
  await page.goto("product.html?id=3");
  await page.click("#buyArea .buy-button");
  await page.goto("cart.html");
  await page.click("#checkoutButton");
  await page.click("#confirmOk");
  await expect(page.locator("#receiptHeading")).toBeFocused();
  await expect(page.locator("main")).not.toContainText("Still deciding");
  await expect(page.locator(".receipt a", { hasText: "Open your plan" })).toHaveAttribute("href", "product.html?id=3");
  await page.locator(".receipt button", { hasText: "Add to my week" }).click();
  await expect(page.locator("#planWeekChoice input[value='2026-10-12']")).toBeChecked();
  await page.click("#planPlanSubmit");
  await expect(page.locator(".toast")).toContainText("3 meals added to this week");
});

test("an empty cart and an empty order history lead to the plans", async ({ page }) => {
  await signInAs(page, SAM);
  await page.goto("cart.html");
  await expect(page.locator("#emptyNote a")).toHaveAttribute("href", "plans.html");
  await expect(page.locator("main")).not.toContainText("Still deciding");
  await page.goto("orders.html");
  await expect(page.locator("#noOrders a")).toHaveAttribute("href", "plans.html");
});

test("Sign in to save brings the guest back to the page they were on", async ({ page }) => {
  await signInAs(page, GUEST);
  await page.goto("recipe.html?id=18");
  await page.click("#saveArea .sign-in-to");
  await expect(page).toHaveURL(/signin\.html\?next=recipe\.html%3Fid%3D18$/);
  await page.getByRole("button", { name: "Sign in as Sam Lee" }).click();
  await expect(page).toHaveURL(/recipe\.html\?id=18$/);
  await expect(page.locator("#saveButton")).toBeVisible();
});

test("a next address that leaves the site is ignored", async ({ page }) => {
  await signInAs(page, GUEST);
  await page.goto("signin.html?next=https%3A%2F%2Fexample.com%2F");
  await page.getByRole("button", { name: "Sign in as Sam Lee" }).click();
  await expect(page).toHaveURL(/signin\.html/);
  await expect(page.locator("#signinStatus")).toContainText("signed in as");
});
