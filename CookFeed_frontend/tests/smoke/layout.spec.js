/* Layout: every page fits a 375px phone, the phone nav is one row while closed, the plan's servings box
   starts "as published", and printing keeps only what is meant to be printed. */

const { test, expect, signInAs, ALEX, GUEST } = require("./support");

const PHONE_PAGES = ["index.html", "product.html?id=1", "product.html?id=3", "product.html?id=4",
  "recipe.html?id=5", "recipe.html?id=6", "creator.html?handle=dan-meal-preps", "creator.html?handle=kenji-kitchen",
  "reviews.html?product=3", "reviews.html?product=1", "cart.html", "orders.html", "kitchen.html", "help.html",
  "signin.html"];

test.describe("on a 375px phone", () => {
  test.use({ viewport: { width: 375, height: 760 } });

  for (const address of PHONE_PAGES) {
    test(`${address} is no wider than the screen`, async ({ page }) => {
      await signInAs(page, ALEX);
      await page.goto(address);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
    });
  }

  test("the nav is one row while the menu is closed", async ({ page }) => {
    await signInAs(page, ALEX);
    await page.goto("index.html");
    await expect(page.locator("#navLinks")).toBeHidden();
    const height = await page.locator(".nav").evaluate((nav) => nav.getBoundingClientRect().height);
    expect(height).toBeLessThan(70);
  });
});

test("a plan's servings box starts as published, and the first press starts at 2", async ({ page }) => {
  await signInAs(page, GUEST);
  await page.goto("product.html?id=3");
  await expect(page.locator("#servingsInput")).toHaveValue("");
  await expect(page.locator("#servingsReset")).toBeHidden();
  await page.click("#servingsUp");
  await expect(page.locator("#servingsInput")).toHaveValue("2");
  await expect(page.locator("#listHeading")).toContainText("for 2 people");
  await page.fill("#servingsInput", "");
  await expect(page.locator("#listHeading")).toContainText("as published");
  await expect(page.locator("#servingsError")).toHaveText("");
});

test.describe("printing", () => {
  test("a plan prints only its title and the shopping list", async ({ page }) => {
    await signInAs(page, GUEST);
    await page.goto("product.html?id=4");
    await page.emulateMedia({ media: "print" });
    const shown = await page.evaluate(() => [...document.querySelectorAll("main > *")]
      .filter((element) => getComputedStyle(element).display !== "none")
      .map((element) => element.tagName + (element.classList.contains("print-area") ? ".print-area" : "")));
    expect(shown).toEqual(["H1", "DIV.print-area"]);
    await expect(page.locator(".stepper-row")).toBeHidden();
  });

  test("a recipe still prints its method", async ({ page }) => {
    await signInAs(page, GUEST);
    await page.goto("recipe.html?id=5");
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("#stepList")).toBeVisible();
  });
});
