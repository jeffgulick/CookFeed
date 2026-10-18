/* My kitchen and shopping trips (design section 3.9): owned plans and saved recipes shown apart, the week
   planner, and a trip built from the week or from any recipes, edited, shopped or sent, and done. */

const { test, expect, signInAs, textOf, GUEST, ALEX, ADMIN, SAM } = require("./support");

test("the kitchen and a trip are for signed-in shoppers only", async ({ page }) => {
  await signInAs(page, GUEST);
  await page.goto("kitchen.html");
  await expect(page.locator("main .sign-in-to")).toHaveCount(1);
  await page.goto("list.html?trip=1");
  await expect(page.locator("main .sign-in-to")).toHaveCount(1);
  await signInAs(page, ADMIN);
  await page.goto("kitchen.html");
  await expect(page.locator("main")).toContainText("Admin accounts do not");
});

test("Alex sees his plans and saved recipes apart, his planned week, and no trips yet", async ({ page }) => {
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await expect(page.locator("#ownedPlans .plan-card")).toHaveCount(3);
  await expect(page.locator("#savedRecipes .recipe-card")).toHaveCount(6);
  await expect(page.locator("#weekLabel")).toHaveText("Week of Sept 21");
  await expect(page.locator("#weekEntries .week-row")).toHaveCount(4);
  await expect(page.locator("#weekEntries .week-row", { hasText: "Chicken Teriyaki" }).locator("input")).toHaveValue("4");
  await expect(page.locator("#tripRows")).toContainText("No trips yet");
  // Saving builds no list: the only way to a list is a trip.
  await expect(page.locator("#kitchenRows")).toHaveCount(0);
});

test("a week becomes a trip, scaled to the people planned; the list is ticked, edited, shopped and done", async ({ page }) => {
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await page.click("#tripFromWeek");
  await expect(page).toHaveURL(/list\.html\?trip=1/);
  await expect(page.locator("#tripHeading")).toHaveText("Week of Sept 21");
  await expect(page.locator("#tripStatus")).toHaveText("Building");
  const thighs = page.locator(".store-line", { hasText: "boneless chicken thigh" });
  await expect(thighs).toContainText(/1,?000 g/);   // 500 g written for 2, planned for 4

  await test.step("tick one off, and it stays ticked after a reload", async () => {
    await thighs.locator("input").check();
    await expect(page.locator("#listProgressText")).toContainText("still to buy");
    await page.reload();
    await expect(page.locator(".store-line", { hasText: "boneless chicken thigh" }).locator("input")).toBeChecked();
  });

  await test.step("take off what is already at home, then put it back", async () => {
    const before = await page.locator(".store-line").count();
    await page.getByRole("button", { name: "Take spaghetti off the list" }).click();
    await expect(page.locator(".store-line")).toHaveCount(before - 1);
    await expect(page.locator("#skippedStrip")).toContainText("spaghetti");
    await page.locator("#skippedStrip .unskip-line").click();
    await expect(page.locator(".store-line")).toHaveCount(before);
  });

  await test.step("shopping it keeps the list editable; done closes it", async () => {
    await page.click("#startShopping");
    await expect(page.locator("#tripStatus")).toHaveText("Shopping");
    await page.locator(".trip-item", { hasText: "Weeknight Beef Tacos" }).locator(".remove-item").click();
    await expect(page.locator(".store-line", { hasText: "ground beef" })).toHaveCount(0);
    await page.click("#finishTrip");
    await page.click("#confirmOk");
    await expect(page.locator("#tripStatus")).toContainText("Done");
    await expect(page.locator(".skip-line")).toHaveCount(0);
    await expect(page.locator("#addMore")).toBeHidden();
    await page.goto("kitchen.html");
    await expect(page.locator("#tripRows tr", { hasText: "Week of Sept 21" })).toContainText("Done");
  });
});

test("a trip is built from any recipes and plans, for any number of people, sent, and received", async ({ page }) => {
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await page.click("#newTrip");
  await page.fill("#tripName", "Taco night");
  await page.locator("#buildPlans .pick-plan[value='4']").check();                     // Family Week on a Budget
  const carbonara = page.locator("#buildRecipes .placement", { hasText: "Spaghetti Carbonara" });
  await carbonara.locator(".pick-recipe").check();
  await carbonara.locator(".pick-servings").fill("8");
  await page.click("#buildSubmit");
  await expect(page).toHaveURL(/list\.html\?trip=/);
  await expect(page.locator("#tripHeading")).toHaveText("Taco night");
  await expect(page.locator(".trip-item")).toHaveCount(7);                             // 1 recipe + the plan's 6 meals
  await expect(page.locator(".store-line[data-key='spaghetti|g']")).toContainText(/800 g/);          // 400 g written for 4, cooked for 8

  await test.step("add more, then change the people", async () => {
    await page.click("#addMore");
    await page.locator("#buildRecipes .placement", { hasText: "Brown Butter" }).locator(".pick-recipe").check();
    await page.click("#buildSubmit");
    await expect(page.locator(".trip-item")).toHaveCount(8);
    await page.locator(".trip-item", { hasText: "Spaghetti Carbonara" }).first().locator("input").fill("4");
    await expect(page.locator(".store-line[data-key='spaghetti|g']")).toContainText(/400 g/);
  });

  await test.step("send it to Instacart and confirm the items arrived", async () => {
    await page.click("#sendInstacart");
    await page.click("#confirmOk");
    await expect(page.locator("#tripStatus")).toHaveText("Sent to Instacart");
    await expect(page.locator("#finishTrip")).toContainText("Items received");
    await page.click("#finishTrip");
    await page.click("#confirmOk");
    await expect(page.locator("#tripStatus")).toContainText("Done");
  });
});

test("Sam, with no plans, can still build a trip from what he saved, and nobody sees another cook's trip", async ({ page }) => {
  await signInAs(page, SAM);
  await page.goto("kitchen.html");
  await expect(page.locator("#noPlans")).toBeVisible();
  await expect(page.locator("#weekEntries")).toContainText("Nothing planned");
  await expect(page.locator("#tripFromWeek")).toBeDisabled();
  await page.click("#newTrip");
  await expect(page.locator("#buildPlans")).toContainText("not bought a plan");
  await page.locator("#buildRecipes .placement", { hasText: "Tamagoyaki" }).locator(".pick-recipe").check();
  await page.click("#buildSubmit");
  await expect(page.locator("#tripHeading")).toHaveText(/Trip on/);
  await expect(page.locator(".trip-item")).toHaveCount(1);
  await page.evaluate(() => localStorage.setItem("cookfeed.userId", "1"));
  await page.goto("list.html?trip=1");
  expect(await textOf(page, "main")).toContain("no trip of yours");
});
