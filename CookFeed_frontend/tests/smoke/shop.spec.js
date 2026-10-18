/* "Shop this" and "Add to my week" (design section 3.9): a recipe or an owned plan goes straight onto the one
   shopping list from its own page, with a toast to undo it or open the list, and only for a cook who may open
   it. The date is pinned: Oct 18, 2026 is a Sunday. */

const { test, expect, signInAs, GUEST, ALEX, ADMIN, SAM } = require("./support");

const SUNDAY = new Date("2026-10-18T12:00:00");

test("Shop this recipe and Shop this plan add straight to the one shopping list, with Undo and Open list", async ({ page }) => {
  await page.clock.setFixedTime(SUNDAY);
  await signInAs(page, ALEX);
  await page.goto("recipe.html?id=18");                                  // Sheet-Pan Chicken and Vegetables, serves 4
  await page.fill("#servingsInput", "6");
  await page.click("#shopButton");
  await expect(page.locator("#shopDialog")).toHaveCount(0);              // no trip to choose: there is one list
  await expect(page.locator(".toast")).toContainText("added to your shopping list");
  await expect(page.locator(".toast .toast-undo")).toHaveText("Undo");
  await expect(page.locator(".toast .toast-open")).toHaveAttribute("href", "list.html?trip=1");
  await page.locator(".toast .toast-open").click();
  await expect(page.locator("#tripHeading")).toHaveText("Shopping list, Oct 18");
  await expect(page.locator(".trip-item input")).toHaveValue("6");

  await test.step("a plan joins the same list, once", async () => {
    await page.goto("product.html?id=4");                                // Family Week on a Budget, owned
    await page.click("#shopPlan");
    await expect(page.locator(".toast")).toContainText("5 recipes added to your shopping list");
    await page.click("#shopPlan");
    await expect(page.locator(".toast")).toContainText("already on your shopping list");
    await page.goto("list.html?trip=1");
    await expect(page.locator(".trip-item")).toHaveCount(6);
    // The oats are on two mornings: one item, for both.
    await expect(page.locator(".trip-item", { hasText: "Overnight Oats" }).locator("input")).toHaveValue("10");
  });

  await test.step("Undo takes off what was just added", async () => {
    await page.goto("recipe.html?id=16");                                // Tamagoyaki
    await page.click("#shopButton");
    await page.locator(".toast .toast-undo").click();
    await expect(page.locator(".toast")).toContainText("Taken off your shopping list");
    await page.goto("list.html?trip=1");
    await expect(page.locator(".trip-item")).toHaveCount(6);
    await page.goto("kitchen.html");
    await expect(page.locator("#tripRows tr")).toHaveCount(1);
    await expect(page.locator("#tripRows")).toContainText("No past lists yet");
  });
});

test("Shop this plan shops what the cook bought, not the plan as it is now", async ({ page }) => {
  await page.clock.setFixedTime(SUNDAY);
  await signInAs(page, ALEX);
  await page.goto("product.html?id=1");                                  // Roman Pasta: Maria took the focaccia out later
  await page.click("#shopPlan");
  await expect(page.locator(".toast")).toContainText("4 recipes added");
  await page.goto("list.html?trip=1");
  await expect(page.locator(".trip-item", { hasText: "Focaccia" })).toHaveCount(1);
});

test("Add to my week puts a recipe on a day from today, and an owned plan on a whole week", async ({ page }) => {
  await page.clock.setFixedTime(SUNDAY);
  await signInAs(page, ALEX);
  await page.goto("recipe.html?id=18");
  await page.fill("#servingsInput", "6");
  await page.click("#planButton");
  await expect(page.locator("#planDialog")).toBeVisible();
  await expect(page.locator("#planDay option").first()).toHaveText("Today, Sunday, Oct 18");
  await expect(page.locator("#planDay option")).toHaveCount(14);
  await expect(page.locator("#planDialog .people-input")).toHaveValue("6");
  await page.selectOption("#planDay", { label: "Tuesday, Oct 20" });
  await page.click("#planSubmit");
  await expect(page.locator(".toast")).toContainText("added to next week");
  await expect(page.locator(".toast a")).toHaveAttribute("href", "kitchen.html?week=2026-10-19");

  await page.goto("product.html?id=4");                                  // Family Week, owned
  await page.click("#planPlan");
  // On a Sunday this week is nearly over, so next week is offered first.
  await expect(page.locator("#planWeekChoice input[value='2026-10-19']")).toBeChecked();
  await page.click("#planPlanSubmit");
  await expect(page.locator(".toast")).toContainText("6 meals added to next week");

  await page.goto("kitchen.html?week=2026-10-19");
  await expect(page.locator("#weekLabel")).toHaveText("Next week");
  await expect(page.locator("#weekEntries .week-row")).toHaveCount(7);
  await expect(page.locator("#weekEntries .week-row", { hasText: "Sheet-Pan" }).locator(".people-input")).toHaveValue("6");
});

test("only a cook who may open it can shop it or plan it: no buttons for a guest, the admin, or a plan not bought", async ({ page }) => {
  await signInAs(page, GUEST);
  await page.goto("recipe.html?id=18");
  await expect(page.locator("#shopButton")).toHaveCount(0);
  await expect(page.locator("#planButton")).toHaveCount(0);
  await signInAs(page, ADMIN);
  await page.goto("recipe.html?id=18");
  await expect(page.locator("#shopButton")).toHaveCount(0);
  await expect(page.locator("#planButton")).toHaveCount(0);
  await signInAs(page, SAM);
  await page.goto("product.html?id=4");
  await expect(page.locator("#shopPlan")).toBeHidden();
  await expect(page.locator("#planPlan")).toBeHidden();
  await page.goto("recipe.html?id=6");                                   // Onigiri, sold in a plan Sam does not own
  await expect(page.locator("#shopButton")).toHaveCount(0);
  await expect(page.locator("#planButton")).toHaveCount(0);
  await signInAs(page, ALEX);
  await page.goto("product.html?id=2");                                  // The Bread Box: Alex's order was cancelled
  await expect(page.locator("#shopPlan")).toBeHidden();
  await expect(page.locator("#planPlan")).toBeHidden();
  await page.goto("recipe.html?id=6");                                   // owned through Three Weeknights in Japan
  await expect(page.locator("#shopButton")).toHaveCount(1);
  await expect(page.locator("#planButton")).toHaveCount(1);
});
