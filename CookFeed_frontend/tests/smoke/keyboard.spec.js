/* Keyboard and screen-reader basics: the phone menu, the skip link, a focus ring that can be seen, the
   confirmation dialog's focus handling, and the review form's labelled Yes/No group. */

const { test, expect, signInAs, contrast, ALEX, PRIYA } = require("./support");

test.beforeEach(async ({ page }) => { await signInAs(page, ALEX); });

test.describe("the phone menu", () => {
  test.use({ viewport: { width: 375, height: 760 } });

  test("opens with Enter, leads Tab to the links, and closes with Escape", async ({ page }) => {
    await page.goto("index.html");
    await page.focus("#menuButton");
    await page.keyboard.press("Enter");
    await expect(page.locator("#navLinks")).toBeVisible();
    await expect(page.locator("#menuButton")).toHaveAttribute("aria-expanded", "true");
    // The hamburger comes first, at the top left: Tab passes the brand and the cart, then reaches the links.
    for (const stop of ["Cookfeed", /^Cart/, "Discover"]) {
      await page.keyboard.press("Tab");
      await expect(page.locator(":focus")).toHaveText(stop);
    }
    await page.keyboard.press("Escape");
    await expect(page.locator("#navLinks")).toBeHidden();
    await expect(page.locator("#menuButton")).toBeFocused();
  });
});

test("the first Tab reaches a visible skip link that moves focus to the content", async ({ page }) => {
  await page.goto("help.html");
  await page.keyboard.press("Tab");
  await expect(page.locator(".skip-link")).toBeFocused();
  expect(await page.locator(".skip-link").evaluate((link) => link.getBoundingClientRect().top)).toBeGreaterThanOrEqual(0);
  await page.keyboard.press("Enter");
  await expect(page.locator("#main")).toBeFocused();
});

test("the focus ring is at least 3px and 3:1 against the page and a card", async ({ page }) => {
  await page.goto("recipe.html?id=16");
  const ring = await page.evaluate(() => {
    const button = document.getElementById("servingsUp");
    button.focus();
    const style = getComputedStyle(button);
    return {
      color: style.outlineColor,
      width: parseFloat(style.outlineWidth),
      paper: getComputedStyle(document.body).backgroundColor,
      card: getComputedStyle(document.querySelector(".card")).backgroundColor
    };
  });
  expect(ring.width).toBeGreaterThanOrEqual(3);
  expect(contrast(ring.color, ring.paper)).toBeGreaterThanOrEqual(3);
  expect(contrast(ring.color, ring.card)).toBeGreaterThanOrEqual(3);
});

test("the confirmation dialog focuses Cancel, backs out on Escape, and returns focus", async ({ page }) => {
  await signInAs(page, PRIYA);   // the seeded cart with something in it
  await page.goto("cart.html");
  await page.click(".remove-item");
  await expect(page.locator("#confirmDialog")).toBeVisible();
  await expect(page.locator("#confirmMessage")).toContainText("The Bread Box");
  await expect(page.locator("#confirmCancel")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.locator("#confirmDialog")).toBeHidden();
  await expect(page.locator(".line-item")).toHaveCount(1);
  await expect(page.locator(".remove-item")).toBeFocused();

  await page.click("#checkoutButton");
  await page.click("#confirmCancel");
  await expect(page.locator("#checkoutButton")).toBeVisible();
});

test("the review form's Yes/No question is a fieldset with a legend", async ({ page }) => {
  await page.goto("reviews.html?product=1");
  const isGroup = await page.locator("#recommendQuestion").evaluate((legend) =>
    legend.tagName === "LEGEND" && legend.parentElement.tagName === "FIELDSET");
  expect(isGroup).toBe(true);
});
