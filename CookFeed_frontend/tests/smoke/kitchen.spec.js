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

  await test.step("shopping it keeps the list editable; Trip complete closes it and goes back to the kitchen", async () => {
    await page.click("#startShopping");
    await expect(page.locator("#tripStatus")).toHaveText("Shopping");
    await page.locator(".trip-item", { hasText: "Weeknight Beef Tacos" }).locator(".remove-item").click();
    await expect(page.locator(".store-line", { hasText: "ground beef" })).toHaveCount(0);
    await expect(page.locator("#finishTrip")).toContainText("Trip complete");
    await page.click("#finishTrip");
    await page.click("#confirmOk");
    await expect(page).toHaveURL(/kitchen\.html$/);
    await expect(page.locator(".toast")).toContainText("is done");
    const row = page.locator("#tripRows tr", { hasText: "Week of Sept 21" });
    await expect(row).toContainText("Done");
    await expect(row.locator(".finish-trip")).toHaveCount(0);
    await expect(row.locator(".reshop-trip")).toHaveCount(1);
    await page.goto("list.html?trip=1");
    await expect(page.locator("#tripStatus")).toContainText("Done");
    await expect(page.locator(".skip-line")).toHaveCount(0);
    await expect(page.locator("#addMore")).toBeHidden();
    await expect(page.locator("#shopAgain")).toBeVisible();
  });
});

test("a trip is built from any recipes and plans, each recipe once, sent, received, and shopped again", async ({ page }) => {
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await page.click("#newTrip");
  await page.fill("#tripName", "Taco night");
  await page.locator("#buildPlans .pick-plan[value='4']").check();                     // Family Week on a Budget
  // The cookies are in Family Week too: ticked on their own for 10 people, they go on once, for the 10.
  const cookies = page.locator("#buildRecipes .placement", { hasText: "Brown Butter" });
  await cookies.locator(".pick-recipe").check();
  await cookies.locator(".people-input").fill("10");
  const carbonara = page.locator("#buildRecipes .placement", { hasText: "Spaghetti Carbonara" });
  await carbonara.locator(".pick-recipe").check();
  // A number of people the site cannot use is refused with a reason, not saved as something else.
  await carbonara.locator(".people-input").fill("999");
  await expect(carbonara.locator(".people-error")).toContainText("between 1 and 50");
  await page.click("#buildSubmit");
  await expect(page.locator("#buildError")).toContainText("People for 15-Minute Spaghetti Carbonara");
  await carbonara.locator(".people-input").fill("8");
  await page.click("#buildSubmit");
  await expect(page).toHaveURL(/list\.html\?trip=/);
  await expect(page.locator("#tripHeading")).toHaveText("Taco night");
  await expect(page.locator(".trip-item")).toHaveCount(6);                             // carbonara + the plan's 5 distinct recipes
  await expect(page.locator(".trip-item", { hasText: "Brown Butter" }).locator(".people-input")).toHaveValue("10");
  await expect(page.locator(".trip-item", { hasText: "Overnight Oats" })).toHaveCount(1);   // on two mornings, once on the trip
  await expect(page.locator(".store-line[data-key='spaghetti|g']")).toContainText(/800 g/);          // 400 g written for 4, cooked for 8

  await test.step("add more: what is on the trip already cannot be added again", async () => {
    await page.click("#addMore");
    const onTrip = page.locator("#buildRecipes .placement", { hasText: "Brown Butter" });
    await expect(onTrip).toHaveClass(/on-trip/);
    await expect(onTrip.locator(".pick-recipe")).toBeDisabled();
    await expect(page.locator("#buildPlans .pick-plan[value='4']")).toBeDisabled();
    await expect(page.locator("#buildPlans")).toContainText("already on this trip");
    await page.locator("#buildRecipes .placement", { hasText: "Focaccia" }).locator(".pick-recipe").check();
    await page.click("#buildSubmit");
    await expect(page.locator(".trip-item")).toHaveCount(7);
    await page.locator(".trip-item", { hasText: "Spaghetti Carbonara" }).first().locator("input").fill("4");
    await expect(page.locator(".store-line[data-key='spaghetti|g']")).toContainText(/400 g/);
  });

  await test.step("send it to Instacart: back to the kitchen, where the items are received", async () => {
    await page.click("#sendInstacart");
    await page.click("#confirmOk");
    await expect(page).toHaveURL(/kitchen\.html$/);
    await expect(page.locator(".toast")).toContainText("sent to Instacart");
    const row = page.locator("#tripRows tr", { hasText: "Taco night" });
    await expect(row).toContainText("Sent to Instacart");
    await expect(row.locator(".finish-trip")).toHaveText("Items received");
    await row.locator(".finish-trip").click();
    await page.click("#confirmOk");
    await expect(row).toContainText("Done");
  });

  await test.step("shop it again: a fresh trip with the same recipes and people", async () => {
    await page.locator("#tripRows tr", { hasText: "Taco night" }).locator(".reshop-trip").click();
    await expect(page).toHaveURL(/list\.html\?trip=2/);
    await expect(page.locator("#tripHeading")).toHaveText("Taco night again");
    await expect(page.locator("#tripStatus")).toHaveText("Building");
    await expect(page.locator(".trip-item")).toHaveCount(7);
    await expect(page.locator(".store-line[data-key='spaghetti|g']")).toContainText(/400 g/);
    await page.goto("kitchen.html");
    await expect(page.locator("#tripRows tr")).toHaveCount(2);
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
