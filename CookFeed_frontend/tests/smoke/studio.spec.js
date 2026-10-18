/* My studio (design section 3.8): a creator drafts a recipe, publishes it as premium, sells it in a new
   meal plan, and retires the plan; what each step changes for a home cook is checked on the store. */

const { test, expect, signInAs, textOf, GUEST, KENJI, SAM } = require("./support");

test("the studio is only for creators", async ({ page }) => {
  await signInAs(page, GUEST);
  await page.goto("studio.html");
  await expect(page.locator("#studioArea .sign-in-to")).toHaveCount(1);
  await signInAs(page, SAM);
  await page.goto("studio.html");
  await expect(page.locator("#studioArea")).toContainText("Only creators have a studio");
});

test("Kenji's studio shows his recipes, plan, sales and reviews from the seed", async ({ page }) => {
  await signInAs(page, KENJI);
  await page.goto("studio.html");
  await expect(page.locator("#statRecipes")).toHaveText("5");          // teriyaki, onigiri, stir-fry, tamagoyaki, sunomono; the miso draft is not counted
  await expect(page.locator("#statProducts")).toHaveText("1");
  await expect(page.locator("#statSales")).toHaveText("3");            // Alex, Priya and Dan bought Three Weeknights
  await expect(page.locator("#statEarned")).toHaveText("$38.97");
  await expect(page.locator("#recipeRows tr")).toHaveCount(6);
  await expect(page.locator("#recipeRows tr", { hasText: "Miso Soup" })).toContainText("Draft");
  await expect(page.locator("#recipeRows tr", { hasText: "Onigiri" })).toContainText("Three Weeknights in Japan");
  // A recipe in a plan cannot be made free (3.3): in the editor, the one place access is set, Free is off.
  await page.locator("#recipeRows tr", { hasText: "Chicken Teriyaki" }).locator("button[data-action='edit']").click();
  await expect(page.locator("input[name='recipeVisibility'][value='Public']")).toBeDisabled();
  await page.click("#cancelRecipe");
  await expect(page.locator("#productRows tr")).toHaveCount(1);
  await expect(page.locator("#productRows")).toContainText("For sale");
  await expect(page.locator("#salesRows tr")).toHaveCount(3);
  await expect(page.locator("#studioReviews .review")).toHaveCount(3);
});

test("a creator drafts, publishes and sells a recipe, then retires the plan", async ({ page }) => {
  await signInAs(page, KENJI);
  await page.goto("studio.html");

  await test.step("draft a premium recipe", async () => {
    await page.click("#newRecipe");
    await page.fill("#recipeTitle", "Yakitori Skewers");
    await page.fill("#recipeServings", "2");
    await page.check("input[name='recipeVisibility'][value='ProductOnly']");
    await page.selectOption("#ingredientLines .line-ingredient", { label: "boneless chicken thigh" });
    await page.fill("#ingredientLines .line-quantity", "400");
    await page.selectOption("#ingredientLines .line-unit", { label: "g" });
    await page.fill("#recipeSteps", "Thread the chicken onto skewers.\nGrill, turning, and brush with tare.");
    await page.click("#saveRecipe");
    await expect(page.locator("#recipeRows tr", { hasText: "Yakitori Skewers" })).toContainText("Draft");
    await expect(page.locator("#recipeRows tr", { hasText: "Yakitori Skewers" })).toContainText("Premium");
  });

  await test.step("publish it", async () => {
    await page.locator("#recipeRows tr", { hasText: "Yakitori Skewers" }).locator("button[data-action='publish']").click();
    await page.click("#confirmOk");
    await expect(page.locator("#recipeRows tr", { hasText: "Yakitori Skewers" })).toContainText("Published");
    await expect(page.locator("#statRecipes")).toHaveText("6");
  });

  await test.step("sell it in a new meal plan", async () => {
    await page.click("#newProduct");
    await page.fill("#productTitle", "Grill Night");
    await page.fill("#productPrice", "5.00");
    // Only published premium recipes are offered: a free one is not in the list, and the hint says why.
    const row = page.locator("#placementList .meal-row").first();
    await expect(row.locator(".place-recipe option", { hasText: "Tamagoyaki" })).toHaveCount(0);
    await expect(page.locator("#placementHint")).toContainText("free or a draft");
    await row.locator(".place-recipe").selectOption({ label: "Yakitori Skewers" });
    await row.locator(".place-day").selectOption("1");
    await row.locator(".place-slot").selectOption("Dinner");
    await page.click("#saveProduct");
    await expect(page.locator("#productRows tr", { hasText: "Grill Night" })).toContainText("For sale");
    await expect(page.locator("#productRows tr", { hasText: "Grill Night" })).toContainText("$5.00");
    await expect(page.locator("#statProducts")).toHaveText("2");
    // Now that it is in a plan, it stays published, and the row says why.
    await expect(page.locator("#recipeRows tr", { hasText: "Yakitori Skewers" }).locator("button[data-action='publish']")).toBeDisabled();
    await expect(page.locator("#recipeRows tr", { hasText: "Yakitori Skewers" }).locator(".action-note")).toContainText("Grill Night");
  });

  await test.step("a home cook finds it on Discover and sees the locked recipe", async () => {
    await page.evaluate(() => localStorage.setItem("cookfeed.userId", "7"));
    await page.goto("index.html");
    await expect(page.locator(".product-tile", { hasText: "Grill Night" })).toBeVisible();
    await page.locator(".product-tile", { hasText: "Grill Night" }).click();
    await expect(page.locator("#productTitle")).toHaveText("Grill Night");
    await expect(page.locator(".recipe-card.locked", { hasText: "Yakitori Skewers" })).toContainText("Tuesday dinner");
    await expect(page.locator("#buyArea .buy-button")).toHaveCount(1);
  });

  await test.step("the creator retires it, and it leaves the store", async () => {
    await page.evaluate(() => localStorage.setItem("cookfeed.userId", "4"));
    await page.goto("studio.html");
    await page.locator("#productRows tr", { hasText: "Grill Night" }).locator("button[data-action='active']").click();
    await page.click("#confirmOk");
    await expect(page.locator("#productRows tr", { hasText: "Grill Night" })).toContainText("Retired");
    await page.evaluate(() => localStorage.setItem("cookfeed.userId", "7"));
    await page.goto("index.html");
    await expect(page.locator(".product-tile", { hasText: "Grill Night" })).toHaveCount(0);
  });
});

test("the form refuses an empty title and a plan with no recipes", async ({ page }) => {
  await signInAs(page, KENJI);
  await page.goto("studio.html");
  await page.click("#newRecipe");
  await page.click("#saveRecipe");
  expect(await textOf(page, "#recipeTitleError")).toMatch(/title/);
  await page.click("#cancelRecipe");
  await page.click("#newProduct");
  await page.fill("#productTitle", "Empty");
  await page.click("#saveProduct");
  expect(await textOf(page, "#placementError")).toMatch(/no recipe/);
  await page.locator("#placementList .remove-placement").click();
  await page.click("#saveProduct");
  expect(await textOf(page, "#placementError")).toMatch(/at least one recipe/);
});

test("saving a plan with no changes keeps every meal, repeats and order included", async ({ page }) => {
  await signInAs(page, 5);                                              // Dan
  await page.goto("studio.html");
  const before = await page.evaluate(() => JSON.stringify(productWithRecipes(4).recipes.map((r) => [r.recipeId, r.dayOffset, r.slot])));
  await page.locator("#productRows tr", { hasText: "Family Week" }).locator("button[data-action='edit']").click();
  await expect(page.locator("#placementList .meal-row")).toHaveCount(6);   // the oats on Monday and Thursday
  await page.fill("#productDescription", "A new description.");
  await page.click("#saveProduct");
  await expect(page.locator(".toast")).toContainText("updated");
  const after = await page.evaluate(() => JSON.stringify(productWithRecipes(4).recipes.map((r) => [r.recipeId, r.dayOffset, r.slot])));
  expect(after).toBe(before);
});

test("the plan form refuses a blank or huge price and two recipes on one meal, and says how to fix it", async ({ page }) => {
  await signInAs(page, KENJI);
  await page.goto("studio.html");
  await page.click("#newProduct");
  await page.fill("#productTitle", "Clash");
  await page.fill("#productPrice", "");
  await page.locator("#placementList .meal-row .place-recipe").selectOption({ label: "Onigiri Three Ways" });
  await page.click("#addPlacement");
  const second = page.locator("#placementList .meal-row").nth(1);
  await second.locator(".place-recipe").selectOption({ label: "Chicken Teriyaki, the Real Way" });
  await second.locator(".place-day").selectOption("0");
  await second.locator(".place-slot").selectOption("Dinner");
  await page.click("#saveProduct");
  expect(await textOf(page, "#productPriceError")).toMatch(/\$0\.99 to \$500/);
  expect(await textOf(page, "#placementError")).toMatch(/Monday dinner has two recipes/);
  await page.fill("#productPrice", "99999.99");
  await page.click("#saveProduct");
  expect(await textOf(page, "#productPriceError")).toMatch(/\$0\.99 to \$500/);
});

test("saving a recipe with no changes keeps how each ingredient was written", async ({ page }) => {
  await signInAs(page, KENJI);
  await page.goto("studio.html");
  const before = await page.evaluate(() => JSON.stringify(rowsWhere("recipeIngredients", (ri) => ri.recipeId === 5).map((ri) => [ri.displayText, ri.isOptional])));
  await page.locator("#recipeRows tr", { hasText: "Chicken Teriyaki" }).locator("button[data-action='edit']").click();
  await page.click("#saveRecipe");
  await expect(page.locator(".toast")).toContainText("updated");
  const after = await page.evaluate(() => JSON.stringify(rowsWhere("recipeIngredients", (ri) => ri.recipeId === 5).map((ri) => [ri.displayText, ri.isOptional])));
  expect(after).toBe(before);
});

test("the recipe form refuses an amount of 0, impossible times, a duplicate title, and emptying a published recipe", async ({ page }) => {
  await signInAs(page, KENJI);
  await page.goto("studio.html");
  await page.locator("#recipeRows tr", { hasText: "Tamagoyaki" }).locator("button[data-action='edit']").click();
  await page.locator("#ingredientLines .line-quantity").first().fill("0");
  await page.fill("#recipePrep", "-50");
  await page.click("#saveRecipe");
  expect(await textOf(page, "#recipeIngredientsError")).toMatch(/Line 1 needs an amount/);
  expect(await textOf(page, "#recipeTimeError")).toMatch(/whole minutes/);
  await page.locator("#ingredientLines .line-quantity").first().fill("3");
  await page.fill("#recipePrep", "5");
  await page.fill("#recipeTitle", "Onigiri Three Ways");
  await page.click("#saveRecipe");
  expect(await textOf(page, "#recipeTitleError")).toMatch(/already have a recipe called/);
  await page.fill("#recipeTitle", "Tamagoyaki");
  await page.fill("#recipeSteps", "");
  await page.click("#saveRecipe");
  expect(await textOf(page, "#recipeStepsError")).toMatch(/published recipe needs/);
});

test("a suspended creator sees why, and cannot put a new plan on sale", async ({ page }) => {
  await signInAs(page, KENJI);
  await page.evaluate(() => { setCreatorSuspended(6, 4, true); });
  await page.goto("studio.html");
  await expect(page.locator("#suspendedBanner")).toBeVisible();
  await page.click("#newProduct");
  await page.fill("#productTitle", "While suspended");
  await page.locator("#placementList .meal-row .place-recipe").selectOption({ label: "Onigiri Three Ways" });
  await page.click("#saveProduct");
  expect(await textOf(page, "#placementError")).toMatch(/suspended/);
});
