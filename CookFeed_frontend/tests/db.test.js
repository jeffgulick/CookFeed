/* The prototype's database (js/db.js): the seed's rows, plus a browser copy of the tables people change,
   kept in localStorage. Run with: node --test CookFeed_frontend/tests */

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadPrototype, MemoryStorage } = require("./load-prototype");

const ALEX = 1, PRIYA = 2, KENJI = 4, DAN = 5, ADMIN = 6, SAM = 7;
const ROMAN_PASTA = 1, BREAD_BOX = 2, JAPAN = 3, FAMILY_WEEK = 4, SUMMER_GRILLING = 5;
const TERIYAKI = 5, ONIGIRI = 6, OATS = 9, TACOS = 10, TAMAGOYAKI = 16;

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

test("a creator drafts a recipe, publishes it as premium, and sells it in a new plan (3.3, 3.8)", () => {
  const p = loadPrototype();
  const user = p.userById(KENJI);
  const recipe = p.createRecipe(KENJI, {
    title: "Yakitori", servings: 2, prepMinutes: 10, cookMinutes: 10, visibility: "ProductOnly",
    ingredients: [{ ingredientId: 19, unitId: 7, quantity: 400, preparation: "cubed" }], steps: ["Skewer.", "Grill."]
  });
  assert.equal(recipe.isPublished, false);
  assert.equal(p.canOpenRecipe(user, recipe), true);
  assert.equal(p.canOpenRecipe(p.userById(SAM), recipe), false);
  assert.equal(p.recipeWithDetails(recipe.id).ingredients.length, 1);
  assert.equal(p.recipeWithDetails(recipe.id).steps.length, 2);

  const plan = { type: "MealPlan", title: "Grill night", priceCents: 500, placements: [{ recipeId: recipe.id, dayOffset: 0, slot: "Dinner" }] };
  assert.notEqual(p.createProduct(KENJI, plan).problem, undefined);   // a draft cannot be sold
  p.setRecipePublished(recipe.id, true);
  const created = p.createProduct(KENJI, plan);
  assert.equal(created.problem, undefined);
  assert.equal(p.productWithRecipes(created.product.id).mealCount, 1);
  assert.equal(p.buyState(p.userById(SAM), created.product), "buy");
  assert.notEqual(p.setRecipeVisibility(recipe.id, "Public"), "");    // now in a plan
  assert.notEqual(p.createProduct(KENJI, { type: "RecipeCollection", title: "Free stuff", priceCents: 100,
    placements: [{ recipeId: TAMAGOYAKI }] }).problem, undefined);     // a free recipe cannot be sold
  p.setProductActive(created.product.id, false);
  assert.equal(p.buyState(p.userById(SAM), p.rowById("products", created.product.id)), "notForSale");
  // The browser copy keeps all of it across a reload.
  assert.equal(loadPrototype(p.localStorage).rowById("recipes", recipe.id).title, "Yakitori");
});

test("the admin hides a review, which leaves the count and rating, and nobody else can (3.8)", () => {
  const p = loadPrototype();
  assert.equal(p.reviewsFor(JAPAN).length, 3);
  assert.notEqual(p.setReviewHidden(ADMIN, 2, true), null);
  assert.equal(p.reviewsFor(JAPAN).length, 2);
  assert.equal(p.reviewsFor(JAPAN, true).length, 3);
  assert.equal(p.adminActions()[0].action, "HideReview");
  assert.equal(p.adminActions()[0].adminName, "Cookfeed Admin");
  assert.equal(p.setReviewHidden(SAM, 1, true), null);
  assert.equal(p.setCreatorSuspended(KENJI, DAN, true), null);
  assert.equal(p.reviewsFor(JAPAN).length, 2);
  p.setReviewHidden(ADMIN, 2, false);
  assert.equal(p.reviewsFor(JAPAN).length, 3);
});

test("a refund takes the plan back: no longer owned, its recipes locked (3.8)", () => {
  const p = loadPrototype();
  const alex = p.userById(ALEX);
  assert.equal(p.ownsProduct(alex, FAMILY_WEEK), true);
  assert.notEqual(p.setOrderStatus(ADMIN, 2, "Refunded", "Asked for a refund"), null);
  assert.equal(p.ownsProduct(alex, FAMILY_WEEK), false);
  assert.equal(p.canOpenRecipe(alex, p.rowById("recipes", OATS)), false);
  assert.equal(p.setOrderStatus(ADMIN, 2, "Paid"), null);        // no way back
  assert.equal(p.setOrderStatus(ADMIN, 3, "Refunded"), null);    // a cancelled order has no money to refund
  assert.equal(p.allOrders()[0].buyerName !== undefined, true);
});

test("weeks run Monday to Sunday and are named by their Monday (3.9)", () => {
  const p = loadPrototype();
  assert.equal(p.weekStartOf(new Date(2026, 9, 18)), "2026-10-12");   // a Sunday belongs to the week before
  assert.equal(p.weekStartOf(new Date(2026, 9, 19)), "2026-10-19");   // a Monday starts its own
  assert.equal(p.addDays("2026-10-19", 6), "2026-10-25");
  assert.equal(p.formatShortDate("2026-09-21"), "Sept 21");
});

test("Alex's seeded week holds four meals in calendar order, the teriyaki planned for 4 (Q7)", () => {
  const p = loadPrototype();
  const plan = p.planFor(ALEX, "2026-09-21");
  assert.equal(plan.name, "Week of Sept 21");
  assert.equal(plan.shoppedAt, null);
  const entries = p.planEntries(plan.id);
  assert.deepEqual(plain(entries.map((e) => e.title)), ["Five-Day Overnight Oats", "Chicken Teriyaki, the Real Way",
    "Weeknight Beef Tacos", "15-Minute Spaghetti Carbonara"]);
  assert.equal(entries[1].planned, 4);
  assert.equal(entries[1].servings, 2);
  assert.equal(p.plansFor(ALEX).length, 1);
  assert.equal(p.plansFor(SAM).length, 0);
});

test("the week's list scales each meal by its planned servings (Q8)", () => {
  const p = loadPrototype();
  const lines = p.weekRecipeLines(ALEX, "2026-09-21");
  assert.equal(lines.length, 4);
  assert.equal(lines.find((l) => l.recipeId === TERIYAKI).scale, 2);
  const list = p.buildShoppingList(lines, null);
  assert.equal(list.find((l) => l.name === "boneless chicken thigh").amount, 1000);   // 500 g written for 2, cooked for 4
  assert.equal(list.find((l) => l.name === "ground beef").amount, 500);              // tacos as written
  assert.equal(p.buildShoppingList([TERIYAKI], null).find((l) => l.name === "boneless chicken thigh").amount, 500);
});

test("a cook plans a recipe, a whole plan they bought, rescales, removes, and marks the week shopped (3.9)", () => {
  const p = loadPrototype();
  const week = "2026-10-19";
  assert.equal(p.planFor(ALEX, week), null);
  const entry = p.addPlanEntry(ALEX, week, TERIYAKI, "2026-10-20", "Dinner", 6);
  assert.notEqual(entry, null);
  assert.equal(p.planFor(ALEX, week).name, "Week of Oct 19");
  const added = p.addProductToPlan(ALEX, week, FAMILY_WEEK);
  assert.equal(added.length, 6);                                   // 5 recipes, 6 meals
  const entries = p.planEntries(p.planFor(ALEX, week).id);
  assert.equal(entries.length, 7);
  assert.deepEqual(plain(entries.filter((e) => e.recipeId === OATS).map((e) => e.plannedDate)), ["2026-10-19", "2026-10-22"]);
  assert.equal(entries[0].slot, "Breakfast");
  p.setEntryServings(entry.id, null);
  assert.equal(p.planEntries(p.planFor(ALEX, week).id).find((e) => e.id === entry.id).planned, 2);
  p.removePlanEntry(entry.id);
  assert.equal(p.planEntries(p.planFor(ALEX, week).id).length, 6);
  assert.notEqual(p.markWeekShopped(ALEX, week, true).shoppedAt, null);
  assert.notEqual(loadPrototype(p.localStorage).planFor(ALEX, week).shoppedAt, null);
  assert.equal(p.markWeekShopped(ALEX, week, false).shoppedAt, null);
});

test("only a recipe the cook may open can be planned, and a plan they did not buy cannot be added (3.3)", () => {
  const p = loadPrototype();
  assert.equal(p.addPlanEntry(SAM, "2026-10-19", ONIGIRI, "2026-10-19", "Dinner", null), null);
  assert.notEqual(p.addPlanEntry(SAM, "2026-10-19", TAMAGOYAKI, "2026-10-19", "Dinner", null), null);
  assert.equal(p.addProductToPlan(SAM, "2026-10-19", JAPAN), null);
  assert.equal(p.weekRecipeLines(SAM, "2026-10-19").length, 1);
});

test("a cook owns one entry per plan bought, with the purchase snapshot (3.3)", () => {
  const p = loadPrototype();
  const owned = p.ownedProductsFor(p.userById(ALEX));
  assert.deepEqual(plain(owned.map((o) => o.product.id).sort()), [1, 3, 4]);
  const roman = owned.find((o) => o.product.id === ROMAN_PASTA);
  assert.equal(roman.recipeCount, 4);          // the focaccia Maria later removed is still his
  assert.equal(owned.find((o) => o.product.id === FAMILY_WEEK).mealCount, 6);
  assert.equal(p.ownedProductsFor(p.userById(SAM)).length, 0);
  assert.equal(p.ownedProductsFor(null).length, 0);
});
