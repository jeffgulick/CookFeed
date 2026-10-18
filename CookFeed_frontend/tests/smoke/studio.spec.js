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
  // A recipe in a plan cannot be made free (3.3): the button says why and does nothing.
  await expect(page.locator("#recipeRows tr", { hasText: "Chicken Teriyaki" }).locator("button[data-action='visibility']")).toBeDisabled();
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
    // A free recipe cannot be sold: its box is disabled with the reason.
    await expect(page.locator("#placementList .placement", { hasText: "Tamagoyaki" }).locator("input")).toBeDisabled();
    await expect(page.locator("#placementList .placement", { hasText: "Tamagoyaki" })).toContainText("free to save");
    const row = page.locator("#placementList .placement", { hasText: "Yakitori Skewers" });
    await row.locator("input").check();
    await row.locator(".place-day").selectOption("1");
    await row.locator(".place-slot").selectOption("Dinner");
    await page.click("#saveProduct");
    await expect(page.locator("#productRows tr", { hasText: "Grill Night" })).toContainText("For sale");
    await expect(page.locator("#productRows tr", { hasText: "Grill Night" })).toContainText("$5.00");
    await expect(page.locator("#statProducts")).toHaveText("2");
    // Now that it is sold, it cannot be made free.
    await expect(page.locator("#recipeRows tr", { hasText: "Yakitori Skewers" }).locator("button[data-action='visibility']")).toBeDisabled();
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
  expect(await textOf(page, "#placementError")).toMatch(/at least one recipe/);
});
