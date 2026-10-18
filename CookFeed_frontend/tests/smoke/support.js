/* Shared by the smoke specs: a test() that fails on any page or console error, signing in as a seeded
   account, and the small measurements several specs need. Every test gets a fresh browser context, so
   localStorage (the signed-in account and the prototype's data) never carries over between tests. */

const base = require("@playwright/test");

// The seeded accounts the specs sign in as (users.id in seed.sql).
const GUEST = null, ALEX = 1, PRIYA = 2, KENJI = 4, ADMIN = 6, SAM = 7;
const ACCOUNTS = { guest: GUEST, alex: ALEX, priya: PRIYA, kenji: KENJI, admin: ADMIN, sam: SAM };

// Every page address the prototype has, including the not-found cases.
const PAGES = [
  "index.html", "product.html?id=1", "product.html?id=2", "product.html?id=3", "product.html?id=4", "product.html?id=5",
  "product.html?id=99", "recipe.html?id=5", "recipe.html?id=6", "recipe.html?id=6&product=3",
  "recipe.html?id=9&product=4", "recipe.html?id=13", "recipe.html?id=14", "recipe.html?id=20",
  "recipe.html?id=99", "creator.html?handle=kenji-kitchen",
  "creator.html?handle=maria-cooks", "creator.html?handle=dan-meal-preps", "creator.html?handle=nobody",
  "reviews.html?product=3", "reviews.html?product=4", "cart.html", "orders.html", "kitchen.html",
  "help.html", "signin.html"
];

const test = base.test.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") { errors.push(message.text()); } });
    await use(page);
    base.expect(errors, "errors raised while the test ran").toEqual([]);
  }
});

/* Start from the database's seed, signed in as userId (null browses signed out). */
async function signInAs(page, userId) {
  await page.goto("signin.html");
  await page.evaluate((id) => {
    localStorage.clear();
    if (id !== null) { localStorage.setItem("cookfeed.userId", String(id)); }
  }, userId);
}

/* The src of every shown image that failed to load. */
function brokenImages(page) {
  return page.evaluate(() => [...document.images]
    .filter((image) => !image.hidden && (!image.complete || image.naturalWidth === 0))
    .map((image) => image.getAttribute("src")));
}

/* The WCAG contrast ratio of two computed colors, such as "rgb(194, 65, 12)". */
function contrast(first, second) {
  const luminance = (rgb) => {
    const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map((v) => v / 255)
      .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

/* Normalised visible text of the first element matching selector. */
async function textOf(page, selector) {
  return (await page.locator(selector).first().innerText()).replace(/\s+/g, " ").trim();
}

module.exports = { test, expect: base.expect, signInAs, brokenImages, contrast, textOf, PAGES, ACCOUNTS,
  GUEST, ALEX, PRIYA, KENJI, ADMIN, SAM };
