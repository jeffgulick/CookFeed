/* Data safety: what a cook or the admin can do that must never leave the data wrong. Two tabs, numbers of
   people, a week pressed twice, a deleted list's ticks, a plan that went off sale in a cart, a double tap. */

const { test, expect, signInAs, ALEX, PRIYA, ADMIN } = require("./support");

const IN_ALEXS_WEEK = new Date("2026-09-23T12:00:00");           // the kitchen opens on the week of today

test("two tabs never overwrite each other: a stale tab reloads instead of saving over newer data", async ({ page, context }) => {
  await page.clock.setFixedTime(IN_ALEXS_WEEK);
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  const other = await context.newPage();
  await other.goto(page.url());

  // A list started in the other tab appears here, and this tab cannot start a second one over it.
  await other.click("#startList");
  await expect(other).toHaveURL(/list\.html\?trip=1$/);
  await expect(page.locator("#activeList")).toContainText("Shopping list, Sept 23");
  await expect(page.locator("#startList")).toHaveCount(0);
  await page.click("#shopWeek");
  await expect(page.locator(".toast")).toContainText("added to your shopping list");
  await page.goto("kitchen.html");
  await expect(page.locator("#activeList")).toContainText("4 recipes");

  // A list sent here closes on the other tab too; the other tab cannot change it any more.
  await page.click("#openActiveList");
  await page.click("#sendInstacart");
  await page.click("#confirmOk");
  await expect(other.locator("#tripStatus")).toContainText("Sent to Instacart");
  await expect(other.locator(".remove-item")).toHaveCount(0);
  await other.close();
});

test("a number of people is a whole number from 1 to 50; anything else is refused with a reason and never saved", async ({ page }) => {
  await page.clock.setFixedTime(IN_ALEXS_WEEK);
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  const teriyaki = page.locator("#weekEntries .week-row", { hasText: "Chicken Teriyaki" });
  const box = teriyaki.locator(".people-input");
  await box.fill("25");
  await expect(teriyaki.locator(".people-error")).toHaveText("");
  await box.fill("999");
  await expect(teriyaki.locator(".people-error")).toContainText("between 1 and 50");
  await box.fill("2.5");
  await expect(teriyaki.locator(".people-error")).toContainText("whole number");
  await box.blur();
  await expect(box).toHaveValue("25");                                  // the last good number comes back
  await page.reload();
  await expect(page.locator("#weekEntries .week-row", { hasText: "Chicken Teriyaki" }).locator(".people-input")).toHaveValue("25");
  await page.locator("#weekEntries .week-row", { hasText: "Chicken Teriyaki" }).getByRole("button", { name: /One more person/ }).click();
  await expect(page.locator("#weekEntries .week-row", { hasText: "Chicken Teriyaki" }).locator(".people-input")).toHaveValue("26");
});

test("a plan put on the week twice, or double-clicked, adds its meals once", async ({ page }) => {
  await page.clock.setFixedTime(IN_ALEXS_WEEK);
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await page.click("#nextWeek");
  const card = page.locator("#ownedPlans .plan-card", { hasText: "Family Week" });
  await card.locator(".plan-product").dblclick();
  await expect(page.locator("#weekEntries .week-row")).toHaveCount(6);
  await expect(card).toContainText("On next week");
  await expect(card.locator(".plan-product")).toHaveCount(0);
});

test("a deleted list's ticks never show on a new list, and its number is not reused", async ({ page }) => {
  await page.clock.setFixedTime(IN_ALEXS_WEEK);
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await page.click("#shopWeek");
  await page.click("#openActiveList");
  await expect(page).toHaveURL(/trip=1$/);
  await page.click("#startShopping");
  await page.locator(".store-line input[type='checkbox']").first().check();
  await page.click("#deleteTrip");
  await page.click("#confirmOk");
  await page.click("#shopWeek");
  await page.click("#openActiveList");
  await expect(page).toHaveURL(/trip=2$/);
  await page.click("#startShopping");
  await expect(page.locator(".store-line input[type='checkbox']")).not.toHaveCount(0);
  await expect(page.locator(".store-line input[type='checkbox']:checked")).toHaveCount(0);
});

test("a plan that went off sale leaves the cart with a note, and is never counted or charged", async ({ page }) => {
  await signInAs(page, ADMIN);
  await page.goto("admin.html");
  await page.locator("tr", { hasText: "maria-cooks" }).locator("[data-action='suspend']").click();
  await page.click("#confirmOk");
  await page.evaluate((id) => localStorage.setItem("cookfeed.userId", String(id)), PRIYA);
  await page.goto("index.html");
  await expect(page.locator("#cartCount")).toHaveText("0");
  await page.goto("cart.html");
  await expect(page.locator(".toast")).toContainText("no longer for sale");
  await expect(page.locator("#checkoutButton")).toBeDisabled();
});

test("a double tap on an admin button applies and logs the action once", async ({ page }) => {
  await signInAs(page, ADMIN);
  await page.goto("admin.html");
  const before = await page.evaluate(() => adminActions().length);
  // Two clicks before the dialog can answer, as a quick double tap delivers them.
  await page.locator("tr", { hasText: "dan-meal-preps" }).locator("[data-action='verify']").evaluate((button) => { button.click(); button.click(); });
  await expect(page.locator("#confirmMessage")).toContainText("as verified?");
  await page.click("#confirmOk");
  await expect.poll(() => page.evaluate(() => adminActions().length)).toBe(before + 1);
});
