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

test("a cook plans a recipe and a whole plan they bought onto a week, rescales and removes (3.9)", () => {
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
  assert.equal(loadPrototype(p.localStorage).planEntries(p.planFor(ALEX, week).id).length, 6);
});

test("a shopping trip is built from any recipes and plans, scaled, shopped, and kept across a reload (3.9)", () => {
  const p = loadPrototype();
  assert.equal(p.tripsFor(ALEX).length, 0);
  const trip = p.createTrip(ALEX, "Taco night", [{ recipeId: TACOS, servings: 8 }, { recipeId: ONIGIRI, servings: 0 }]);
  assert.equal(p.tripItems(trip.id).length, 2);
  assert.equal(p.tripItems(trip.id)[1].servings, 4);                 // 0 means as written
  // One row per recipe: the plan's tacos are already on the trip, and its oats on two mornings become one
  // item for both mornings (twice the people it is written for). Adding the plan again adds nothing, and so
  // does the same recipe again.
  assert.equal(p.addProductToTrip(trip.id, FAMILY_WEEK).length, 4);
  assert.equal(p.tripItems(trip.id).length, 6);
  assert.equal(p.tripItems(trip.id).find((i) => i.recipeId === OATS).servings, 2 * p.recipeWithDetails(OATS).servings);
  assert.equal(p.addProductToTrip(trip.id, FAMILY_WEEK).length, 0);
  assert.equal(p.addTripItems(trip.id, [{ recipeId: TACOS, servings: 2 }]).length, 0);
  assert.equal(p.tripHasRecipe(trip.id, TACOS), true);
  assert.deepEqual(plain(p.tripMissingFromProduct(trip.id, p.userById(ALEX), FAMILY_WEEK)), []);
  const list = p.buildShoppingList(p.tripRecipeLines(trip.id), null);
  assert.equal(list.find((l) => l.name === "ground beef").amount, 1000);   // 500 g for 4, cooked for 8
  assert.equal(trip.status, "Building");
  assert.equal(p.tripEditable(trip), true);
  // Already have the beef: it leaves the list to buy, and can come back.
  p.setTripSkip(trip.id, list.find((l) => l.name === "ground beef").ingredientId, true);
  assert.equal(p.tripList(trip.id).lines.some((l) => l.name === "ground beef"), false);
  assert.equal(p.tripList(trip.id).skipped.length, 1);
  p.setTripSkip(trip.id, list.find((l) => l.name === "ground beef").ingredientId, false);
  assert.equal(p.tripList(trip.id).skipped.length, 0);
  assert.equal(p.setTripStatus(trip.id, "Shopping").status, "Shopping");
  assert.equal(p.tripEditable(p.tripById(trip.id)), true);
  p.setTripSkip(trip.id, list.find((l) => l.name === "ground beef").ingredientId, true);
  assert.equal(p.setTripStatus(trip.id, "Sent", "Instacart").sentTo, "Instacart");
  // A sent list is read-only: the partner is shopping it.
  assert.equal(p.tripEditable(p.tripById(trip.id)), false);
  assert.equal(p.setTripSkip(trip.id, list.find((l) => l.name === "ground beef").ingredientId, false), false);
  assert.deepEqual(plain(p.addTripItems(trip.id, [{ recipeId: TAMAGOYAKI, servings: 2 }])), []);
  assert.notEqual(p.setTripStatus(trip.id, "Done").completedAt, null);
  // A done trip refuses every change to its items and skips.
  assert.equal(p.removeTripItem(p.tripItems(trip.id)[0].id), false);
  assert.equal(p.setTripItemServings(p.tripItems(trip.id)[0].id, 3), null);
  assert.equal(p.setTripSkip(trip.id, list.find((l) => l.name === "ground beef").ingredientId, false), false);
  assert.deepEqual(plain(p.addTripItems(trip.id, [{ recipeId: TAMAGOYAKI, servings: 2 }])), []);
  assert.equal(p.tripItems(trip.id).length, 6);
  assert.equal(p.tripEditable(p.tripById(trip.id)), false);
  assert.equal(loadPrototype(p.localStorage).tripById(trip.id).status, "Done");
  assert.equal(p.setTripStatus(trip.id, "Lost"), null);
  // Shopped again: a fresh Building trip with the same recipes and people; the done one stays as history.
  const again = p.copyTrip(trip.id, "2026-10-18");
  assert.equal(again.status, "Building");
  assert.equal(again.name, "Shopping list, Oct 18");               // named by date, never "again again"
  // One list at a time: while one is still being built or shopped, nothing can be shopped again.
  assert.equal(p.canShopAgain(p.tripById(trip.id)), false);
  assert.equal(p.copyTrip(trip.id, "2026-10-18"), null);
  assert.equal(p.tripItems(again.id).length, 6);
  assert.equal(p.tripItems(again.id).find((i) => i.recipeId === TACOS).servings, 8);
  assert.equal(p.tripList(again.id).skipped.length, 1);
  assert.equal(p.tripById(trip.id).status, "Done");
  assert.equal(p.tripsFor(ALEX).length, 2);
  p.setTripStatus(again.id, "Sent", "Favor");
  assert.equal(p.canShopAgain(p.tripById(trip.id)), true);
  p.deleteTrip(again.id);
  p.removeTripItem(p.tripItems(again.id)[0] ? p.tripItems(again.id)[0].id : 0);
  p.deleteTrip(trip.id);
  assert.equal(p.tripsFor(ALEX).length, 0);
  assert.equal(p.tripItems(trip.id).length, 0);
});

test("a planned week goes on the shopping list for the people each meal was planned for; nothing the cook may not open joins (3.9)", () => {
  const p = loadPrototype();
  const shopped = p.shopWeek(ALEX, "2026-09-21", "2026-09-23");
  const trip = shopped.trip;
  assert.equal(trip.name, "Shopping list, Sept 23");
  assert.equal(shopped.added.length, 4);
  assert.equal(p.tripItems(trip.id).find((i) => i.recipeId === TERIYAKI).servings, 4);
  assert.equal(p.buildShoppingList(p.tripRecipeLines(trip.id), null).find((l) => l.name === "boneless chicken thigh").amount, 1000);
  assert.equal(p.shopWeek(SAM, "2026-09-21", "2026-09-23"), null);
  const sams = p.createTrip(SAM, "Try", [{ recipeId: ONIGIRI, servings: 2 }, { recipeId: TAMAGOYAKI, servings: 2 }]);
  assert.equal(p.tripItems(sams.id).length, 1);
  assert.equal(p.addProductToTrip(sams.id, JAPAN).length, 0);
});

test("one shopping list at a time: Shop this adds straight to it, makes it when there is none, and can be undone (3.9)", () => {
  const p = loadPrototype();
  assert.equal(p.activeListFor(ALEX), null);
  const first = p.shopRecipes(ALEX, [{ recipeId: TACOS, servings: 8 }], "2026-10-18");
  assert.equal(first.created, true);
  assert.equal(first.trip.name, "Shopping list, Oct 18");
  assert.equal(first.added.length, 1);
  assert.equal(p.activeListFor(ALEX).id, first.trip.id);
  // A plan joins the same list; its tacos are on it already, and its oats on two mornings become one item.
  const plan = p.shopProduct(ALEX, FAMILY_WEEK, "2026-10-18");
  assert.equal(plan.trip.id, first.trip.id);
  assert.equal(plan.created, false);
  assert.equal(plan.added.length, 4);
  assert.equal(p.tripItems(first.trip.id).find((i) => i.recipeId === OATS).servings, 2 * p.recipeWithDetails(OATS).servings);
  assert.equal(p.shopProduct(ALEX, FAMILY_WEEK, "2026-10-18").added.length, 0);
  // Undo takes off exactly what that press added; undoing the press that made the list deletes it.
  p.undoShop(plan);
  assert.deepEqual(plain(p.tripItems(first.trip.id).map((i) => i.recipeId)), [TACOS]);
  p.undoShop(first);
  assert.equal(p.tripsFor(ALEX).length, 0);
  // Nothing the cook may not open is shopped, and no empty list is left behind.
  assert.equal(p.shopRecipes(SAM, [{ recipeId: ONIGIRI, servings: 2 }], "2026-10-18"), null);
  assert.equal(p.shopProduct(SAM, JAPAN, "2026-10-18"), null);
  assert.equal(p.tripsFor(SAM).length, 0);
  // A sent list is no longer the one being built: the next Shop this starts a new list.
  p.shopRecipes(ALEX, [{ recipeId: TACOS, servings: 4 }], "2026-10-18");
  p.setTripStatus(p.activeListFor(ALEX).id, "Sent", "Instacart");
  assert.equal(p.activeListFor(ALEX), null);
  assert.equal(p.shopRecipes(ALEX, [{ recipeId: TACOS, servings: 4 }], "2026-10-19").trip.name, "Shopping list, Oct 19");
  assert.equal(p.tripsFor(ALEX).length, 2);
});

test("Shop this plan buys what the cook's purchase holds, not the plan as it is now (3.3)", () => {
  const p = loadPrototype();
  // Maria took the focaccia out of Roman Pasta after Alex bought it; it is still his, and still on his list.
  assert.equal(p.productWithRecipes(ROMAN_PASTA).recipes.length, 3);
  const shopped = p.shopProduct(ALEX, ROMAN_PASTA, "2026-10-18");
  assert.deepEqual(plain(p.tripItems(shopped.trip.id).map((i) => i.recipeId).sort()), [1, 2, 3, 4]);
});

test("weeks are named for the cook: this week, next week, or a dated week marked past (3.9)", () => {
  const p = loadPrototype();
  const today = "2026-10-18";                                       // a Sunday, in the week of Oct 12
  assert.equal(p.weekLabel("2026-10-12", today), "This week");
  assert.equal(p.weekLabel("2026-10-19", today), "Next week");
  assert.equal(p.weekLabel("2026-09-21", today), "Week of Sept 21, 2026 (past)");
  assert.equal(p.weekLabel("2026-11-02", today), "Week of Nov 2, 2026");
  // This week is empty: point to the week that has meals, an upcoming one before a past one.
  assert.equal(p.otherPlannedWeek(ALEX, today), "2026-09-21");
  p.addPlanEntry(ALEX, "2026-10-26", TERIYAKI, "2026-10-27", "Dinner", null);
  assert.equal(p.otherPlannedWeek(ALEX, today), "2026-10-26");
  assert.equal(p.otherPlannedWeek(ALEX, "2026-09-23"), null);         // this week already has meals
  assert.equal(p.otherPlannedWeek(SAM, today), null);
  // A whole plan goes on this week early in the week, and on next week from Friday on.
  assert.equal(p.defaultPlanWeek("2026-10-14"), "2026-10-12");      // Wednesday
  assert.equal(p.defaultPlanWeek("2026-10-16"), "2026-10-19");      // Friday
  assert.equal(p.defaultPlanWeek(today), "2026-10-19");
  // The days a single recipe can go on: from today, two weeks ahead.
  const days = p.upcomingDays(today, 14);
  assert.equal(days.length, 14);
  assert.equal(days[0], "2026-10-18");
  assert.equal(days[13], "2026-10-31");
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

test("moderation holds: a hidden review cannot be removed and posted again, and buyers keep a recipe the admin took down (3.3, 3.8)", () => {
  const p = loadPrototype();
  const alex = p.userById(ALEX);
  const review = p.reviewBy(ALEX, JAPAN);
  p.setReviewHidden(ADMIN, review.id, true);
  assert.equal(p.removeReview(ALEX, review.id), false);
  assert.equal(p.reviewState(alex, JAPAN), "alreadyReviewed");
  assert.equal(p.addReview(ALEX, JAPAN, 5, true, "Trying to post it again after it was hidden."), null);

  assert.equal(p.adminSetRecipePublished(ADMIN, TERIYAKI, false), "");
  const teriyaki = p.rowById("recipes", TERIYAKI);
  assert.equal(p.canOpenRecipe(alex, teriyaki), true);              // through his Three Weeknights snapshot
  assert.equal(p.canPlan(alex, teriyaki), true);
  assert.equal(p.canOpenRecipe(p.userById(SAM), teriyaki), false);
  assert.equal(p.canSave(p.userById(SAM), teriyaki), false);
  assert.equal(p.canOpenRecipe(null, teriyaki), false);
  assert.equal(p.isForSale(p.rowById("products", JAPAN)), false);
});

test("data safety: a stale copy refuses to write, ids are never reused, and the writes refuse what the rules refuse", () => {
  // Two tabs read the data; the second saves first. The first tab's write is refused, not saved over it.
  const first = loadPrototype();
  first.db();
  const second = loadPrototype(first.localStorage);
  second.createTrip(ALEX, "Saved in the second tab", []);
  assert.equal(first.commit(), false);
  assert.equal(loadPrototype(first.localStorage).tripsFor(ALEX)[0].name, "Saved in the second tab");

  // A deleted trip's id is not handed out again.
  const q = loadPrototype();
  const gone = q.createTrip(ALEX, "Gone", []);
  q.deleteTrip(gone.id);
  assert.equal(q.createTrip(ALEX, "Next", []).id, gone.id + 1);

  // People: whole numbers from 1 to 50.
  assert.equal(q.peopleProblem("25"), "");
  assert.match(q.peopleProblem("51"), /between 1 and 50/);
  assert.match(q.peopleProblem("2.5"), /whole number/);
  assert.match(q.peopleProblem(""), /how many people/);
  assert.match(q.peopleProblem("1e1"), /whole number/);
  const trip = q.createTrip(ALEX, "People", [{ recipeId: TAMAGOYAKI, servings: 999 }, { recipeId: TACOS, servings: 3 }]);
  assert.deepEqual(plain(q.tripItems(trip.id).map((i) => [i.recipeId, i.servings])), [[TACOS, 3]]);
  assert.equal(q.setTripItemServings(q.tripItems(trip.id)[0].id, 2.5), null);

  // The week takes a recipe once per day and meal, and a whole plan once.
  const week = "2026-11-02";
  assert.notEqual(q.addPlanEntry(ALEX, week, TERIYAKI, week, "Dinner", null), null);
  assert.equal(q.addPlanEntry(ALEX, week, TERIYAKI, week, "Dinner", null), null);
  assert.equal(q.addProductToPlan(ALEX, week, FAMILY_WEEK).length, 6);
  assert.equal(q.addProductToPlan(ALEX, week, FAMILY_WEEK).length, 0);
  assert.equal(q.productOnWeek(ALEX, week, FAMILY_WEEK), true);

  // Cart, saves and reviews: the data layer refuses the admin, an owner, a creator's own plan and a locked recipe.
  assert.equal(q.addToCart(ADMIN, ROMAN_PASTA), false);
  assert.equal(q.addToCart(ALEX, FAMILY_WEEK), false);           // already his
  assert.equal(q.addToCart(DAN, FAMILY_WEEK), false);            // his own plan
  assert.equal(q.addToCart(SAM, SUMMER_GRILLING), false);        // retired
  assert.equal(q.addToCart(SAM, FAMILY_WEEK), true);
  q.setSaved(SAM, ONIGIRI, true);                                // premium, not his
  assert.equal(q.isSavedBy(SAM, ONIGIRI), false);
  assert.equal(q.addReview(SAM, FAMILY_WEEK, 5, true, "I never bought this plan at all."), null);
});

test("access and moderation: sold recipes stay published, the admin's take-downs stay down, and only owners' reviews count (3.3, 3.5, 3.8)", () => {
  const p = loadPrototype();
  // In a plan and bought: the creator cannot unpublish it.
  assert.match(p.setRecipePublished(TERIYAKI, false), /Three Weeknights in Japan/);
  assert.equal(p.rowById("recipes", TERIYAKI).isPublished, true);
  // The admin can take it down; the plan stops selling and the creator cannot put it back.
  assert.equal(p.adminSetRecipePublished(ADMIN, TERIYAKI, false), "");
  assert.equal(p.isForSale(p.rowById("products", JAPAN)), false);
  assert.match(p.setRecipePublished(TERIYAKI, true), /Cookfeed took/);
  assert.equal(p.adminSetRecipePublished(ADMIN, TERIYAKI, true), "");
  assert.equal(p.isForSale(p.rowById("products", JAPAN)), true);
  // The admin never publishes a creator's draft.
  assert.match(p.adminSetRecipePublished(ADMIN, 13, true), /Only its creator/);
  // A plan with no recipes, or one the admin retired, does not go back on sale from the studio.
  assert.match(p.adminSetProductActive(ADMIN, SUMMER_GRILLING, true), /no recipes/);
  assert.equal(p.adminSetProductActive(ADMIN, JAPAN, false), "");
  assert.match(p.setProductActive(JAPAN, true), /Cookfeed retired/);
  assert.equal(p.adminSetProductActive(ADMIN, JAPAN, true), "");
  // A refunded buyer's review stops counting.
  const counted = p.reviewsFor(JAPAN).length;
  p.setOrderStatus(ADMIN, 1, "Refunded", "test");
  assert.equal(p.reviewsFor(JAPAN).length, counted - 1);
  assert.equal(p.reviewsFor(JAPAN, true).length, counted);
});
