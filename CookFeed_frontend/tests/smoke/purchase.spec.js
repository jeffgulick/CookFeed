/* Sam, a home cook with no orders, buys Three Weeknights in Japan and everything that buying unlocks:
   the order, the ProductOnly recipe, its ingredients on the list, and the review form. Then Reset
   prototype data puts the seed back. */

const { test, expect, signInAs, textOf, SAM } = require("./support");

test("Sam buys a plan, opens what it unlocks, reviews it, and Reset restores the seed", async ({ page }) => {
  await signInAs(page, SAM);

  await test.step("add to cart", async () => {
    await page.goto("product.html?id=3");
    await page.click("#buyArea .buy-button");
    expect(await textOf(page, "#buyArea")).toMatch(/^In your cart/);
    await expect(page.locator("#cartCount")).toHaveText("1");
  });

  await test.step("check out through the confirmation dialog", async () => {
    await page.goto("cart.html");
    await page.click("#checkoutButton");
    await page.click("#confirmOk");
    await expect(page.locator("#cartArea")).toContainText("Order CF-00007");
    await expect(page.locator("#receiptHeading")).toBeFocused();
    await expect(page.locator("#cartCount")).toHaveText("0");
  });

  await test.step("the order and what it unlocks", async () => {
    await page.goto("orders.html");
    await expect(page.locator("#orderList")).toContainText("Three Weeknights in Japan");
    await page.goto("recipe.html?id=6&product=3");
    await expect(page.locator("#ownedNote")).toHaveText("Yours through Three Weeknights in Japan");
    await expect(page.locator("#recipeCrumb")).toContainText("Wednesday dinner");
    await page.goto("product.html?id=3");
    expect(await textOf(page, "#buyArea")).toContain("You own this plan");
    await expect(page.locator("#shoppingRows")).toContainText("salmon");
  });

  await test.step("review it, once, under the account name", async () => {
    await page.goto("reviews.html?product=3");
    await page.click("#starPicker .star[data-value='5']");
    await page.fill("#reviewComment", "Bought it tonight and the list was spot on.");
    await page.click("#postButton");
    await page.click("#confirmOk");
    await expect(page.locator("#reviewGate")).toBeVisible();
    await expect(page.locator("#reviewList .reviewer").first()).toHaveText("Sam Lee");
    await expect(page.locator("#reviewForm")).toBeHidden();
    await expect(page.locator(".remove-review")).toHaveCount(1);
  });

  await test.step("Reset prototype data restores the seed", async () => {
    await page.goto("signin.html");
    await page.click("#resetData");
    await page.click("#confirmOk");
    // The reset runs when the dialog's close event fires, a moment after the click. Leaving the page before then
    // would skip it, so wait for its confirmation first.
    await expect(page.locator("#toast")).toContainText("back to the database's seed");
    await page.goto("orders.html");
    await expect(page.locator(".order-card")).toHaveCount(0);
    await page.goto("reviews.html?product=3");
    await expect(page.locator("#reviewCount")).toHaveText("3");
  });
});
