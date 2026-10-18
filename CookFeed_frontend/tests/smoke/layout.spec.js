/* Layout: every page fits a 375px phone, the phone nav is one row while closed, and printing keeps only
   what is meant to be printed. */

const { test, expect, signInAs, ALEX, GUEST } = require("./support");

const PHONE_PAGES = ["index.html", "product.html?id=1", "product.html?id=3", "product.html?id=4",
  "recipe.html?id=5", "recipe.html?id=6", "creator.html?handle=dan-meal-preps", "creator.html?handle=kenji-kitchen",
  "reviews.html?product=3", "reviews.html?product=1", "cart.html", "orders.html", "kitchen.html", "help.html",
  "signin.html", "plans.html", "recipes.html", "list.html"];

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

test.describe("printing", () => {
  test("a plan prints only its title and what you'll buy", async ({ page }) => {
    await signInAs(page, GUEST);
    await page.goto("product.html?id=4");
    await page.emulateMedia({ media: "print" });
    const shown = await page.evaluate(() => [...document.querySelectorAll("main > *")]
      .filter((element) => getComputedStyle(element).display !== "none")
      .map((element) => element.tagName + (element.classList.contains("print-area") ? ".print-area" : "")));
    expect(shown).toEqual(["H1", "SECTION.print-area"]);
    await expect(page.locator(".stepper-row")).toBeHidden();
  });

  test("a recipe still prints its method", async ({ page }) => {
    await signInAs(page, GUEST);
    await page.goto("recipe.html?id=16");
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("#stepList")).toBeVisible();
  });
});
