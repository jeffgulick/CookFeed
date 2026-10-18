/* My kitchen and the shopping list (design section 3.9): the week first, opened on the current week; one
   shopping list at a time, filled by Shop this week; the cook's plans and saved recipes; and past lists. A
   list's page shows only the buttons that fit where it is: building, shopping, sent, or done. The tests pin
   the date, because which week is "this week" depends on it: Sept 23, 2026 is in Alex's seeded week. */

const { test, expect, signInAs, textOf, GUEST, ALEX, ADMIN, SAM } = require("./support");

const IN_ALEXS_WEEK = new Date("2026-09-23T12:00:00");
const LATER = new Date("2026-10-18T12:00:00");                    // a Sunday, four weeks after Alex's week

/* The labels of the trip page's buttons that can be seen, in order. */
async function shownActions(page) {
  return page.locator("#tripActions button:visible").allInnerTexts().then((texts) => texts.map((t) => t.trim()));
}

test("the kitchen and a list are for signed-in shoppers only", async ({ page }) => {
  await signInAs(page, GUEST);
  await page.goto("kitchen.html");
  await expect(page.locator("main .sign-in-to")).toHaveCount(1);
  await page.goto("list.html?trip=1");
  await expect(page.locator("main .sign-in-to")).toHaveCount(1);
  await signInAs(page, ADMIN);
  await page.goto("kitchen.html");
  await expect(page.locator("main")).toContainText("Admin accounts do not");
});

test("the kitchen opens on this week, then the shopping list, plans, saved recipes and past lists", async ({ page }) => {
  await page.clock.setFixedTime(IN_ALEXS_WEEK);
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await expect(page.locator("main h2")).toHaveText(["This week", "Your shopping list", "Your plans", "Saved recipes", "Past lists"]);
  await expect(page.locator("#weekLabel")).toHaveText("This week");
  await expect(page.locator("#weekEntries .week-row")).toHaveCount(4);
  await expect(page.locator("#weekEntries .week-row", { hasText: "Chicken Teriyaki" }).locator("input")).toHaveValue("4");
  await expect(page.locator("#backToThisWeek")).toBeHidden();
  await expect(page.locator("#activeList")).toContainText("No shopping list yet");
  await expect(page.locator("#ownedPlans .plan-card")).toHaveCount(3);
  await expect(page.locator("#savedRecipes .recipe-card")).toHaveCount(6);
  await expect(page.locator("#tripRows")).toContainText("No past lists yet");

  await page.click("#nextWeek");
  await expect(page.locator("#weekLabel")).toHaveText("Next week");
  await expect(page.locator("#backToThisWeek")).toBeVisible();
  await page.click("#backToThisWeek");
  await expect(page.locator("#weekLabel")).toHaveText("This week");
  await page.click("#prevWeek");
  await expect(page.locator("#weekLabel")).toHaveText("Week of Sept 14, 2026 (past)");
});

test("an empty week points to the week that has meals", async ({ page }) => {
  await page.clock.setFixedTime(LATER);
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await expect(page.locator("#weekLabel")).toHaveText("This week");
  await expect(page.locator("#weekEntries .week-row")).toHaveCount(0);
  await expect(page.locator("#shopWeek")).toBeDisabled();
  await expect(page.locator("#otherWeekLink")).toHaveText("Week of Sept 21, 2026 (past)");
  await page.click("#otherWeekLink");
  await expect(page.locator("#weekLabel")).toHaveText("Week of Sept 21, 2026 (past)");
  await expect(page.locator("#weekEntries .week-row")).toHaveCount(4);
  await expect(page.locator("#otherWeekLink")).toBeHidden();
});

test("Shop this week adds the week to the one shopping list, with Undo and a link to the list", async ({ page }) => {
  await page.clock.setFixedTime(IN_ALEXS_WEEK);
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await page.click("#shopWeek");
  await expect(page.locator(".toast")).toContainText("4 recipes added to your shopping list");
  await expect(page.locator("#activeList")).toContainText("Shopping list, Sept 23");
  await page.locator(".toast .toast-undo").click();
  await expect(page.locator("#activeList")).toContainText("No shopping list yet");

  await page.click("#shopWeek");
  await page.click("#shopWeek");                                   // pressed twice: nothing doubles
  await expect(page.locator(".toast")).toContainText("already on your shopping list");
  await page.locator(".toast .toast-open").click();
  await expect(page).toHaveURL(/list\.html\?trip=\d+$/);
  await expect(page.locator("#tripHeading")).toHaveText("Shopping list, Sept 23");
  await expect(page.locator(".trip-item")).toHaveCount(4);
  await expect(page.locator(".store-line", { hasText: "boneless chicken thigh" })).toContainText(/1,?000 g/);   // 500 g for 2, planned for 4
});

test("a message with Undo has no time limit: it stays until it is closed", async ({ page }) => {
  await page.clock.setFixedTime(IN_ALEXS_WEEK);
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await page.click("#shopWeek");
  await page.waitForTimeout(8500);                                 // longer than any message used to last
  await expect(page.locator(".toast .toast-undo")).toBeVisible();
  await page.locator(".toast .toast-close").click();
  await expect(page.locator(".toast")).toBeHidden();
});

test("Plan it puts one recipe on a day and meal of the week shown, for the people chosen", async ({ page }) => {
  await page.clock.setFixedTime(IN_ALEXS_WEEK);
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await page.locator("#savedRecipes .recipe-card", { hasText: "Pancakes" }).locator(".plan-recipe").click();
  await expect(page.locator("#planDialog")).toBeVisible();
  await expect(page.locator("#buildDialog")).toHaveCount(0);       // one way to plan a recipe: no big picker
  await expect(page.locator("#planWeek")).toHaveCount(0);
  await expect(page.locator("#planDay option")).toHaveCount(7);
  await page.selectOption("#planDay", { label: "Saturday, Sept 26" });
  await page.selectOption("#planSlot", "Breakfast");
  await page.locator("#planDialog .people-input").fill("3");
  await page.click("#planSubmit");
  await expect(page.locator("#planDialog")).toBeHidden();
  await expect(page.locator(".toast")).toContainText("added to this week");
  const row = page.locator("#weekEntries .week-row", { hasText: "Pancakes" });
  await expect(row).toContainText("Breakfast");
  await expect(row.locator(".people-input")).toHaveValue("3");
  await expect(page.locator("#weekEntries .week-row")).toHaveCount(5);
});

test("Move puts a meal on another day and meal, for the people chosen", async ({ page }) => {
  await page.clock.setFixedTime(IN_ALEXS_WEEK);
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await page.getByRole("button", { name: "Move Chicken Teriyaki, the Real Way" }).click();
  await expect(page.locator("#planHeading")).toHaveText("Move this meal");
  await expect(page.locator("#planDay")).toHaveValue("2026-09-21");          // where it is now
  await expect(page.locator("#planSlot")).toHaveValue("Dinner");
  await expect(page.locator("#planDialog .people-input")).toHaveValue("4");
  await page.selectOption("#planDay", { label: "Thursday, Sept 24" });
  await page.selectOption("#planSlot", "Lunch");
  await page.locator("#planDialog .people-input").fill("6");
  await page.click("#planSubmit");
  await expect(page.locator(".toast")).toContainText("moved to Thursday lunch");
  await page.reload();
  await expect(page.locator("#weekEntries .week-row")).toHaveCount(4);
  const thursday = page.locator("#weekEntries h4", { hasText: "Thursday, Sept 24" });
  await expect(thursday).toHaveCount(1);
  const row = page.locator("#weekEntries .week-row", { hasText: "Chicken Teriyaki" });
  await expect(row).toContainText("Lunch");
  await expect(row.locator(".people-input")).toHaveValue("6");
  await expect(page.locator("#weekEntries h4", { hasText: "Monday, Sept 21" })).toHaveCount(1);   // the oats stay
});

test("meals from two plans on one week can each be moved", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-14T12:00:00"));         // a Wednesday; this week is empty
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await page.locator("#ownedPlans .plan-card", { hasText: "Family Week" }).locator(".plan-product").click();
  await page.locator("#ownedPlans .plan-card", { hasText: "Three Weeknights" }).locator(".plan-product").click();
  await expect(page.locator("#weekEntries .week-row")).toHaveCount(9);
  // Both plans put a dinner on Monday: move the teriyaki to Saturday.
  await page.getByRole("button", { name: "Move Chicken Teriyaki, the Real Way" }).click();
  await page.selectOption("#planDay", { label: "Saturday, Oct 17" });
  await page.click("#planSubmit");
  const saturday = page.locator("#weekEntries .week-row", { hasText: "Chicken Teriyaki" });
  await expect(saturday).toHaveAttribute("data-date", "2026-10-17");
  await expect(saturday).toContainText("Dinner");
  // And one of Family Week's breakfasts to a snack.
  await page.getByRole("button", { name: "Move Saturday Buttermilk-Style Pancakes" }).click();
  await page.selectOption("#planSlot", "Snack");
  await page.click("#planSubmit");
  await expect(page.locator("#weekEntries .week-row", { hasText: "Pancakes" })).toContainText("Snack");
  await expect(page.locator("#weekEntries .week-row")).toHaveCount(9);
});

test("a meal cannot be moved onto the same recipe at the same meal", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-14T12:00:00"));
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await page.locator("#ownedPlans .plan-card", { hasText: "Family Week" }).locator(".plan-product").click();
  // The oats are on Monday and Thursday breakfast: moving Thursday's to Monday would double it.
  await page.locator("#weekEntries .week-row[data-date='2026-10-15']", { hasText: "Overnight Oats" }).locator(".move-entry").click();
  await page.selectOption("#planDay", { label: "Monday, Oct 12" });
  await page.click("#planSubmit");
  await expect(page.locator("#planError")).toContainText("already on that day's breakfast");
  await expect(page.locator("#planDialog")).toBeVisible();
});

/* Drag a meal by its handle with the mouse, onto the spot for a day and meal. */
async function dragMeal(page, title, date, slot) {
  const handle = page.getByRole("button", { name: `Drag ${title} to another day` });
  await handle.scrollIntoViewIfNeeded();
  const from = await handle.boundingBox();
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2 + 10, { steps: 3 });
  const spot = page.locator(`.drop-zone[data-date='${date}'][data-slot='${slot}']`);
  await expect(spot).toBeVisible();
  await spot.scrollIntoViewIfNeeded();
  const to = await spot.boundingBox();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await expect(spot).toHaveClass(/over/);
  await page.mouse.up();
}

test("a meal is dragged by its handle onto another day and meal, an empty day included", async ({ page }) => {
  await page.clock.setFixedTime(IN_ALEXS_WEEK);
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await expect(page.locator(".drop-zone")).toHaveCount(0);                 // the spots show only while dragging
  await dragMeal(page, "Chicken Teriyaki, the Real Way", "2026-09-26", "Lunch");   // Saturday has nothing yet
  await expect(page.locator(".drop-zone")).toHaveCount(0);
  await expect(page.locator(".toast")).toContainText("moved to Saturday lunch");
  await page.reload();
  const row = page.locator("#weekEntries .week-row", { hasText: "Chicken Teriyaki" });
  await expect(row).toHaveAttribute("data-date", "2026-09-26");
  await expect(row).toContainText("Lunch");
  await expect(row.locator(".people-input")).toHaveValue("4");             // the people come along
  await expect(page.locator("#weekEntries .week-row")).toHaveCount(4);
});

test("a drop onto the same recipe at the same meal is refused, and Escape cancels a drag", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-14T12:00:00"));
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await page.locator("#ownedPlans .plan-card", { hasText: "Family Week" }).locator(".plan-product").click();
  await page.reload();                                                     // the page scrolls to the week; start still
  // The oats are on Monday and Thursday breakfast.
  const thursdayOats = page.locator("#weekEntries .week-row[data-date='2026-10-15']", { hasText: "Overnight Oats" });
  const handle = thursdayOats.locator(".drag-handle");
  await handle.scrollIntoViewIfNeeded();
  const from = await handle.boundingBox();
  await page.mouse.move(from.x + 5, from.y + 5);
  await page.mouse.down();
  await page.mouse.move(from.x + 20, from.y + 20, { steps: 3 });
  const monday = page.locator(".drop-zone[data-date='2026-10-12'][data-slot='Breakfast']");
  await monday.scrollIntoViewIfNeeded();
  const to = await monday.boundingBox();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect(page.locator(".toast")).toContainText("already on Monday breakfast");
  await expect(page.locator("#weekEntries .week-row[data-date='2026-10-15']", { hasText: "Overnight Oats" })).toHaveCount(1);

  const pancakes = page.locator("#weekEntries .week-row", { hasText: "Pancakes" }).locator(".drag-handle");
  await pancakes.scrollIntoViewIfNeeded();
  const again = await pancakes.boundingBox();
  await page.mouse.move(again.x + 5, again.y + 5);
  await page.mouse.down();
  await page.mouse.move(again.x + 20, again.y + 20, { steps: 3 });
  await expect(page.locator(".drop-zone").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(page.locator(".drop-zone")).toHaveCount(0);
  await expect(page.locator("#weekEntries .week-row", { hasText: "Pancakes" })).toHaveAttribute("data-date", "2026-10-17");
});

test("the drag handle works from the keyboard: Enter opens Move", async ({ page }) => {
  await page.clock.setFixedTime(IN_ALEXS_WEEK);
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await page.getByRole("button", { name: "Drag Weeknight Beef Tacos to another day" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#planHeading")).toHaveText("Move this meal");
  await expect(page.locator("#planDay")).toHaveValue("2026-09-22");
});

test("a list shows only the buttons that fit: building, then shopping, then done", async ({ page }) => {
  await page.clock.setFixedTime(IN_ALEXS_WEEK);
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await page.click("#shopWeek");
  await page.click("#openActiveList");
  await expect(page.locator("#tripStatus")).toHaveText("Building");
  expect(await shownActions(page)).toEqual(["Start shopping", "Send to Instacart", "Send to Favor", "Print"]);
  await expect(page.locator("#tripActions .btn-primary")).toHaveCount(0);   // none of them highlighted

  await test.step("no tick boxes until the cook starts shopping", async () => {
    await expect(page.locator(".store-line input[type='checkbox']")).toHaveCount(0);
    await expect(page.locator("#listProgress")).toBeHidden();
  });

  await test.step("Have it takes off what is already at home, and it can be put back", async () => {
    const before = await page.locator(".store-line").count();
    await page.getByRole("button", { name: "Have it: spaghetti" }).click();
    await expect(page.locator(".store-line")).toHaveCount(before - 1);
    await expect(page.locator("#skippedStrip")).toContainText("spaghetti");
    await page.locator("#skippedStrip .unskip-line").click();
    await expect(page.locator(".store-line")).toHaveCount(before);
    await expect(page.locator(".store-line button", { hasText: "Remove" })).toHaveCount(0);
  });

  await test.step("shopping: the tick boxes appear, a tick means in the basket and stays after a reload", async () => {
    await page.click("#startShopping");
    await expect(page.locator("#tripStatus")).toHaveText("Shopping");
    expect(await shownActions(page)).toEqual(["Done shopping", "Print"]);
    await expect(page.locator("#listProgress")).toBeVisible();
    const thighs = page.locator(".store-line", { hasText: "boneless chicken thigh" });
    await thighs.getByRole("checkbox", { name: "In my basket: boneless chicken thigh" }).check();
    await page.reload();
    await expect(page.locator(".store-line", { hasText: "boneless chicken thigh" }).locator("input")).toBeChecked();
  });

  await test.step("shopping: the list can still change, and everything ticked says so", async () => {
    await page.locator(".trip-item", { hasText: "Weeknight Beef Tacos" }).locator(".remove-item").click();
    await expect(page.locator(".store-line", { hasText: "ground beef" })).toHaveCount(0);
    const boxes = page.locator(".store-line input[type='checkbox']");
    for (let i = 0; i < await boxes.count(); i = i + 1) { await boxes.nth(i).check(); }
    await expect(page.locator("#listProgressText")).toHaveText("All done. Everything is in your basket.");
  });

  await test.step("Done shopping goes back to the kitchen, where the list is in past lists", async () => {
    await page.click("#finishTrip");
    await page.click("#confirmOk");
    await expect(page).toHaveURL(/kitchen\.html$/);
    await expect(page.locator(".toast")).toContainText("is done");
    await expect(page.locator("#activeList")).toContainText("No shopping list yet");
    const row = page.locator("#tripRows tr", { hasText: "Shopping list, Sept 23" });
    await expect(row).toContainText("Done");
    await expect(row.locator(".finish-trip")).toHaveCount(0);
    await expect(row.locator(".reshop-trip")).toHaveCount(1);
  });

  await test.step("a done list has no tick boxes and nothing to change, only Shop again", async () => {
    await page.locator("#tripRows tr", { hasText: "Shopping list, Sept 23" }).locator("a").first().click();
    await expect(page.locator("#tripStatus")).toContainText("Done");
    expect(await shownActions(page)).toEqual(["Shop again"]);
    await expect(page.locator(".store-line input[type='checkbox']")).toHaveCount(0);
    await expect(page.locator(".skip-line")).toHaveCount(0);
    await expect(page.locator("#addMore")).toBeHidden();
  });
});

test("a sent list is read-only until the items arrive, then it can be shopped again, by date", async ({ page }) => {
  await page.clock.setFixedTime(LATER);
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await page.click("#otherWeekLink");
  await page.click("#shopWeek");
  await page.click("#openActiveList");
  await page.click("#sendInstacart");
  await page.click("#confirmOk");
  await expect(page).toHaveURL(/kitchen\.html$/);
  await expect(page.locator(".toast")).toContainText("sent to Instacart");
  const row = page.locator("#tripRows tr", { hasText: "Shopping list, Oct 18" });
  await expect(row).toContainText("Sent to Instacart");
  await expect(row.locator(".finish-trip")).toHaveText("Items arrived");
  await expect(row.locator(".reshop-trip")).toHaveCount(0);           // finished first, when the items arrive

  await test.step("the sent list changes nothing", async () => {
    await row.locator("a").first().click();
    expect(await shownActions(page)).toEqual(["Items arrived"]);
    await expect(page.locator(".store-line input[type='checkbox']")).toHaveCount(0);
    await expect(page.locator(".skip-line")).toHaveCount(0);
    await expect(page.locator(".trip-item .people-input")).toHaveCount(0);
    await expect(page.locator(".remove-item")).toHaveCount(0);
    await expect(page.locator("#addMore")).toBeHidden();
    await page.click("#finishTrip");
    await page.click("#confirmOk");
    await expect(page).toHaveURL(/kitchen\.html$/);
  });

  await test.step("Shop again makes a new list named by date, with the same recipes", async () => {
    await page.locator("#tripRows tr", { hasText: "Shopping list, Oct 18" }).locator(".reshop-trip").click();
    await expect(page).toHaveURL(/list\.html\?trip=2$/);
    await expect(page.locator("#tripHeading")).toHaveText("Shopping list, Oct 18");
    await expect(page.locator("#tripStatus")).toHaveText("Building");
    await expect(page.locator(".trip-item")).toHaveCount(4);
  });

  await test.step("while that list is open, nothing else can be shopped again", async () => {
    await page.goto("kitchen.html");
    await expect(page.locator("#tripRows .reshop-trip")).toHaveCount(0);
    await page.locator("#tripRows tr", { hasText: "Done" }).locator("a").first().click();
    expect(await shownActions(page)).toEqual([]);
    await expect(page.locator("#tripHint")).toContainText("Finish your current shopping list");
    await page.goto("kitchen.html");
    expect(await textOf(page, "#tripRows")).not.toContain("again");
  });
});

test("Sam, with no plans, starts a list and adds what he saved; nobody sees another cook's list", async ({ page }) => {
  await page.clock.setFixedTime(LATER);
  await signInAs(page, SAM);
  await page.goto("kitchen.html");
  await expect(page.locator("#noPlans")).toBeVisible();
  await expect(page.locator("#weekEntries")).toContainText("Nothing planned");
  await expect(page.locator("#shopWeek")).toBeDisabled();
  await page.click("#startList");
  await expect(page).toHaveURL(/list\.html\?trip=1$/);
  await expect(page.locator("#tripHeading")).toHaveText("Shopping list, Oct 18");
  await page.click("#addMore");
  await expect(page.locator("#buildPlans")).toContainText("not bought a plan");
  await page.locator("#buildRecipes .placement", { hasText: "Tamagoyaki" }).locator(".pick-recipe").check();
  await page.click("#buildSubmit");
  await expect(page.locator(".trip-item")).toHaveCount(1);
  await page.goto("kitchen.html");
  await expect(page.locator("#startList")).toHaveCount(0);           // one list at a time
  await expect(page.locator("#activeList")).toContainText("1 recipe");
  await page.evaluate(() => localStorage.setItem("cookfeed.userId", "1"));
  await page.goto("list.html?trip=1");
  expect(await textOf(page, "main")).toContain("no list of yours");
});

test.describe("on a 375px phone", () => {
  test.use({ viewport: { width: 375, height: 760 } });

  test("past lists stack as cards, with every button on the screen", async ({ page }) => {
    await page.clock.setFixedTime(IN_ALEXS_WEEK);
    await signInAs(page, ALEX);
    await page.goto("kitchen.html");
    await page.click("#shopWeek");
    await page.click("#openActiveList");
    await page.click("#sendFavor");
    await page.click("#confirmOk");
    await expect(page).toHaveURL(/kitchen\.html$/);
    const row = page.locator("#tripRows tr").first();
    expect(await row.evaluate((tr) => getComputedStyle(tr).display)).toBe("block");
    const buttons = row.locator("button, a");
    for (let i = 0; i < await buttons.count(); i = i + 1) {
      const box = await buttons.nth(i).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(375);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
