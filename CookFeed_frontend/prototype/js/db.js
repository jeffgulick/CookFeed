/* Cookfeed prototype - the store's database, in the browser.

   The rows come from seed-data.js (window.COOKFEED_SEED), which is generated from the seeded project
   database by CookFeed_frontend/tools/export-seed-data.sh. Each table is an array of rows; each property
   is the camelCase form of a column (products.price_cents is priceCents), and values keep their
   database types.

   The reference tables (users, roles, units, ingredients) never change while the prototype runs. The
   tables people change - saves, carts, orders and their lines and snapshots, reviews, and what creators
   and the admin manage (recipes and their lines, products and their placements, creator profiles, the
   admin's audit trail) - are copied from the seed into localStorage the first time a page needs them, and
   every change is written there. So each account starts with exactly what the database holds for it, and
   what it does in the browser is kept on top. The functions below are the prototype's stand-in for the
   API: the Angular app will make the same requests over HTTP. */

var SEED = window.COOKFEED_SEED;

/* ---------- reading the seed ---------- */

/* A table's rows: the browser copy for a table people change, the seed for the rest. */
function tableRows(table) {
  return CHANGING_TABLES.indexOf(table) !== -1 ? db()[table] : SEED[table];
}

/* The export leaves out a table with no rows (admin_actions, until an admin does something). */
function seedRows(table) {
  return SEED[table] || [];
}

function rowById(table, id) {
  var rows = tableRows(table);
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].id === id) { return rows[i]; }
  }
  return null;
}

function rowsWhere(table, test) {
  return tableRows(table).filter(test);
}

function nowIso() {
  return new Date().toISOString();
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
  servingsMax: 50          // people for one recipe; a plan's repeated meal can double a recipe written for 24
};

/* "" when the value is a whole number of people from 1 to 50, otherwise what to tell the cook. Every place
   that takes a number of people (recipe and plan pages, the week, a trip, the pickers) asks this, and every
   write below refuses what it refuses. */
function peopleProblem(value) {
  var text = String(value === undefined || value === null ? "" : value).trim();
  if (text === "") { return "Enter how many people you are cooking for."; }
  var people = Number(text);
  if (isNaN(people) || Math.floor(people) !== people || !/^[0-9]+$/.test(text)) { return "Use a whole number of people."; }
  if (people < LIMITS.servingsMin || people > LIMITS.servingsMax) {
    return "Choose between " + LIMITS.servingsMin + " and " + LIMITS.servingsMax + " people.";
  }
  return "";
}

function isPeople(value) {
  return peopleProblem(value) === "";
}

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
    isVerified: profile.isVerified,
    suspendedAt: profile.suspendedAt
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
        ingredientId: ingredient.id,
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
var CHANGING_TABLES = ["savedRecipes", "cartItems", "orders", "orderItems", "orderItemRecipes", "reviews",
  "recipes", "recipeIngredients", "recipeSteps", "products", "productRecipes", "creatorProfiles", "adminActions",
  "mealPlans", "mealPlanEntries", "shoppingTrips", "shoppingTripItems", "shoppingTripSkips"];

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

/* A page keeps one copy of the tables in memory and writes it back whole. Two tabs would then overwrite
   each other's changes, bring back a deleted trip, or hand out the same id twice. So every write carries a
   version number: a tab whose copy is older than what is stored refuses to write, and reloads instead (the
   "storage" event below usually reloads it first, the moment another tab saves). */
var STALE_KEY = "cookfeed.staleReload";

function freshCopy() {
  var copy = { seedFingerprint: seedFingerprint(), version: 0, lastIds: {} };
  CHANGING_TABLES.forEach(function (table) { copy[table] = JSON.parse(JSON.stringify(seedRows(table))); });
  return copy;
}

function db() {
  if (dbCopy === null) {
    OLD_KEYS.forEach(removeStored);
    var stored = loadJson(DB_KEY, null);
    if (stored !== null && stored.seedFingerprint === seedFingerprint()) {
      dbCopy = stored;
      if (typeof dbCopy.version !== "number") { dbCopy.version = 0; }
      if (!dbCopy.lastIds) { dbCopy.lastIds = {}; }
    } else {
      dbCopy = freshCopy();
      saveJson(DB_KEY, dbCopy);
    }
  }
  return dbCopy;
}

function storedVersion() {
  var stored = loadJson(DB_KEY, null);
  return stored !== null && typeof stored.version === "number" ? stored.version : 0;
}

/* Returns false, and reloads the page, when another tab saved first; the change is not written. */
function commit() {
  var tables = db();
  if (storedVersion() !== tables.version) {
    dbCopy = null;
    reloadStalePage();
    return false;
  }
  tables.version = tables.version + 1;
  saveJson(DB_KEY, tables);
  return true;
}

function reloadStalePage() {
  if (typeof window === "undefined" || !window.location || typeof window.location.reload !== "function") { return; }
  try { window.sessionStorage.setItem(STALE_KEY, "1"); } catch (error) { /* nothing to remember */ }
  window.location.reload();
}

if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
  window.addEventListener("storage", function (event) {
    if (event.key === DB_KEY) { dbCopy = null; reloadStalePage(); }
  });
}

/* Put every account back to exactly what the database holds. */
function resetDb() {
  var version = storedVersion();
  dbCopy = freshCopy();
  dbCopy.version = version;
  commit();
}

/* An id is never handed out twice, even after its row is deleted (as a database sequence behaves), so a
   new trip never inherits a deleted trip's ticks or links. */
function nextId(table) {
  var tables = db();
  var id = Math.max(tables.lastIds[table] || 0,
    tables[table].reduce(function (max, row) { return Math.max(max, row.id); }, 0)) + 1;
  tables.lastIds[table] = id;
  return id;
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
  if (saved && !canSave(userById(userId), rowById("recipes", recipeId))) { return; }
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

/* Returns false when the product is already there, already owned, the shopper's own, no longer for sale,
   or the account does not shop (the same answers buyState gives the page). */
function addToCart(userId, productId) {
  var product = rowById("products", productId);
  if (product === null || buyState(userById(userId), product) !== "buy") {
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
  var buyer = userById(userId);
  if (!canShop(buyer)) { return null; }
  var lines = cartFor(userId)
    .map(function (c) { return productWithRecipes(c.productId); })
    .filter(function (p) { return p !== null && isForSale(p) && !ownsProduct(buyer, p.id) && p.creatorId !== userId; });
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

/* A product's reviews that count, newest first. A review the admin hid (reviews.hidden_at, 3.8) does not
   count, nor does one whose author no longer owns the product (their order was refunded, 3.5: a review
   needs a Paid order). includeHidden, which only the admin's own view sets, lists those too. */
function reviewsFor(productId, includeHidden) {
  return db().reviews.filter(function (r) { return r.productId === productId && (includeHidden || reviewCounts(r)); })
    .sort(newestFirst("createdAt"))
    .map(withReviewer);
}

function reviewCounts(review) {
  return review.hiddenAt === null && ownsProduct(userById(review.userId), review.productId);
}

/* Every review in the store, for the admin console. */
function allReviews() {
  return db().reviews.slice().sort(newestFirst("createdAt")).map(function (r) {
    return Object.assign(withReviewer(r), { productTitle: rowById("products", r.productId).title });
  });
}

function reviewBy(userId, productId) {
  var review = db().reviews.filter(function (r) { return r.userId === userId && r.productId === productId; })[0];
  return review ? withReviewer(review) : null;
}

/* One review per account and product (ix_reviews_product_id_user_id): a second returns null.
   Whether the account may review at all is reviewState in rules.js. */
function addReview(userId, productId, rating, recommends, body) {
  if (reviewState(userById(userId), productId) !== "canReview") {
    return null;
  }
  var review = {
    id: nextId("reviews"),
    body: body,
    rating: rating,
    userId: userId,
    createdAt: nowIso(),
    productId: productId,
    recommends: recommends,
    hiddenAt: null
  };
  db().reviews.push(review);
  commit();
  return withReviewer(review);
}

/* Only the author removes a review, and not one the admin hid: removing it would free the author to post it
   again, undoing the admin's decision (3.8). Returns whether one was removed. */
function removeReview(userId, reviewId) {
  var tables = db();
  var before = tables.reviews.length;
  tables.reviews = tables.reviews.filter(function (r) { return !(r.id === reviewId && r.userId === userId && r.hiddenAt === null); });
  if (tables.reviews.length === before) { return false; }
  commit();
  return tables.reviews.length < before;
}

/* ---------- a creator's recipes and products: the studio (design section 3.8) ----------
   What a creator changes is their own rows only; the pages check canManageRecipe / canManageProduct in
   rules.js before offering the controls, as the API will check the caller. */

/* Replace a recipe's ingredient lines and steps. lines: [{ ingredientId, unitId, quantity, preparation }];
   steps: the instructions in order. The mock video marks each step 8 seconds after the one before. */
function replaceRecipeLines(recipeId, lines, steps) {
  var tables = db();
  tables.recipeIngredients = tables.recipeIngredients.filter(function (ri) { return ri.recipeId !== recipeId; });
  tables.recipeSteps = tables.recipeSteps.filter(function (s) { return s.recipeId !== recipeId; });
  lines.forEach(function (line, index) {
    tables.recipeIngredients.push({
      id: nextId("recipeIngredients"), recipeId: recipeId, ingredientId: line.ingredientId, unitId: line.unitId,
      quantity: line.quantity, displayText: line.displayText || null, preparation: line.preparation || null, sortOrder: index + 1,
      isOptional: line.isOptional === true
    });
  });
  steps.forEach(function (text, index) {
    tables.recipeSteps.push({
      id: nextId("recipeSteps"), recipeId: recipeId, stepNumber: index + 1, instruction: text,
      videoTimestampSeconds: 8 * (index + 1), durationMinutes: null
    });
  });
}

/* A new recipe starts as a draft: only its creator can open it until it is published. */
function createRecipe(creatorId, fields) {
  var tables = db();
  var id = nextId("recipes");
  var recipe = {
    id: id, creatorId: creatorId, title: fields.title, description: fields.description || null,
    videoUrl: "https://cdn.cookfeed.app/videos/draft-" + id + ".mp4", thumbnailUrl: null,
    servings: fields.servings, prepMinutes: fields.prepMinutes === undefined ? null : fields.prepMinutes,
    cookMinutes: fields.cookMinutes === undefined ? null : fields.cookMinutes, isPublished: false,
    visibility: fields.visibility || "Public", createdAt: nowIso(), publishedAt: null, saveCount: 0
  };
  tables.recipes.push(recipe);
  replaceRecipeLines(id, fields.ingredients || [], fields.steps || []);
  commit();
  return recipe;
}

function updateRecipe(recipeId, fields) {
  var recipe = rowById("recipes", recipeId);
  ["title", "description", "servings", "prepMinutes", "cookMinutes"].forEach(function (key) {
    if (fields[key] !== undefined) { recipe[key] = fields[key]; }
  });
  if (fields.ingredients !== undefined || fields.steps !== undefined) {
    replaceRecipeLines(recipeId, fields.ingredients || [], fields.steps || []);
  }
  commit();
  return recipe;
}

/* Publishing sets published_at the first time (ck_recipes_published_has_date); unpublishing hides the
   recipe from everyone but its creator. Buyers keep a recipe they bought either way. */
/* The creator publishes or unpublishes their recipe. Returns "" when done, or why not (rules.js
   creatorPublishProblem): a sold recipe or one in a plan stays published; what the admin took down stays down. */
function setRecipePublished(recipeId, published) {
  var recipe = rowById("recipes", recipeId);
  var problem = creatorPublishProblem(recipe, published);
  if (problem !== "") { return problem; }
  writeRecipePublished(recipe, published);
  return "";
}

function writeRecipePublished(recipe, published) {
  recipe.isPublished = published;
  if (published && recipe.publishedAt === null) { recipe.publishedAt = nowIso(); }
  commit();
}

/* Free or premium. Returns "" when done, or the reason the database would refuse it (rules.js). */
function setRecipeVisibility(recipeId, visibility) {
  var recipe = rowById("recipes", recipeId);
  var problem = visibilityProblem(recipe, visibility);
  if (problem !== "") { return problem; }
  recipe.visibility = visibility;
  commit();
  return "";
}

/* The placements a product sells, replaced whole. Every recipe must be published and premium
   (placementProblem); the first problem is returned, and nothing changes. */
function replacePlacements(productId, placements) {
  for (var i = 0; i < placements.length; i = i + 1) {
    var problem = placementProblem(rowById("recipes", placements[i].recipeId));
    if (problem !== "") { return problem; }
  }
  var tables = db();
  tables.productRecipes = tables.productRecipes.filter(function (pr) { return pr.productId !== productId; });
  placements.forEach(function (placement, index) {
    tables.productRecipes.push({
      id: nextId("productRecipes"), productId: productId, recipeId: placement.recipeId, sortOrder: index + 1,
      dayOffset: placement.dayOffset === undefined ? null : placement.dayOffset,
      slot: placement.slot === undefined ? null : placement.slot
    });
  });
  return "";
}

/* A new meal plan or collection, for sale at once. Returns { product } or { problem }. */
function createProduct(creatorId, fields) {
  var tables = db();
  var product = {
    id: nextId("products"), creatorId: creatorId, type: fields.type, title: fields.title,
    description: fields.description || null, coverImageUrl: "images/products/new.svg",
    priceCents: fields.priceCents, currency: "USD", isActive: true, createdAt: nowIso()
  };
  tables.products.push(product);
  var problem = replacePlacements(product.id, fields.placements || []);
  if (problem !== "") {
    tables.products.pop();
    return { problem: problem };
  }
  commit();
  return { product: product };
}

/* Returns "" when done, or the first placement problem. */
function updateProduct(productId, fields) {
  var product = rowById("products", productId);
  if (fields.placements !== undefined) {
    var problem = replacePlacements(productId, fields.placements);
    if (problem !== "") { return problem; }
  }
  ["title", "description", "priceCents"].forEach(function (key) {
    if (fields[key] !== undefined) { product[key] = fields[key]; }
  });
  commit();
  return "";
}

/* Retire or restore. A retired product is not for sale; buyers keep it (design section 3.3). */
/* The creator retires a plan or puts it back on sale. Returns "" when done, or why not (rules.js
   restoreProblem): no recipes, a recipe taken down, or the admin retired it. */
function setProductActive(productId, active) {
  var product = rowById("products", productId);
  var problem = active ? restoreProblem(product, false) : "";
  if (problem !== "") { return problem; }
  product.isActive = active;
  commit();
  return "";
}

/* The orders that bought a creator's products, newest first: their sales (Q10). */
function salesFor(creatorId) {
  var tables = db();
  return tables.orderItems.filter(function (oi) { return oi.creatorId === creatorId; })
    .map(function (oi) {
      var order = rowById("orders", oi.orderId) || db().orders.filter(function (o) { return o.id === oi.orderId; })[0];
      return Object.assign({}, oi, { status: order.status, placedAt: order.placedAt,
        buyerName: rowById("users", order.userId).displayName });
    })
    .sort(newestFirst("placedAt"));
}

/* ---------- the admin's console (design section 3.8) ----------
   Every change the admin makes to somebody else's row is written with a row in admin_actions, as the API
   will do in one transaction. Only an Admin account may write that table (the admin_actions_admin_only
   trigger), so every function here refuses anyone else and returns null. */

function logAdminAction(adminId, action, targetTable, targetId, note) {
  var admin = userById(adminId);
  if (admin === null || admin.roles.indexOf("Admin") === -1) { return null; }
  var row = { id: nextId("adminActions"), adminUserId: adminId, action: action, targetTable: targetTable,
    targetId: targetId, note: note || null, createdAt: nowIso() };
  db().adminActions.push(row);
  commit();
  return row;
}

/* The audit trail, newest first, with the admin's name. */
function adminActions() {
  return db().adminActions.slice().sort(newestFirst("createdAt")).map(function (a) {
    return Object.assign({}, a, { adminName: rowById("users", a.adminUserId).displayName });
  });
}

function setReviewHidden(adminId, reviewId, hidden) {
  var review = db().reviews.filter(function (r) { return r.id === reviewId; })[0];
  if (!review) { return null; }
  var logged = logAdminAction(adminId, hidden ? "HideReview" : "RestoreReview", "reviews", reviewId);
  if (logged === null) { return null; }
  review.hiddenAt = hidden ? nowIso() : null;
  commit();
  return review;
}

function setCreatorSuspended(adminId, creatorId, suspended) {
  var profile = rowsWhere("creatorProfiles", function (p) { return p.userId === creatorId; })[0];
  if (!profile) { return null; }
  var logged = logAdminAction(adminId, suspended ? "SuspendCreator" : "RestoreCreator", "creator_profiles", creatorId);
  if (logged === null) { return null; }
  profile.suspendedAt = suspended ? nowIso() : null;
  commit();
  return profile;
}

function setCreatorVerified(adminId, creatorId, verified) {
  var profile = rowsWhere("creatorProfiles", function (p) { return p.userId === creatorId; })[0];
  if (!profile) { return null; }
  var logged = logAdminAction(adminId, verified ? "VerifyCreator" : "UnverifyCreator", "creator_profiles", creatorId);
  if (logged === null) { return null; }
  profile.isVerified = verified;
  commit();
  return profile;
}

/* The admin retires a plan, or puts back one that can be sold again. Returns "" when done, or why not. */
function adminSetProductActive(adminId, productId, active) {
  var product = rowById("products", productId);
  if (product === null || !isAdmin(userById(adminId))) { return "Only the admin can do that."; }
  var problem = active ? restoreProblem(product, true) : "";
  if (problem !== "") { return problem; }
  logAdminAction(adminId, active ? "RestoreProduct" : "RetireProduct", "products", productId);
  product.isActive = active;
  commit();
  return "";
}

/* The admin takes a recipe down, out of the store for everyone but its creator and the cooks who bought it
   (3.3: buyers keep it through their snapshots), or puts back one the admin took down. The admin never publishes a creator's draft. Returns "" when done, or why not. */
function adminSetRecipePublished(adminId, recipeId, published) {
  var recipe = rowById("recipes", recipeId);
  if (recipe === null || !isAdmin(userById(adminId))) { return "Only the admin can do that."; }
  if (published && !adminTookDown("recipes", recipeId)) { return "Only its creator can publish \"" + recipe.title + "\"."; }
  if (published && publishProblem(recipe) !== "") { return publishProblem(recipe); }
  logAdminAction(adminId, published ? "PublishRecipe" : "UnpublishRecipe", "recipes", recipeId);
  writeRecipePublished(recipe, published);
  return "";
}

/* The two changes an admin makes to an order: a Paid order is refunded, a Pending one is cancelled.
   Either way the buyer no longer owns what was in it (ownership reads Paid orders only, Q11). */
function setOrderStatus(adminId, orderId, status, note) {
  var order = db().orders.filter(function (o) { return o.id === orderId; })[0];
  var allowed = order && ((order.status === "Paid" && status === "Refunded") ||
                          (order.status === "Pending" && status === "Cancelled"));
  if (!allowed) { return null; }
  var logged = logAdminAction(adminId, status === "Refunded" ? "RefundOrder" : "CancelOrder", "orders", orderId, note);
  if (logged === null) { return null; }
  order.status = status;
  commit();
  return orderWithItems(order);
}

/* Every order in the store with its buyer, newest first, for the admin console. */
function allOrders() {
  return db().orders.slice().sort(newestFirst("placedAt")).map(function (o) {
    return Object.assign(orderWithItems(o), { buyerName: rowById("users", o.userId).displayName });
  });
}

/* ---------- the week: meal_plans and meal_plan_entries (design section 3.9) ----------
   A cook's plan for one week: recipes on dates and meals, each optionally rescaled. Shop this week puts a
   week on the shopping list (shopWeek below), which is what gets shopped. */

var SLOT_ORDER = ["Breakfast", "Lunch", "Dinner", "Snack"];
var MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "June", "July", "Aug", "Sept", "Oct", "Nov", "Dec"];

/* "yyyy-mm-dd" for a local date, and back. Dates are handled as local calendar days, never instants, so a
   week never shifts with the time zone (meal_plans.week_start and meal_plan_entries.planned_date are DATE). */
function isoDate(date) {
  return date.getFullYear() + "-" + String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0");
}

function parseIsoDate(iso) {
  var parts = iso.split("-");
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
}

function addDays(iso, days) {
  var date = parseIsoDate(iso);
  date.setDate(date.getDate() + days);
  return isoDate(date);
}

/* The Monday that starts the week holding a date. A week runs Monday to Sunday, like a plan's day_offset. */
function weekStartOf(date) {
  var monday = new Date(date.getTime());
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return isoDate(monday);
}

/* "Sept 21", for a week's name and the day headings. */
function formatShortDate(iso) {
  var date = parseIsoDate(iso);
  return MONTH_NAMES[date.getMonth()] + " " + date.getDate();
}

/* Today as "yyyy-mm-dd", unless a caller (a test) names the day. */
function todayIso(today) {
  return today || isoDate(new Date());
}

/* A week named for the cook: "This week", "Next week", or "Week of Sept 21, 2026", marked "(past)" once it
   is over, so an old week is never mistaken for the one being cooked. */
function weekLabel(weekStart, today) {
  var current = weekStartOf(parseIsoDate(todayIso(today)));
  if (weekStart === current) { return "This week"; }
  if (weekStart === addDays(current, 7)) { return "Next week"; }
  var text = "Week of " + formatShortDate(weekStart) + ", " + parseIsoDate(weekStart).getFullYear();
  return weekStart < current ? text + " (past)" : text;
}

/* When this week is empty, the week the cook did plan: the nearest one coming up, or else the latest past one.
   null when this week has meals or no other week does. */
function otherPlannedWeek(userId, today) {
  var current = weekStartOf(parseIsoDate(todayIso(today)));
  var planned = plansFor(userId).filter(function (p) { return planEntries(p.id).length > 0; })
    .map(function (p) { return p.weekStart; });
  if (planned.indexOf(current) !== -1) { return null; }
  var upcoming = planned.filter(function (w) { return w > current; }).sort();
  if (upcoming.length) { return upcoming[0]; }
  var past = planned.filter(function (w) { return w < current; }).sort();
  return past.length ? past[past.length - 1] : null;
}

/* The week a whole plan goes on: this week from Monday to Thursday, next week from Friday, when most of this
   week's days are gone. */
function defaultPlanWeek(today) {
  var date = parseIsoDate(todayIso(today));
  var current = weekStartOf(date);
  var day = date.getDay();                                         // 0 is Sunday
  return day >= 1 && day <= 4 ? current : addDays(current, 7);
}

/* The days a single recipe can be put on: today and the days after it. */
function upcomingDays(today, count) {
  var days = [];
  for (var i = 0; i < count; i = i + 1) { days.push(addDays(todayIso(today), i)); }
  return days;
}

function plansFor(userId) {
  return db().mealPlans.filter(function (p) { return p.userId === userId; }).sort(newestFirst("weekStart"));
}

function planFor(userId, weekStart) {
  return plansFor(userId).filter(function (p) { return p.weekStart === weekStart; })[0] || null;
}

/* One plan per user per week (ix_meal_plans_user_id_week_start): made the first time the week is used. */
function ensurePlan(userId, weekStart) {
  var plan = planFor(userId, weekStart);
  if (plan !== null) { return plan; }
  plan = { id: nextId("mealPlans"), userId: userId, name: "Week of " + formatShortDate(weekStart),
    weekStart: weekStart, createdAt: nowIso() };
  db().mealPlans.push(plan);
  commit();
  return plan;
}

/* A plan's entries in calendar order (Q7), each with its recipe's title and servings and the number
   of servings it is planned for. */
function planEntries(planId) {
  return db().mealPlanEntries.filter(function (e) { return e.mealPlanId === planId; })
    .map(function (e) {
      var recipe = rowById("recipes", e.recipeId);
      return Object.assign({}, e, { title: recipe.title, servings: recipe.servings,
        planned: e.servingsOverride === null ? recipe.servings : e.servingsOverride });
    })
    .sort(function (a, b) {
      return a.plannedDate < b.plannedDate ? -1 : a.plannedDate > b.plannedDate ? 1
        : SLOT_ORDER.indexOf(a.slot) - SLOT_ORDER.indexOf(b.slot) || a.id - b.id;
    });
}

/* Put a recipe on a day and meal. Only a recipe the cook may open can be planned (3.3, canPlan); anything
   else returns null and changes nothing. servingsOverride null keeps the recipe's own servings. */
/* Returns null when the cook may not plan the recipe, the people are not a whole number from 1 to 50, or
   the recipe is already on that day and meal (pressing a button twice never doubles a meal). */
function addPlanEntry(userId, weekStart, recipeId, plannedDate, slot, servingsOverride) {
  if (!canPlan(userById(userId), rowById("recipes", recipeId))) { return null; }
  if (servingsOverride !== null && servingsOverride !== undefined && !isPeople(servingsOverride)) { return null; }
  if (entryOn(userId, weekStart, recipeId, plannedDate, slot) !== null) { return null; }
  var plan = ensurePlan(userId, weekStart);
  var entry = { id: nextId("mealPlanEntries"), mealPlanId: plan.id, recipeId: recipeId, plannedDate: plannedDate,
    slot: slot, servingsOverride: servingsOverride === undefined ? null : servingsOverride };
  db().mealPlanEntries.push(entry);
  commit();
  return entry;
}

/* Put a whole plan the cook bought onto a week: each meal of their purchase snapshot (what they own,
   3.3) on week_start + day_offset. A collection has no days, so its recipes go on consecutive dinners. */
function addProductToPlan(userId, weekStart, productId) {
  var item = paidItemsOf(userById(userId)).filter(function (oi) { return oi.productId === productId; })[0];
  if (!item) { return null; }
  var added = [];
  productPlacements(item, weekStart).forEach(function (p) {
    var entry = addPlanEntry(userId, weekStart, p.recipeId, p.plannedDate, p.slot, null);
    if (entry !== null) { added.push(entry); }
  });
  return added;
}

function entryOn(userId, weekStart, recipeId, plannedDate, slot) {
  var plan = planFor(userId, weekStart);
  if (plan === null) { return null; }
  return db().mealPlanEntries.filter(function (e) {
    return e.mealPlanId === plan.id && e.recipeId === recipeId && e.plannedDate === plannedDate && e.slot === slot;
  })[0] || null;
}

/* True when every meal of an owned plan is already on the week. */
function productOnWeek(userId, weekStart, productId) {
  var item = paidItemsOf(userById(userId)).filter(function (oi) { return oi.productId === productId; })[0];
  if (!item) { return false; }
  return productPlacements(item, weekStart).every(function (p) {
    return entryOn(userId, weekStart, p.recipeId, p.plannedDate, p.slot) !== null;
  });
}

function productPlacements(orderItem, weekStart) {
  return db().orderItemRecipes.filter(function (oir) { return oir.orderItemId === orderItem.id; }).sort(bySortOrder)
    .map(function (placement, index) {
      var day = placement.dayOffset === null ? index % 7 : placement.dayOffset;
      return { recipeId: placement.recipeId, plannedDate: addDays(weekStart, day), slot: placement.slot || "Dinner" };
    });
}

/* Move a planned meal to another day and meal, for a number of people (null, or the recipe's own servings,
   means "as written"). A day in another week moves it onto that week's plan. Returns the entry, or null, and
   changes nothing, when the meal is not there, the meal type or the people are not allowed, or the same
   recipe is already on that day and meal (a week never holds a meal twice). */
function movePlanEntry(entryId, plannedDate, slot, servings) {
  var entry = db().mealPlanEntries.filter(function (e) { return e.id === entryId; })[0];
  if (!entry || SLOT_ORDER.indexOf(slot) === -1 || !/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) { return null; }
  if (servings !== null && servings !== undefined && !isPeople(servings)) { return null; }
  var userId = db().mealPlans.filter(function (p) { return p.id === entry.mealPlanId; })[0].userId;
  var week = weekStartOf(parseIsoDate(plannedDate));
  var same = entryOn(userId, week, entry.recipeId, plannedDate, slot);
  if (same !== null && same.id !== entry.id) { return null; }
  var recipe = rowById("recipes", entry.recipeId);
  entry.mealPlanId = ensurePlan(userId, week).id;
  entry.plannedDate = plannedDate;
  entry.slot = slot;
  entry.servingsOverride = servings === null || servings === undefined || servings === recipe.servings ? null : servings;
  commit();
  return entry;
}

function removePlanEntry(entryId) {
  var tables = db();
  tables.mealPlanEntries = tables.mealPlanEntries.filter(function (e) { return e.id !== entryId; });
  commit();
}

/* servings null means "as the recipe is written". */
function setEntryServings(entryId, servings) {
  var entry = db().mealPlanEntries.filter(function (e) { return e.id === entryId; })[0];
  if (!entry || (servings !== null && !isPeople(servings))) { return null; }
  entry.servingsOverride = servings;
  commit();
  return entry;
}

/* What the week's list is built from (Q8 step A): each entry scaled by its planned servings, counting only
   recipes the cook may open. A recipe planned twice counts twice. */
function weekRecipeLines(userId, weekStart) {
  var plan = planFor(userId, weekStart);
  if (plan === null) { return []; }
  var user = userById(userId);
  return planEntries(plan.id)
    .filter(function (e) { return canOpenRecipe(user, rowById("recipes", e.recipeId)); })
    .map(function (e) { return { recipeId: e.recipeId, scale: e.planned / e.servings }; });
}

/* The plans and collections a cook owns: one per product bought in a Paid order, with the recipes of
   the purchase snapshot (what they keep, 3.3). */
function ownedProductsFor(user) {
  var seen = {};
  return paidItemsOf(user).filter(function (oi) {
    if (seen[oi.productId]) { return false; }
    seen[oi.productId] = true;
    return true;
  }).map(function (oi) {
    var recipes = db().orderItemRecipes.filter(function (oir) { return oir.orderItemId === oi.id; }).sort(bySortOrder);
    var distinct = {};
    recipes.forEach(function (r) { distinct[r.recipeId] = true; });
    return { product: rowById("products", oi.productId), orderItemId: oi.id, productTitle: oi.productTitle,
      recipes: recipes, recipeCount: Object.keys(distinct).length,
      mealCount: rowById("products", oi.productId).type === "MealPlan" ? recipes.length : null };
  });
}

/* ---------- the shopping list, from recipes (design section 7) ----------
   Lived in common.js until the week planner; here because it is data logic the tests run without a page. */

/* Each entry is a recipe id, or { recipeId, scale } for a planned meal cooked for more or fewer people
   than the recipe is written for (Q8 step A). */
function collectIngredients(entries) {
  var rows = [];

  for (var i = 0; i < entries.length; i = i + 1) {
    var entry = typeof entries[i] === "number" ? { recipeId: entries[i], scale: 1 } : entries[i];
    var recipe = recipeWithDetails(entry.recipeId);

    for (var j = 0; j < recipe.ingredients.length; j = j + 1) {
      var item = recipe.ingredients[j];
      rows.push({
        ingredientId: item.ingredientId,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        aisle: item.aisle,
        baseServings: recipe.servings,
        lineScale: entry.scale,
        recipeTitle: recipe.title
      });
    }
  }

  return rows;
}

/* Add up the ingredients of the given recipes (ids, or { recipeId, scale } entries). Pass null for
   people to keep each recipe as published or as planned, or a number to cook every recipe for that
   many people.
   Two lines only merge when they share a name AND a unit, which is why the two
   soy sauce entries become one row but the rice and the ginger never combine.
   Each line remembers which recipes it came from. The result is sorted by aisle
   so the list follows a walk through the store. */
function buildShoppingList(entries, people) {
  var rows = collectIngredients(entries);
  var totals = {};
  var list = [];

  for (var i = 0; i < rows.length; i = i + 1) {
    var row = rows[i];
    var scale = row.lineScale;

    if (people !== null) {
      scale = people / row.baseServings;
    }

    var key = row.name + "|" + row.unit;

    if (totals[key] === undefined) {
      totals[key] = { key: key, ingredientId: row.ingredientId, name: row.name, unit: row.unit, aisle: row.aisle, amount: 0, recipes: [] };
      list.push(totals[key]);
    }
    totals[key].amount = totals[key].amount + row.quantity * scale;
    if (totals[key].recipes.indexOf(row.recipeTitle) === -1) {
      totals[key].recipes.push(row.recipeTitle);
    }
  }

  list.sort(function (a, b) {
    if (a.aisle !== b.aisle) {
      return a.aisle < b.aisle ? -1 : 1;
    }
    return a.name < b.name ? -1 : 1;
  });

  return list;
}

/* ---------- shopping lists (design section 3.9) ----------
   A shopping list (a row of shopping_trips) is what a cook buys on one visit to the store: the recipes they mean
   to cook, each for a number of people (shopping_trip_items), and where it is in its life: Building, Shopping
   (in the store), Sent (to Instacart or Favor, read-only from then on), or Done, which keeps it as history. A
   cook has one list at a time: Shop this recipe, Shop this plan and Shop this week add straight to the list
   being built or shopped, and make it when there is none. Saving a recipe or buying a plan puts nothing on a
   list. The lines are computed from the items (Q8's arithmetic), never stored; an ingredient the cook already
   has is skipped (shopping_trip_skips). */

var TRIP_STATUSES = ["Building", "Shopping", "Sent", "Done"];

function tripsFor(userId) {
  return db().shoppingTrips.filter(function (t) { return t.userId === userId; }).sort(newestFirst("createdAt"));
}

function tripById(tripId) {
  return db().shoppingTrips.filter(function (t) { return t.id === tripId; })[0] || null;
}

/* A trip's items with their recipe's title and own servings. */
function tripItems(tripId) {
  return db().shoppingTripItems.filter(function (i) { return i.tripId === tripId; })
    .map(function (i) {
      var recipe = rowById("recipes", i.recipeId);
      return Object.assign({}, i, { title: recipe.title, recipeServings: recipe.servings });
    });
}

/* items: [{ recipeId, servings }]. A recipe the cook may not open is left off (3.3, canPlan). */
function createTrip(userId, name, items) {
  var trip = { id: nextId("shoppingTrips"), userId: userId, name: name, createdAt: nowIso(), status: "Building",
    sentTo: null, completedAt: null };
  db().shoppingTrips.push(trip);
  addTripItems(trip.id, items);
  commit();
  return trip;
}

/* One row per recipe on a trip. A recipe already on the trip is not added again (the caller compares what
   it asked with what came back and says "already on this trip"). A recipe named twice in one call, as a
   plan with oats on two mornings or a week with the same dinner twice, becomes one item whose people are
   summed, so the list still buys enough for both meals. */
function addTripItems(tripId, items) {
  var trip = tripById(tripId);
  if (!tripEditable(trip)) { return []; }
  var user = userById(trip.userId);
  var wanted = [];
  items.forEach(function (item) {
    var recipe = rowById("recipes", item.recipeId);
    if (!canPlan(user, recipe) || tripHasRecipe(tripId, item.recipeId)) { return; }
    if (item.servings && !isPeople(item.servings)) { return; }
    var people = item.servings ? item.servings : recipe.servings;
    var same = wanted.filter(function (w) { return w.recipeId === item.recipeId; })[0];
    if (same) { same.servings = Math.min(LIMITS.servingsMax, same.servings + people); return; }
    wanted.push({ recipeId: item.recipeId, servings: people });
  });
  var added = wanted.map(function (w) {
    var row = { id: nextId("shoppingTripItems"), tripId: tripId, recipeId: w.recipeId, servings: w.servings };
    db().shoppingTripItems.push(row);
    return row;
  });
  commit();
  return added;
}

function tripHasRecipe(tripId, recipeId) {
  return db().shoppingTripItems.some(function (i) { return i.tripId === tripId && i.recipeId === recipeId; });
}

/* The distinct recipes a trip would get from an owned plan that are not on it yet. */
function tripMissingFromProduct(tripId, user, productId) {
  var item = paidItemsOf(user).filter(function (oi) { return oi.productId === productId; })[0];
  if (!item) { return []; }
  var ids = [];
  db().orderItemRecipes.filter(function (oir) { return oir.orderItemId === item.id; }).forEach(function (oir) {
    if (ids.indexOf(oir.recipeId) === -1 && !tripHasRecipe(tripId, oir.recipeId)) { ids.push(oir.recipeId); }
  });
  return ids;
}

/* Every meal of a plan the cook owns, from their purchase snapshot (what they bought, 3.3, not the plan as its
   creator has changed it since), each as the recipe is written. [] for a plan they do not own. */
function snapshotItems(userId, productId) {
  var item = paidItemsOf(userById(userId)).filter(function (oi) { return oi.productId === productId; })[0];
  if (!item) { return []; }
  return db().orderItemRecipes.filter(function (oir) { return oir.orderItemId === item.id; })
    .sort(bySortOrder).map(function (oir) { return { recipeId: oir.recipeId, servings: 0 }; });
}

function addProductToTrip(tripId, productId) {
  return addTripItems(tripId, snapshotItems(tripById(tripId).userId, productId));
}

/* ---------- 3.9: one list at a time ---------- */

/* "Shopping list, Oct 18": a list is named for the day it was started. */
function listName(today) {
  return "Shopping list, " + formatShortDate(todayIso(today));
}

/* The list being built or shopped, or null. A sent or done list is not it. */
function activeListFor(userId) {
  return tripsFor(userId).filter(function (t) { return t.status === "Building" || t.status === "Shopping"; })[0] || null;
}

/* Put recipes ({ recipeId, servings }) on the cook's list, making it when there is none. Returns what Undo
   needs: the list, the item rows this call added, and whether it made the list. null, and nothing changed,
   when none of the recipes is one the cook may open (3.3, canPlan), so no empty list is left behind. */
function shopItems(userId, items, today) {
  var user = userById(userId);
  var allowed = items.filter(function (item) { return canPlan(user, rowById("recipes", item.recipeId)); });
  if (allowed.length === 0) { return null; }
  var trip = activeListFor(userId);
  var created = trip === null;
  if (created) { trip = createTrip(userId, listName(today), []); }
  return { trip: trip, added: addTripItems(trip.id, allowed), created: created };
}

function shopRecipes(userId, items, today) {
  return shopItems(userId, items, today);
}

function shopProduct(userId, productId, today) {
  return shopItems(userId, snapshotItems(userId, productId), today);
}

/* A planned week: each meal for the people it was planned for. null for a week with nothing on it. */
function shopWeek(userId, weekStart, today) {
  var plan = planFor(userId, weekStart);
  if (plan === null) { return null; }
  return shopItems(userId, planEntries(plan.id).map(function (e) {
    return { recipeId: e.recipeId, servings: e.planned };
  }), today);
}

/* Undo one Shop this: take off exactly the items it added; if it made the list, the list goes too. */
function undoShop(result) {
  if (!result || !tripEditable(tripById(result.trip.id))) { return false; }
  var ids = result.added.map(function (row) { return row.id; });
  var tables = db();
  tables.shoppingTripItems = tables.shoppingTripItems.filter(function (i) { return ids.indexOf(i.id) === -1; });
  commit();
  if (result.created && tripItems(result.trip.id).length === 0) { deleteTrip(result.trip.id); }
  return true;
}

/* Every change to a trip's items and skips is refused once the trip is closed (tripEditable). */
function tripOfItem(itemId) {
  var item = db().shoppingTripItems.filter(function (i) { return i.id === itemId; })[0];
  return item ? tripById(item.tripId) : null;
}

function removeTripItem(itemId) {
  if (!tripEditable(tripOfItem(itemId))) { return false; }
  var tables = db();
  tables.shoppingTripItems = tables.shoppingTripItems.filter(function (i) { return i.id !== itemId; });
  commit();
  return true;
}

function setTripItemServings(itemId, servings) {
  var item = db().shoppingTripItems.filter(function (i) { return i.id === itemId; })[0];
  if (!item || !isPeople(servings) || !tripEditable(tripById(item.tripId))) { return null; }
  item.servings = servings;
  commit();
  return item;
}

/* Where the trip is: Building, Shopping, Sent (with the partner's name), or Done, which records when. */
function setTripStatus(tripId, status, sentTo) {
  var trip = tripById(tripId);
  if (trip === null || TRIP_STATUSES.indexOf(status) === -1) { return null; }
  trip.status = status;
  if (status === "Sent") { trip.sentTo = sentTo || trip.sentTo; }
  if (status === "Building" || status === "Shopping") { trip.sentTo = null; }
  trip.completedAt = status === "Done" ? nowIso() : null;
  commit();
  return trip;
}

/* A list can change while it is built or shopped, in the store included. Once sent, the partner is shopping
   it, so it is read-only; once done, it is history. */
function tripEditable(trip) {
  return trip !== null && (trip.status === "Building" || trip.status === "Shopping");
}

/* The ingredients the cook took off a trip's list because they have them. */
function tripSkips(tripId) {
  return db().shoppingTripSkips.filter(function (s) { return s.tripId === tripId; }).map(function (s) { return s.ingredientId; });
}

function setTripSkip(tripId, ingredientId, skipped) {
  if (!tripEditable(tripById(tripId))) { return false; }
  var tables = db();
  tables.shoppingTripSkips = tables.shoppingTripSkips.filter(function (s) { return !(s.tripId === tripId && s.ingredientId === ingredientId); });
  if (skipped) { tables.shoppingTripSkips.push({ tripId: tripId, ingredientId: ingredientId }); }
  commit();
}

/* A done list can be shopped again, but only when the cook has no list going: one list at a time. A sent list
   is finished first, when its items arrive. */
function canShopAgain(trip) {
  return trip !== null && trip.status === "Done" && activeListFor(trip.userId) === null;
}

/* A done list shopped again: a fresh Building list, named for today, with the same recipes and people.
   What the cook had at home last time stays off the list (the skips come along); they can put it back. */
function copyTrip(tripId, today) {
  var trip = tripById(tripId);
  if (!canShopAgain(trip)) { return null; }
  var copy = createTrip(trip.userId, listName(today), tripItems(tripId).map(function (i) {
    return { recipeId: i.recipeId, servings: i.servings };
  }));
  tripSkips(tripId).forEach(function (ingredientId) { setTripSkip(copy.id, ingredientId, true); });
  return copy;
}

/* The ticks made in the store are a per-device convenience, kept apart from the tables, keyed by trip. */
function tripHaveKey(tripId) {
  return "cookfeed.have.trip." + tripId;
}

function deleteTrip(tripId) {
  removeStored(tripHaveKey(tripId));
  var tables = db();
  tables.shoppingTrips = tables.shoppingTrips.filter(function (t) { return t.id !== tripId; });
  tables.shoppingTripItems = tables.shoppingTripItems.filter(function (i) { return i.tripId !== tripId; });
  tables.shoppingTripSkips = tables.shoppingTripSkips.filter(function (s) { return s.tripId !== tripId; });
  commit();
}

/* What a trip's list is built from: each item scaled to its people (Q8 step A), counting only recipes the
   cook may still open. */
function tripRecipeLines(tripId) {
  var trip = tripById(tripId);
  if (trip === null) { return []; }
  var user = userById(trip.userId);
  return tripItems(tripId)
    .filter(function (i) { return canOpenRecipe(user, rowById("recipes", i.recipeId)); })
    .map(function (i) { return { recipeId: i.recipeId, scale: i.servings / i.recipeServings }; });
}

/* A trip's list, split into the lines to buy and the ones the cook skipped because they have them. */
function tripList(tripId) {
  var skips = tripSkips(tripId);
  var all = buildShoppingList(tripRecipeLines(tripId), null);
  return {
    lines: all.filter(function (l) { return skips.indexOf(l.ingredientId) === -1; }),
    skipped: all.filter(function (l) { return skips.indexOf(l.ingredientId) !== -1; })
  };
}
