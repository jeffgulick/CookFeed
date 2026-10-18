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

  test("the menu is a hamburger at the top left, before the brand", async ({ page }) => {
    await signInAs(page, ALEX);
    await page.goto("index.html");
    const menu = await page.locator("#menuButton").boundingBox();
    const brand = await page.locator(".brand").boundingBox();
    expect(menu.x).toBeLessThan(brand.x);
    expect(menu.width).toBeGreaterThanOrEqual(44);
    await expect(page.locator("#menuButton")).toHaveAccessibleName("Menu");
    await page.click("#menuButton");
    await expect(page.locator("#menuButton")).toHaveAccessibleName("Close menu");
    await expect(page.locator("#navLinks")).toBeVisible();
  });

  for (const width of [320, 360, 375]) {
    test(`a full week and a full shopping list fit a ${width}px phone, and a recipe's name gets the row`, async ({ page }) => {
      await page.setViewportSize({ width, height: 760 });
      await page.clock.setFixedTime(new Date("2026-09-23T12:00:00"));
      await signInAs(page, ALEX);
      await page.goto("kitchen.html");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      await page.click("#shopWeek");
      await page.click("#openActiveList");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
      const name = await page.locator(".trip-item a").first().boundingBox();
      expect(name.width).toBeGreaterThan(width / 2);
      await page.click("#startShopping");
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }

  test("no form field has text under 16px, so a phone never zooms in and slides sideways", async ({ page }) => {
    await page.clock.setFixedTime(new Date("2026-09-23T12:00:00"));
    await signInAs(page, ALEX);
    const small = [];
    for (const address of ["kitchen.html", "recipe.html?id=5", "reviews.html?product=3", "recipes.html", "cart.html", "signin.html"]) {
      await page.goto(address);
      const found = await page.evaluate(() => [...document.querySelectorAll("input:not([type=checkbox]):not([type=radio]), select, textarea")]
        .filter((e) => e.getClientRects().length && parseFloat(getComputedStyle(e).fontSize) < 16).map((e) => e.id || e.className));
      found.forEach((f) => small.push(`${address}: ${f}`));
    }
    expect(small).toEqual([]);
  });

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
