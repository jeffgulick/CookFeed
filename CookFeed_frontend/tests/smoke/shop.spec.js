/* "Shop this" (design section 3.9): a recipe or an owned plan goes straight onto a shopping trip from its own
   page, onto a trip still being built or shopped or onto a new one, and only for a cook who may open it. */

const { test, expect, signInAs, GUEST, ALEX, ADMIN, SAM } = require("./support");

test("a free recipe is shopped from its page for the people set; an owned plan joins the same trip", async ({ page }) => {
  await signInAs(page, ALEX);
  await page.goto("recipe.html?id=18");                                  // Sheet-Pan Chicken and Vegetables, serves 4
  await page.fill("#servingsInput", "6");
  await page.click("#shopButton");
  await expect(page.locator("#shopDialog")).toBeVisible();
  await expect(page.locator("#shopTrips input")).toHaveCount(1);        // no trip yet: only "A new trip"
  await expect(page.locator("#shopName")).toHaveValue("Sheet-Pan Chicken and Vegetables");
  await page.click("#shopSubmit");
  await expect(page).toHaveURL(/list\.html\?trip=1$/);
  await expect(page.locator("#tripHeading")).toHaveText("Sheet-Pan Chicken and Vegetables");
  await expect(page.locator(".toast")).toContainText("1 recipe added");
  await expect(page.locator(".trip-item input")).toHaveValue("6");
  await expect(page.locator(".store-line", { hasText: "chicken breast" })).toHaveCount(1);

  await test.step("Shop this plan offers the open trip first", async () => {
    await page.goto("product.html?id=4");                                // Family Week on a Budget, owned
    await expect(page.locator("#shopPlan")).toBeVisible();
    await page.click("#shopPlan");
    await expect(page.locator("#shopTrips input[value='1']")).toBeChecked();
    await expect(page.locator("#shopNameField")).toBeHidden();
    await page.click("#shopSubmit");
    await expect(page).toHaveURL(/list\.html\?trip=1$/);
    await expect(page.locator(".trip-item")).toHaveCount(6);            // 1 recipe + the plan's 5 distinct recipes
    await expect(page.locator(".toast")).toContainText("5 recipes added");
    // The oats are on two mornings: one item, for both.
    await expect(page.locator(".trip-item", { hasText: "Overnight Oats" }).locator("input")).toHaveValue("10");
    // Shopping the same plan onto the same trip again adds nothing.
    await page.goto("product.html?id=4");
    await page.click("#shopPlan");
    await page.click("#shopSubmit");
    await expect(page.locator(".toast")).toContainText("already on this trip");
    await expect(page.locator(".trip-item")).toHaveCount(6);
  });

  await test.step("a new trip can still be chosen and named", async () => {
    await page.goto("recipe.html?id=16");                                // Tamagoyaki
    await page.click("#shopButton");
    await page.locator("#shopTrips input[value='0']").check();
    await expect(page.locator("#shopNameField")).toBeVisible();
    await page.fill("#shopName", "Sunday breakfast");
    await page.click("#shopSubmit");
    await expect(page).toHaveURL(/list\.html\?trip=2$/);
    await expect(page.locator("#tripHeading")).toHaveText("Sunday breakfast");
    await page.goto("kitchen.html");
    await expect(page.locator("#tripRows tr")).toHaveCount(2);
  });
});

test("only a cook who may open it can shop it: no button for a guest, the admin, or a plan not bought", async ({ page }) => {
  await signInAs(page, GUEST);
  await page.goto("recipe.html?id=18");
  await expect(page.locator("#shopButton")).toHaveCount(0);
  await signInAs(page, ADMIN);
  await page.goto("recipe.html?id=18");
  await expect(page.locator("#shopButton")).toHaveCount(0);
  await signInAs(page, SAM);
  await page.goto("product.html?id=4");
  await expect(page.locator("#shopPlan")).toBeHidden();
  await page.goto("recipe.html?id=6");                                   // Onigiri, sold in a plan Sam does not own
  await expect(page.locator("#shopButton")).toHaveCount(0);
  await signInAs(page, ALEX);
  await page.goto("product.html?id=2");                                  // The Bread Box: Alex's order was cancelled
  await expect(page.locator("#shopPlan")).toBeHidden();
  await page.goto("recipe.html?id=6");                                   // owned through Three Weeknights in Japan
  await expect(page.locator("#shopButton")).toHaveCount(1);
});
