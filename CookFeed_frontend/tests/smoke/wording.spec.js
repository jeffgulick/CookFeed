/* Wording and accessibility on every page: headings in order, text that reads at 4.5:1, controls that say
   what they do, one name for each thing, no promises the site does not keep, and no text for people it does
   not apply to. */

const { test, expect, signInAs, contrast, textOf, PAGES, GUEST, ALEX, PRIYA, KENJI, ADMIN, SAM } = require("./support");

const AS = { guest: GUEST, alex: ALEX, kenji: KENJI, admin: ADMIN };

for (const [name, id] of Object.entries(AS)) {
  test(`as ${name}, every page's headings start at h1 and never skip a level`, async ({ page }) => {
    await signInAs(page, id);
    const skips = [];
    for (const address of PAGES) {
      await page.goto(address);
      const levels = await page.evaluate(() => [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")]
        .filter((h) => h.closest("dialog") === null && h.getClientRects().length > 0)
        .map((h) => Number(h.tagName[1])));
      levels.forEach((level, i) => {
        const before = i === 0 ? 0 : levels[i - 1];
        if (level > before + 1) { skips.push(`${address}: h${before} then h${level}`); }
      });
    }
    expect(skips).toEqual([]);
  });

  test(`as ${name}, no page promises a list ready to print, calls the list a trip, or has a bare Remove`, async ({ page }) => {
    await signInAs(page, id);
    const found = [];
    for (const address of PAGES) {
      await page.goto(address);
      const text = await page.locator("body").innerText();
      for (const phrase of [/ready to print/i, /one shopping list/i, /shopping trip/i]) {
        if (phrase.test(text)) { found.push(`${address}: ${phrase}`); }
      }
      const bare = await page.locator("button:visible", { hasText: /^\s*Remove\s*$/ }).count();
      if (bare) { found.push(`${address}: ${bare} button(s) that only say Remove`); }
    }
    expect(found).toEqual([]);
  });
}

test("star ratings and small muted tags read at 4.5:1", async ({ page }) => {
  await signInAs(page, ALEX);
  await page.goto("reviews.html?product=3");
  const colors = await page.evaluate(() => {
    const look = (el) => {
      let node = el;
      let bg = "rgba(0, 0, 0, 0)";
      while (node && (bg === "rgba(0, 0, 0, 0)" || bg === "transparent")) { bg = getComputedStyle(node).backgroundColor; node = node.parentElement; }
      return { fg: getComputedStyle(el).color, bg };
    };
    return { stars: look(document.querySelector(".review .stars")), tag: look(document.querySelector(".tag-muted, .review .tag")) };
  });
  expect(contrast(colors.stars.fg, colors.stars.bg)).toBeGreaterThanOrEqual(4.5);
  await page.goto("kitchen.html");
  await page.evaluate(() => { const t = document.createElement("span"); t.className = "tag tag-muted"; t.id = "probe"; t.textContent = "Done"; document.querySelector("main").appendChild(t); });
  const tag = await page.locator("#probe").evaluate((el) => ({ fg: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor }));
  expect(contrast(tag.fg, tag.bg)).toBeGreaterThanOrEqual(4.5);
});

test("the Plans filters say which one is on", async ({ page }) => {
  await signInAs(page, GUEST);
  await page.goto("plans.html");
  const filters = page.locator("[data-type]");
  for (let i = 0; i < await filters.count(); i = i + 1) {
    await expect(filters.nth(i)).toHaveAttribute("aria-pressed", /^(true|false)$/);
  }
  await expect(page.locator("[data-type][aria-pressed='true']")).toHaveCount(1);
  await page.click("[data-type='MealPlan']");
  await expect(page.locator("[data-type='MealPlan']")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("[data-type='all']")).toHaveAttribute("aria-pressed", "false");
});

test("the video's play control is a real button that starts at the first step", async ({ page }) => {
  await signInAs(page, GUEST);
  await page.goto("recipe.html?id=16");
  const play = page.getByRole("button", { name: "Play the video" });
  await expect(play).toBeVisible();
  await play.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".step.playing")).toHaveCount(1);
  await expect(page.locator(".step").first()).toHaveClass(/playing/);
});

test("a plan with no reviews says so, instead of showing zero stars", async ({ page }) => {
  await signInAs(page, GUEST);
  await page.goto("reviews.html?product=4");
  await expect(page.locator("main")).toContainText("No reviews yet");
  await expect(page.locator("main")).not.toContainText("0.0");
  await expect(page.locator("main")).not.toContainText("0% would recommend");
});

test("a locked recipe says what applies: where to get it, or that it is no longer sold, and nothing about buying to the admin", async ({ page }) => {
  await signInAs(page, SAM);
  await page.goto("recipe.html?id=6");                                   // Onigiri, in Three Weeknights in Japan
  await expect(page.locator("main a", { hasText: "Three Weeknights in Japan" })).toHaveCount(1);
  await signInAs(page, ADMIN);
  await page.evaluate(() => adminSetProductActive(6, 2, false));        // retire The Bread Box
  await page.goto("recipe.html?id=6");
  expect(await textOf(page, "main")).not.toMatch(/bought|buy/i);
  await page.evaluate(() => localStorage.setItem("cookfeed.userId", "7"));
  await page.goto("recipe.html?id=20");                                  // Rosemary Ciabatta: only in The Bread Box
  await expect(page.locator("main")).toContainText("no longer for sale");
  await expect(page.locator("main a", { hasText: /recipes|plans/i }).first()).toBeVisible();
});

test("text is not shown to people it does not apply to", async ({ page }) => {
  await signInAs(page, ADMIN);
  await page.goto("recipe.html?id=18");
  expect(await textOf(page, "main")).not.toMatch(/Saving keeps|Shop this recipe/);
  await signInAs(page, GUEST);
  await page.goto("recipe.html?id=18");
  expect(await textOf(page, "main")).not.toMatch(/Shop this recipe|Add to my week/);
  await page.goto("index.html");
  expect(await textOf(page, "footer")).not.toMatch(/shopping list/i);
  await signInAs(page, PRIYA);
  await page.goto("cart.html");
  await expect(page.locator(".line-item button", { hasText: "Take out of cart" })).toHaveCount(1);
});

test("the kitchen names the week once, and its shop button says which meals", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-10-18T12:00:00"));
  await signInAs(page, ALEX);
  await page.goto("kitchen.html");
  await expect(page.locator("main h2").first()).toHaveText("This week");
  await expect(page.locator("#weekLabel")).toHaveCount(1);
  await expect(page.locator("main h3", { hasText: "This week" })).toHaveCount(0);
  await page.click("#otherWeekLink");
  await expect(page.locator("main h2").first()).toHaveText("Week of Sept 21, 2026 (past)");
  await expect(page.locator("#shopWeek")).toHaveText("Shop these meals");
  await page.click("#backToThisWeek");
  await expect(page.locator("#shopWeek")).toHaveText("Shop this week");
});
