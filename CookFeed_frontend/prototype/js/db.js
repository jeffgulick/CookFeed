/* Cookfeed prototype - the store's database, in the browser.

   The rows come from seed-data.js (window.COOKFEED_SEED), which is generated from the seeded project
   database by CookFeed_frontend/tools/export-seed-data.sh. Each table is an array of rows; each property
   is the camelCase form of a column (products.price_cents is priceCents), and values keep their
   database types.

   Most tables never change while the prototype runs. The six that people change - saves, carts, orders
   and their lines and snapshots, and reviews - are copied from the seed into localStorage the first time
   a page needs them, and every change is written there. So each account starts with exactly what the
   database holds for it, and what it does in the browser is kept on top. The functions below are the
   prototype's stand-in for the API: the Angular app will make the same requests over HTTP. */

var SEED = window.COOKFEED_SEED;

/* ---------- reading the seed ---------- */

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

/* day_offset 0 is the first day of a meal plan. */
var DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/* Field limits copied from the column sizes in schema.sql, so the forms refuse anything the database
   would refuse. */
var LIMITS = {
  reviewBodyMin: 15,
  reviewBodyMax: 2000,     // reviews.body varchar(2000)
  servingsMin: 1,
  servingsMax: 20
};

/* An account: its users row, the names of its roles (user_roles joined to roles) and, for a creator,
   its handle. Email and password never leave the database. */
function userById(userId) {
  var user = rowById("users", userId);
  if (user === null) { return null; }
  var roles = rowsWhere("userRoles", function (ur) { return ur.userId === userId; })
    .map(function (ur) { return rowById("roles", ur.roleId).name; });
  var profile = rowsWhere("creatorProfiles", function (p) { return p.userId === userId; })[0];
  return { id: user.id, displayName: user.displayName, roles: roles, handle: profile ? profile.handle : null };
}

/* A creator: their creator_profiles row with users.display_name joined in. */
function creatorFor(userId) {
  var profile = rowsWhere("creatorProfiles", function (p) { return p.userId === userId; })[0];
  if (!profile) { return null; }
  return {
    userId: profile.userId,
    handle: profile.handle,
    displayName: rowById("users", userId).displayName,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    isVerified: profile.isVerified
  };
}

function creatorByHandle(handle) {
  var profile = rowsWhere("creatorProfiles", function (p) { return p.handle === handle; })[0];
  return profile ? creatorFor(profile.userId) : null;
}

/* A recipes row with its recipe_ingredients (joined to ingredients and units) and recipe_steps.
   Each ingredient line carries its aisle (ingredients.category), so a shopping list can be built
   straight from the recipes. */
function recipeWithDetails(recipeId) {
  var row = rowById("recipes", recipeId);
  if (row === null) { return null; }
  var recipe = Object.assign({}, row);
  recipe.pageUrl = "recipe.html?id=" + recipeId;
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
  // prototype only: the mock video runs to a few seconds past the last marked step.
  var lastStep = recipe.steps.length ? recipe.steps[recipe.steps.length - 1].videoTimestampSeconds || 0 : 0;
  recipe.videoSeconds = lastStep + 8;
  return recipe;
}

/* A products row with its product_recipes placements in order. A recipe can fill more than one meal of
   a meal plan (Family Week has the oats twice), so the counts follow Q5: distinct recipes, and for a
   meal plan, meals. */
function productWithRecipes(productId) {
  var row = rowById("products", productId);
  if (row === null) { return null; }
  var product = Object.assign({}, row);
  product.recipes = rowsWhere("productRecipes", function (pr) { return pr.productId === productId; })
    .sort(bySortOrder)
    .map(function (pr) {
      return { recipeId: pr.recipeId, sortOrder: pr.sortOrder, dayOffset: pr.dayOffset, slot: pr.slot };
    });
  var distinct = {};
  product.recipes.forEach(function (pr) { distinct[pr.recipeId] = true; });
  product.recipeCount = Object.keys(distinct).length;
  product.mealCount = product.type === "MealPlan" ? product.recipes.length : null;
  return product;
}

/* ---------- localStorage ----------
   Each read and write is wrapped in try/catch because storage can be switched off (private windows,
   strict privacy settings); when it is, the pages still work and simply forget on reload. */

function loadJson(key, fallback) {
  try {
    var text = window.localStorage.getItem(key);
    if (text === null) {
      return fallback;
    }
    return JSON.parse(text);
  } catch (error) {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

function removeStored(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    // Nothing stored, nothing to remove.
  }
}

/* ---------- the tables people change ---------- */

var DB_KEY = "cookfeed.db";
var CHANGING_TABLES = ["savedRecipes", "cartItems", "orders", "orderItems", "orderItemRecipes", "reviews"];

/* Homework 3 kept the cart, saves, reviews and orders under these keys, for no one in particular. */
var OLD_KEYS = ["cookfeed.cart", "cookfeed.saves", "cookfeed.reviews", "cookfeed.orders"];

/* A short fingerprint of the seed. A browser copy made from an older seed-data.js is thrown away
   rather than mixed with the new rows. */
function seedFingerprint() {
  var text = JSON.stringify(SEED);
  var hash = 5381;
  for (var i = 0; i < text.length; i++) {
    hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  }
  return text.length + "-" + hash.toString(16);
}

var dbCopy = null;

function freshCopy() {
  var copy = { seedFingerprint: seedFingerprint() };
  CHANGING_TABLES.forEach(function (table) { copy[table] = JSON.parse(JSON.stringify(SEED[table])); });
  return copy;
}

function db() {
  if (dbCopy === null) {
    OLD_KEYS.forEach(removeStored);
    var stored = loadJson(DB_KEY, null);
    dbCopy = stored !== null && stored.seedFingerprint === seedFingerprint() ? stored : freshCopy();
    saveJson(DB_KEY, dbCopy);
  }
  return dbCopy;
}

function commit() {
  saveJson(DB_KEY, db());
}

/* Put every account back to exactly what the database holds. */
function resetDb() {
  dbCopy = freshCopy();
  commit();
}

function nextId(table) {
  return db()[table].reduce(function (max, row) { return Math.max(max, row.id); }, 0) + 1;
}

function newestFirst(field) {
  return function (a, b) { return a[field] < b[field] ? 1 : a[field] > b[field] ? -1 : 0; };
}

/* ---------- saves (saved_recipes) ---------- */

function savesFor(userId) {
  return db().savedRecipes.filter(function (s) { return s.userId === userId; }).sort(newestFirst("savedAt"));
}

function isSavedBy(userId, recipeId) {
  return db().savedRecipes.some(function (s) { return s.userId === userId && s.recipeId === recipeId; });
}

/* recipes.save_count, counted from the rows the way the saved_recipes trigger keeps it. */
function saveCount(recipeId) {
  return db().savedRecipes.filter(function (s) { return s.recipeId === recipeId; }).length;
}

function setSaved(userId, recipeId, saved) {
  var tables = db();
  if (saved && !isSavedBy(userId, recipeId)) {
    tables.savedRecipes.push({ userId: userId, savedAt: new Date().toISOString(), recipeId: recipeId });
  }
  if (!saved) {
    tables.savedRecipes = tables.savedRecipes.filter(function (s) {
      return !(s.userId === userId && s.recipeId === recipeId);
    });
  }
  commit();
}

/* ---------- cart (cart_items: one row per account and product) ---------- */

function cartFor(userId) {
  return db().cartItems.filter(function (c) { return c.userId === userId; });
}

function isInCartOf(userId, productId) {
  return cartFor(userId).some(function (c) { return c.productId === productId; });
}

/* Returns false when the product is already there or no longer for sale. */
function addToCart(userId, productId) {
  var product = rowById("products", productId);
  if (product === null || !product.isActive || isInCartOf(userId, productId)) {
    return false;
  }
  db().cartItems.push({ userId: userId, addedAt: new Date().toISOString(), productId: productId });
  commit();
  return true;
}

function removeFromCart(userId, productId) {
  var tables = db();
  tables.cartItems = tables.cartItems.filter(function (c) { return !(c.userId === userId && c.productId === productId); });
  commit();
}

function clearCartOf(userId) {
  var tables = db();
  tables.cartItems = tables.cartItems.filter(function (c) { return c.userId !== userId; });
  commit();
}

/* ---------- orders ---------- */

/* An order with its lines, each line with the recipes its purchase covers. */
function orderWithItems(order) {
  var tables = db();
  return Object.assign({}, order, {
    items: tables.orderItems.filter(function (oi) { return oi.orderId === order.id; })
      .sort(function (a, b) { return a.id - b.id; })
      .map(function (oi) {
        return Object.assign({}, oi, {
          recipes: tables.orderItemRecipes.filter(function (oir) { return oir.orderItemId === oi.id; }).sort(bySortOrder)
        });
      })
  });
}

function ordersFor(userId) {
  return db().orders.filter(function (o) { return o.userId === userId; })
    .sort(newestFirst("placedAt"))
    .map(orderWithItems);
}

/* Checkout, as the API will do it: one Paid order, one line per product in the cart with the seller and
   the price at the time, and a snapshot of the product's recipes with their days and slots
   (order_item_recipes). What the buyer keeps is that snapshot, not the live product (design section 3.3).
   Returns the order, or null when the cart is empty. */
function placeOrder(userId) {
  var lines = cartFor(userId)
    .map(function (c) { return productWithRecipes(c.productId); })
    .filter(function (p) { return p !== null && p.isActive; });
  if (lines.length === 0) {
    return null;
  }

  var tables = db();
  var now = new Date().toISOString();
  var order = {
    id: nextId("orders"),
    paidAt: now,
    status: "Paid",
    userId: userId,
    currency: "USD",
    placedAt: now,
    totalCents: lines.reduce(function (sum, p) { return sum + p.priceCents; }, 0),
    paymentReference: null
  };
  tables.orders.push(order);

  lines.forEach(function (product) {
    var item = {
      id: nextId("orderItems"),
      orderId: order.id,
      creatorId: product.creatorId,
      productId: product.id,
      productTitle: product.title,
      unitPriceCents: product.priceCents
    };
    tables.orderItems.push(item);
    product.recipes.forEach(function (pr) {
      tables.orderItemRecipes.push({
        id: nextId("orderItemRecipes"),
        slot: pr.slot,
        recipeId: pr.recipeId,
        dayOffset: pr.dayOffset,
        sortOrder: pr.sortOrder,
        orderItemId: item.id
      });
    });
  });

  clearCartOf(userId);
  commit();
  return orderWithItems(order);
}

/* ---------- reviews ---------- */

/* reviewerName is users.display_name, joined in; the reviews table stores user_id, not a copy of the name. */
function withReviewer(review) {
  return Object.assign({}, review, { reviewerName: rowById("users", review.userId).displayName });
}

function reviewsFor(productId) {
  return db().reviews.filter(function (r) { return r.productId === productId; })
    .sort(newestFirst("createdAt"))
    .map(withReviewer);
}

function reviewBy(userId, productId) {
  var review = db().reviews.filter(function (r) { return r.userId === userId && r.productId === productId; })[0];
  return review ? withReviewer(review) : null;
}

/* One review per account and product (ix_reviews_product_id_user_id): a second returns null.
   Whether the account may review at all is reviewState in rules.js. */
function addReview(userId, productId, rating, recommends, body) {
  if (reviewBy(userId, productId) !== null) {
    return null;
  }
  var review = {
    id: nextId("reviews"),
    body: body,
    rating: rating,
    userId: userId,
    createdAt: new Date().toISOString(),
    productId: productId,
    recommends: recommends
  };
  db().reviews.push(review);
  commit();
  return withReviewer(review);
}

/* Only the author removes a review. Returns whether one was removed. */
function removeReview(userId, reviewId) {
  var tables = db();
  var before = tables.reviews.length;
  tables.reviews = tables.reviews.filter(function (r) { return !(r.id === reviewId && r.userId === userId); });
  commit();
  return tables.reviews.length < before;
}
