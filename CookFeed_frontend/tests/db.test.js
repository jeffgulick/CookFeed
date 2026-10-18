/* The prototype's database (js/db.js): the seed's rows, plus a browser copy of the tables people change,
   kept in localStorage. Run with: node --test CookFeed_frontend/tests */

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadPrototype, MemoryStorage } = require("./load-prototype");

const ALEX = 1, PRIYA = 2, KENJI = 4, SAM = 7;
const ROMAN_PASTA = 1, BREAD_BOX = 2, JAPAN = 3, FAMILY_WEEK = 4, SUMMER_GRILLING = 5;
const TERIYAKI = 5, ONIGIRI = 6, OATS = 9;

// Values made inside the sandbox have the sandbox's Array and Object; compare them as plain JSON.
const plain = (value) => JSON.parse(JSON.stringify(value));

test("an account carries its roles and, for a creator, its handle", () => {
  const p = loadPrototype();
  assert.deepEqual(plain(p.userById(ALEX)), { id: ALEX, displayName: "Alex Rivera", roles: ["HomeCook"], handle: null });
  assert.deepEqual(plain(p.userById(KENJI).roles), ["HomeCook", "Creator"]);
  assert.equal(p.userById(KENJI).handle, "kenji-kitchen");
  assert.equal(p.userById(999), null);
});

test("a product counts distinct recipes and, for a meal plan, its meals (Q5)", () => {
  const p = loadPrototype();
  const family = p.productWithRecipes(FAMILY_WEEK);
  assert.equal(family.recipeCount, 5);
  assert.equal(family.mealCount, 6);
  assert.deepEqual(plain(family.recipes.map((r) => r.recipeId)), [9, 10, 11, 9, 8, 12]);

  const pasta = p.productWithRecipes(ROMAN_PASTA);
  assert.equal(pasta.recipeCount, 3);
  assert.equal(pasta.mealCount, null);
  assert.equal(p.productWithRecipes(999), null);
});

test("a recipe links to the recipe template and carries its ingredients and steps", () => {
  const p = loadPrototype();
  const onigiri = p.recipeWithDetails(ONIGIRI);
  assert.equal(onigiri.pageUrl, "recipe.html?id=6");
  assert.equal(onigiri.ingredients.length, 8);
  assert.equal(onigiri.steps.length, 3);
  assert.equal(p.recipeWithDetails(999), null);
});

test("a creator is found by handle, with the display name joined in", () => {
  const p = loadPrototype();
  assert.equal(p.creatorByHandle("maria-cooks").displayName, "Maria Conti");
  assert.equal(p.creatorByHandle("nobody"), null);
});

test("save counts are the number of save rows, as the trigger keeps them (3.4)", () => {
  const p = loadPrototype();
  for (const recipe of p.COOKFEED_SEED.recipes) {
    assert.equal(p.saveCount(recipe.id), recipe.saveCount, recipe.title);
  }
});

test("saving and unsaving move the count by one, and saving twice keeps one row", () => {
  const p = loadPrototype();
  const before = p.saveCount(TERIYAKI);
  assert.equal(p.isSavedBy(PRIYA, TERIYAKI), true);           // seeded save
  assert.equal(p.isSavedBy(KENJI, TERIYAKI), false);

  p.setSaved(KENJI, TERIYAKI, true);
  p.setSaved(KENJI, TERIYAKI, true);
  assert.equal(p.saveCount(TERIYAKI), before + 1);

  p.setSaved(KENJI, TERIYAKI, false);
  assert.equal(p.saveCount(TERIYAKI), before);
});

test("an account's saves come newest first", () => {
  const p = loadPrototype();
  const dates = p.savesFor(ALEX).map((s) => s.savedAt);
  assert.equal(dates.length, 6);
  assert.deepEqual(plain(dates), plain([...dates].sort().reverse()));
});

test("the cart holds one copy of each plan, starting from the seed", () => {
  const p = loadPrototype();
  assert.deepEqual(plain(p.cartFor(PRIYA).map((c) => c.productId)), [BREAD_BOX]);
  assert.equal(p.addToCart(PRIYA, BREAD_BOX), false);
  assert.equal(p.cartFor(ALEX).length, 0);
  assert.equal(p.addToCart(SAM, JAPAN), true);
  assert.equal(p.addToCart(SAM, JAPAN), false);
  assert.equal(p.cartFor(SAM).length, 1);

  p.removeFromCart(SAM, JAPAN);
  assert.equal(p.cartFor(SAM).length, 0);
});

test("checkout writes the order, its lines and the recipe snapshot, then empties the cart (3.3)", () => {
  const p = loadPrototype();
  p.addToCart(SAM, FAMILY_WEEK);
  p.addToCart(SAM, JAPAN);

  const order = p.placeOrder(SAM);

  assert.equal(order.id, 7);                                   // after the six seeded orders
  assert.equal(order.status, "Paid");
  assert.equal(order.totalCents, 999 + 1299);
  assert.deepEqual(plain(order.items.map((i) => [i.productId, i.creatorId, i.unitPriceCents])),
    [[FAMILY_WEEK, 5, 999], [JAPAN, 4, 1299]]);
  assert.equal(order.items[0].productTitle, "Family Week on a Budget");

  // Family Week's six meals are copied with their days and slots: the oats twice.
  const snapshot = order.items[0].recipes;
  assert.equal(snapshot.length, 6);
  assert.deepEqual(plain(snapshot.filter((r) => r.recipeId === OATS).map((r) => [r.dayOffset, r.slot])),
    [[0, "Breakfast"], [3, "Breakfast"]]);

  assert.equal(p.cartFor(SAM).length, 0);
  assert.equal(p.ordersFor(SAM)[0].id, 7);
});

test("checkout with an empty cart places nothing", () => {
  const p = loadPrototype();
  assert.equal(p.placeOrder(SAM), null);
  assert.equal(p.ordersFor(SAM).length, 0);
});

test("an account's orders come newest first, cancelled ones included", () => {
  const p = loadPrototype();
  const orders = p.ordersFor(ALEX);
  assert.deepEqual(plain(orders.map((o) => [o.id, o.status])), [[3, "Cancelled"], [2, "Paid"], [1, "Paid"]]);
  assert.deepEqual(plain(orders[2].items.map((i) => i.productTitle)), ["Roman Pasta Collection", "Three Weeknights in Japan"]);
});

test("reviews come newest first under the account's name", () => {
  const p = loadPrototype();
  const reviews = p.reviewsFor(JAPAN);
  assert.deepEqual(plain(reviews.map((r) => r.reviewerName)), ["Alex Rivera", "Priya Shah", "Dan Okafor"]);
  assert.equal(p.reviewBy(PRIYA, JAPAN).rating, 4);
  assert.equal(p.reviewBy(SAM, JAPAN), null);
});

test("a review is added once per account and product, and only its author removes it", () => {
  const p = loadPrototype();
  const review = p.addReview(PRIYA, FAMILY_WEEK, 5, true, "Six breakfasts and dinners from one shop.");
  assert.equal(review.reviewerName, "Priya Shah");
  assert.equal(p.reviewsFor(FAMILY_WEEK)[0].id, review.id);
  assert.equal(p.addReview(PRIYA, FAMILY_WEEK, 3, false, "A second review of the same plan."), null);

  assert.equal(p.removeReview(SAM, review.id), false);
  assert.equal(p.removeReview(PRIYA, review.id), true);
  assert.equal(p.reviewsFor(FAMILY_WEEK).length, 0);
});

test("changes survive a reload, and Reset puts the seed back", () => {
  const storage = new MemoryStorage();
  loadPrototype(storage).addToCart(SAM, JAPAN);

  const reloaded = loadPrototype(storage);
  assert.equal(reloaded.cartFor(SAM).length, 1);

  reloaded.resetDb();
  assert.equal(reloaded.cartFor(SAM).length, 0);
  assert.equal(loadPrototype(storage).cartFor(SAM).length, 0);
});

test("a browser copy made from a different seed is replaced by the current one", () => {
  const storage = new MemoryStorage();
  loadPrototype(storage).addToCart(SAM, JAPAN);
  const stored = JSON.parse(storage.getItem("cookfeed.db"));
  stored.seedFingerprint = "an older seed";
  storage.setItem("cookfeed.db", JSON.stringify(stored));

  assert.equal(loadPrototype(storage).cartFor(SAM).length, 0);
});

test("the Homework 3 storage keys are cleared, since nothing reads them any more", () => {
  const storage = new MemoryStorage();
  for (const key of ["cookfeed.cart", "cookfeed.saves", "cookfeed.reviews", "cookfeed.orders"]) {
    storage.setItem(key, "[]");
  }
  loadPrototype(storage).cartFor(SAM);

  assert.deepEqual([...storage.items.keys()], ["cookfeed.db"]);
});

test("an inactive product cannot be added to a cart", () => {
  const p = loadPrototype();
  assert.equal(p.addToCart(SAM, SUMMER_GRILLING), false);
});
