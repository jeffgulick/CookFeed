/* The marketplace rules of DesignDocument section 3, as the prototype applies them (js/rules.js), checked
   against the seeded accounts. Run with: node --test CookFeed_frontend/tests */

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadPrototype } = require("./load-prototype");

// Seeded accounts and products, by id.
const ALEX = 1, PRIYA = 2, MARIA = 3, KENJI = 4, DAN = 5, ADMIN = 6, SAM = 7;
const ROMAN_PASTA = 1, BREAD_BOX = 2, JAPAN = 3, FAMILY_WEEK = 4, SUMMER_GRILLING = 5;
const CHICKEN_PARM = 4, TERIYAKI = 5, ONIGIRI = 6, OATS = 9, MISO_DRAFT = 13, TAMAGOYAKI = 16;

function setup() {
  const p = loadPrototype();
  return { p, user: (id) => (id === null ? null : p.userById(id)) };
}

test("only HomeCook accounts shop: creators do, the admin and guests do not (3.1)", () => {
  const { p, user } = setup();
  assert.equal(p.canShop(user(ALEX)), true);
  assert.equal(p.canShop(user(KENJI)), true);
  assert.equal(p.canShop(user(ADMIN)), false);
  assert.equal(p.canShop(null), false);
});

test("owning a product takes a Paid order; a cancelled one does not count", () => {
  const { p, user } = setup();
  assert.equal(p.ownsProduct(user(ALEX), ROMAN_PASTA), true);
  assert.equal(p.ownsProduct(user(ALEX), JAPAN), true);
  assert.equal(p.ownsProduct(user(ALEX), BREAD_BOX), false);   // order 3 was cancelled
  assert.equal(p.ownsProduct(user(SAM), JAPAN), false);
  assert.equal(p.ownsProduct(null, JAPAN), false);
});

test("a ProductOnly recipe opens exactly for the users Q14 allows, plus its creator", () => {
  const { p, user } = setup();
  const seed = p.COOKFEED_SEED;
  // Q14, written out independently: a Paid order whose snapshot contains the recipe.
  const q14 = (userId, recipeId) => seed.orders.some((o) => o.userId === userId && o.status === "Paid" &&
    seed.orderItems.some((oi) => oi.orderId === o.id &&
      seed.orderItemRecipes.some((oir) => oir.orderItemId === oi.id && oir.recipeId === recipeId)));

  for (const recipe of seed.recipes.filter((r) => r.isPublished && r.visibility === "ProductOnly")) {
    for (const u of seed.users) {
      const expected = q14(u.id, recipe.id) || u.id === recipe.creatorId;
      assert.equal(p.canOpenRecipe(user(u.id), p.rowById("recipes", recipe.id)), expected,
        `${u.displayName} opening ${recipe.title}`);
    }
  }
});

test("a product sells only ProductOnly recipes, so nothing a buyer pays for is free to save (3.3)", () => {
  const { p } = setup();
  const seed = p.COOKFEED_SEED;
  for (const pr of seed.productRecipes) {
    assert.equal(p.rowById("recipes", pr.recipeId).visibility, "ProductOnly", `recipe ${pr.recipeId} in product ${pr.productId}`);
  }
  // Each creator still has free recipes for the feed.
  for (const creator of seed.creatorProfiles) {
    assert.ok(seed.recipes.some((r) => r.creatorId === creator.userId && r.isPublished && r.visibility === "Public"),
      `${creator.handle} has a free recipe`);
  }
});

test("recipe access in the cases the pages show", () => {
  const { p, user } = setup();
  const recipe = (id) => p.rowById("recipes", id);
  assert.equal(p.canOpenRecipe(null, recipe(TAMAGOYAKI)), true);     // Public: anyone
  assert.equal(p.canOpenRecipe(null, recipe(TERIYAKI)), false);      // in a plan, so ProductOnly
  assert.equal(p.canOpenRecipe(user(DAN), recipe(TERIYAKI)), true);  // Dan bought Three Weeknights
  assert.equal(p.canOpenRecipe(null, recipe(ONIGIRI)), false);
  assert.equal(p.canOpenRecipe(user(SAM), recipe(ONIGIRI)), false);
  assert.equal(p.canOpenRecipe(user(ALEX), recipe(ONIGIRI)), true);
  assert.equal(p.canOpenRecipe(user(KENJI), recipe(ONIGIRI)), true);  // his own recipe
  assert.equal(p.canOpenRecipe(user(PRIYA), recipe(CHICKEN_PARM)), false);
  assert.equal(p.canOpenRecipe(user(SAM), recipe(MISO_DRAFT)), false); // a draft: only its creator
  assert.equal(p.canOpenRecipe(user(KENJI), recipe(MISO_DRAFT)), true);
  assert.equal(p.canOpenRecipe(user(SAM), null), false);
});

test("saving needs a shopper who can open the recipe, and a published recipe (3.3)", () => {
  const { p, user } = setup();
  const recipe = (id) => p.rowById("recipes", id);
  assert.equal(p.canSave(null, recipe(TAMAGOYAKI)), false);
  assert.equal(p.canSave(user(ADMIN), recipe(TAMAGOYAKI)), false);
  assert.equal(p.canSave(user(SAM), recipe(TAMAGOYAKI)), true);
  assert.equal(p.canSave(user(SAM), recipe(TERIYAKI)), false);
  assert.equal(p.canSave(user(SAM), recipe(ONIGIRI)), false);
  assert.equal(p.canSave(user(ALEX), recipe(ONIGIRI)), true);
  assert.equal(p.canSave(user(KENJI), recipe(MISO_DRAFT)), false);
});

test("the buy button's state for each kind of viewer", () => {
  const { p, user } = setup();
  const product = (id) => p.rowById("products", id);
  const cases = [
    [null, JAPAN, "signIn"],
    [ADMIN, JAPAN, "noShop"],
    [KENJI, JAPAN, "yourOwn"],               // a creator cannot buy their own plan (3.1)
    [KENJI, ROMAN_PASTA, "buy"],             // but can buy another creator's
    [ALEX, JAPAN, "owned"],
    [ALEX, BREAD_BOX, "buy"],                // his order for it was cancelled, so he may buy it again
    [PRIYA, BREAD_BOX, "inCart"],
    [SAM, JAPAN, "buy"],
    [SAM, SUMMER_GRILLING, "notForSale"],    // retired
    [DAN, SUMMER_GRILLING, "yourOwn"],
    [null, SUMMER_GRILLING, "notForSale"]
  ];
  for (const [userId, productId, expected] of cases) {
    assert.equal(p.buyState(user(userId), product(productId)), expected, `user ${userId}, product ${productId}`);
  }
});

test("only buyers review, once per product, and never their own (3.5)", () => {
  const { p, user } = setup();
  const cases = [
    [null, JAPAN, "signIn"],
    [ADMIN, JAPAN, "noShop"],
    [KENJI, JAPAN, "yourOwn"],
    [SAM, JAPAN, "mustBuy"],
    [ALEX, BREAD_BOX, "mustBuy"],            // cancelled, so not a buyer
    [ALEX, JAPAN, "alreadyReviewed"],
    [PRIYA, JAPAN, "alreadyReviewed"],
    [PRIYA, FAMILY_WEEK, "canReview"],
    [ALEX, ROMAN_PASTA, "canReview"]
  ];
  for (const [userId, productId, expected] of cases) {
    assert.equal(p.reviewState(user(userId), productId), expected, `user ${userId}, product ${productId}`);
  }
});

test("an owned ProductOnly recipe names the purchase it came through", () => {
  const { p, user } = setup();
  assert.equal(p.ownedThrough(user(ALEX), ONIGIRI), "Three Weeknights in Japan");
  assert.equal(p.ownedThrough(user(ALEX), CHICKEN_PARM), "Roman Pasta Collection");
  assert.equal(p.ownedThrough(user(SAM), ONIGIRI), null);
  assert.equal(p.ownedThrough(null, ONIGIRI), null);
});

test("buying changes the rules: after checkout Sam owns the plan, opens Onigiri and may review", () => {
  const { p, user } = setup();
  assert.equal(p.addToCart(SAM, JAPAN), true);
  p.placeOrder(SAM);

  assert.equal(p.buyState(user(SAM), p.rowById("products", JAPAN)), "owned");
  assert.equal(p.canOpenRecipe(user(SAM), p.rowById("recipes", ONIGIRI)), true);
  assert.equal(p.reviewState(user(SAM), JAPAN), "canReview");
});

test("the admin and creators are told apart, and a creator manages only their own rows (3.8)", () => {
  const { p, user } = setup();
  assert.equal(p.isAdmin(user(ADMIN)), true);
  assert.equal(p.isAdmin(user(KENJI)), false);
  assert.equal(p.isCreator(user(KENJI)), true);
  assert.equal(p.isCreator(user(SAM)), false);
  assert.equal(p.isCreator(null), false);
  assert.equal(p.canManageRecipe(user(KENJI), p.rowById("recipes", ONIGIRI)), true);
  assert.equal(p.canManageRecipe(user(MARIA), p.rowById("recipes", ONIGIRI)), false);
  assert.equal(p.canManageRecipe(user(ADMIN), p.rowById("recipes", ONIGIRI)), false);
  assert.equal(p.canManageProduct(user(DAN), p.rowById("products", FAMILY_WEEK)), true);
  assert.equal(p.canManageProduct(user(ALEX), p.rowById("products", FAMILY_WEEK)), false);
});

test("a suspended creator's plans are not for sale, and buyers keep them (3.8)", () => {
  const { p, user } = setup();
  const product = (id) => p.rowById("products", id);
  assert.equal(p.buyState(user(SAM), product(FAMILY_WEEK)), "buy");
  assert.notEqual(p.setCreatorSuspended(ADMIN, DAN, true), null);
  assert.equal(p.buyState(user(SAM), product(FAMILY_WEEK)), "notForSale");
  assert.equal(p.isForSale(product(FAMILY_WEEK)), false);
  assert.equal(p.buyState(user(ALEX), product(FAMILY_WEEK)), "owned");
  assert.equal(p.canOpenRecipe(user(ALEX), p.rowById("recipes", OATS)), true);
  assert.notEqual(p.setCreatorSuspended(ADMIN, DAN, false), null);
  assert.equal(p.buyState(user(SAM), product(FAMILY_WEEK)), "buy");
});

test("a free recipe cannot go in a plan, a draft neither, and a plan's recipe cannot be made free (3.3)", () => {
  const { p } = setup();
  const recipe = (id) => p.rowById("recipes", id);
  assert.notEqual(p.placementProblem(recipe(TAMAGOYAKI)), "");
  assert.notEqual(p.placementProblem(recipe(MISO_DRAFT)), "");
  assert.equal(p.placementProblem(recipe(ONIGIRI)), "");
  assert.notEqual(p.visibilityProblem(recipe(TERIYAKI), "Public"), "");
  assert.equal(p.visibilityProblem(recipe(TERIYAKI), "ProductOnly"), "");
  assert.equal(p.visibilityProblem(recipe(TAMAGOYAKI), "Public"), "");
});
