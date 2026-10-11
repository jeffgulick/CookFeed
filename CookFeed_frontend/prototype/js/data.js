/* Cookfeed prototype - the store's data, arranged for the pages.

   The rows themselves live in seed-data.js (window.COOKFEED_SEED), which is generated from the seeded
   project database by CookFeed_frontend/tools/export-seed-data.sh, so the prototype and the database
   describe exactly the same store. Each table is an array of rows; each property is the camelCase form
   of a column (products.price_cents is priceCents, reviews.created_at is createdAt), and values keep
   their database types: numbers, true/false, null, and ISO date strings.

   This file only joins those rows into the shapes the pages read: CREATOR, PRODUCT, RECIPES and
   SEED_REVIEWS. Nothing here is typed in by hand except the few values marked "prototype only",
   which have no column because the real application gets them another way. */

var SEED = window.COOKFEED_SEED;

function rowById(table, id) {
  for (var i = 0; i < SEED[table].length; i++) {
    if (SEED[table][i].id === id) { return SEED[table][i]; }
  }
  return null;
}

function rowsWhere(table, test) {
  return SEED[table].filter(test);
}

function bySortOrder(a, b) { return a.sortOrder - b.sortOrder; }

/* day_offset 0 is the first night of the plan. */
var DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/* The product these pages show: products row 3, "Three Weeknights in Japan". */
var PRODUCT_ID = 3;

/* prototype only: the page file for each recipe in the plan, and the length of the mock video. */
var RECIPE_PAGES = { 5: "recipe-teriyaki.html", 6: "recipe-onigiri.html", 7: "recipe-stirfry.html" };
var MOCK_VIDEO_SECONDS = 32;

/* A creator: their creator_profiles row with users.display_name joined in. */
function creatorFor(userId) {
  var profile = rowsWhere("creatorProfiles", function (p) { return p.userId === userId; })[0];
  return {
    userId: profile.userId,
    handle: profile.handle,
    displayName: rowById("users", userId).displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    isVerified: profile.isVerified
  };
}

/* A recipes row with its recipe_ingredients (joined to ingredients and units) and recipe_steps.
   Each ingredient line carries its aisle (ingredients.category), so a shopping list can be built
   straight from the recipes. */
function recipeWithDetails(recipeId) {
  var recipe = Object.assign({}, rowById("recipes", recipeId));
  recipe.pageUrl = RECIPE_PAGES[recipeId];      // prototype only
  recipe.videoSeconds = MOCK_VIDEO_SECONDS;     // prototype only
  recipe.ingredients = rowsWhere("recipeIngredients", function (ri) { return ri.recipeId === recipeId; })
    .sort(bySortOrder)
    .map(function (ri) {
      var ingredient = rowById("ingredients", ri.ingredientId);
      return {
        quantity: ri.quantity,
        unit: rowById("units", ri.unitId).abbreviation,
        name: ingredient.name,
        displayText: ri.displayText,
        preparation: ri.preparation,
        isOptional: ri.isOptional,
        aisle: ingredient.category
      };
    });
  recipe.steps = rowsWhere("recipeSteps", function (s) { return s.recipeId === recipeId; })
    .sort(function (a, b) { return a.stepNumber - b.stepNumber; })
    .map(function (s) {
      return { stepNumber: s.stepNumber, videoTimestampSeconds: s.videoTimestampSeconds, instruction: s.instruction };
    });
  return recipe;
}

/* products row 3, with its product_recipes rows nested inside in plan order. */
var PRODUCT = Object.assign({}, rowById("products", PRODUCT_ID), {
  recipes: rowsWhere("productRecipes", function (pr) { return pr.productId === PRODUCT_ID; })
    .sort(bySortOrder)
    .map(function (pr) {
      return { recipeId: pr.recipeId, sortOrder: pr.sortOrder, dayOffset: pr.dayOffset, slot: pr.slot };
    })
});

var CREATOR = creatorFor(PRODUCT.creatorId);

/* The plan's recipes, keyed by id. */
var RECIPES = {};
PRODUCT.recipes.forEach(function (pr) { RECIPES[pr.recipeId] = recipeWithDetails(pr.recipeId); });

/* reviews rows for the product. reviewerName is users.display_name, joined in;
   the reviews table stores user_id, not a copy of the name. */
var SEED_REVIEWS = rowsWhere("reviews", function (r) { return r.productId === PRODUCT_ID; })
  .map(function (r) {
    return Object.assign({}, r, { reviewerName: rowById("users", r.userId).displayName });
  });

/* Field limits copied from the column sizes in schema.sql, so the forms refuse
   anything the database would refuse. */
var LIMITS = {
  reviewBodyMin: 15,
  reviewBodyMax: 2000,     // reviews.body varchar(2000)
  displayNameMax: 80,      // users.display_name varchar(80)
  servingsMin: 1,
  servingsMax: 20
};
