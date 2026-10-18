/* Cookfeed prototype - the marketplace rules of the design document's section 3, in one place.

   Every page asks these functions what the signed-in account may do, and shows or hides its controls
   from the answer. The API enforces the same rules on every request (and the database refuses the rows
   it must never hold), so these only decide what the screen offers. A user here is userById's shape:
   { id, displayName, roles, handle }, or null for a signed-out visitor. */

function hasRole(user, role) {
  return user !== null && user.roles.indexOf(role) !== -1;
}

/* 3.1 and 3.8: the admin holds Admin alone and runs the Admin console; a creator holds Creator (with
   HomeCook) and runs their studio. */
function isAdmin(user) {
  return hasRole(user, "Admin");
}

function isCreator(user) {
  return hasRole(user, "Creator");
}

/* 3.8: a creator manages only their own recipes and products. The admin manages everyone's from the
   console, but never creates. */
function canManageRecipe(user, recipe) {
  return isCreator(user) && recipe !== null && recipe.creatorId === user.id;
}

function canManageProduct(user, product) {
  return isCreator(user) && product !== null && product.creatorId === user.id;
}

/* 3.8: a suspended creator's products are not for sale, nor is a product with no recipes or one holding a
   recipe that was taken down: nobody pays for something they could not open. Buyers keep what they bought. */
function isForSale(product) {
  var creator = creatorFor(product.creatorId);
  if (!product.isActive || creator === null || creator.suspendedAt !== null) { return false; }
  var placements = rowsWhere("productRecipes", function (pr) { return pr.productId === product.id; });
  return placements.length > 0 && placements.every(function (pr) { return rowById("recipes", pr.recipeId).isPublished; });
}

/* ---------- 3.8: what the creator and the admin may change ---------- */

/* True when the admin's latest word on this row took it down (RetireProduct, UnpublishRecipe): the creator
   cannot put it back, only the admin can. */
function adminTookDown(targetTable, targetId) {
  var latest = db().adminActions.filter(function (a) { return a.targetTable === targetTable && a.targetId === targetId; })
    .sort(function (a, b) { return a.id - b.id; }).pop();
  return latest !== undefined && (latest.action === "RetireProduct" || latest.action === "UnpublishRecipe");
}

/* How many cooks hold this recipe through a Paid order's snapshot. */
function recipeBuyers(recipeId) {
  var paid = db().orders.filter(function (o) { return o.status === "Paid"; }).map(function (o) { return o.id; });
  var buyers = [];
  db().orderItems.forEach(function (oi) {
    if (paid.indexOf(oi.orderId) === -1) { return; }
    var order = db().orders.filter(function (o) { return o.id === oi.orderId; })[0];
    var holds = db().orderItemRecipes.some(function (oir) { return oir.orderItemId === oi.id && oir.recipeId === recipeId; });
    if (holds && buyers.indexOf(order.userId) === -1) { buyers.push(order.userId); }
  });
  return buyers.length;
}

/* The plans (titles) a recipe is placed in. */
function plansHolding(recipeId) {
  var titles = [];
  rowsWhere("productRecipes", function (pr) { return pr.recipeId === recipeId; }).forEach(function (pr) {
    var title = rowById("products", pr.productId).title;
    if (titles.indexOf(title) === -1) { titles.push(title); }
  });
  return titles;
}

/* A recipe is published only with something to cook. */
function publishProblem(recipe) {
  var details = recipeWithDetails(recipe.id);
  if (details.ingredients.length === 0) { return "Add at least one ingredient first: press Edit."; }
  if (details.steps.length === 0) { return "Add at least one step first: press Edit."; }
  return "";
}

/* What stops the creator publishing or unpublishing their recipe; "" when nothing does. A recipe a cook has
   bought stays published (buyers keep what they paid for), and so does one in a plan: take it out of the
   plan first. What the admin took down only the admin can put back. */
function creatorPublishProblem(recipe, publishing) {
  if (publishing) {
    if (adminTookDown("recipes", recipe.id)) { return "Cookfeed took \"" + recipe.title + "\" down, so it cannot be published again from the studio."; }
    return publishProblem(recipe);
  }
  var plans = plansHolding(recipe.id);
  if (plans.length) { return "\"" + recipe.title + "\" is in " + plans.join(" and ") + ". Edit the plan and take it out first."; }
  if (recipeBuyers(recipe.id) > 0) { return "Cooks have bought \"" + recipe.title + "\", so it stays published for them."; }
  return "";
}

/* What stops a plan going back on sale; "" when nothing does. */
function restoreProblem(product, byAdmin) {
  if (!byAdmin && adminTookDown("products", product.id)) { return "Cookfeed retired \"" + product.title + "\", so it cannot go back on sale from the studio."; }
  var placements = rowsWhere("productRecipes", function (pr) { return pr.productId === product.id; });
  if (placements.length === 0) { return "\"" + product.title + "\" has no recipes. Edit it and add at least one first."; }
  var drafts = placements.map(function (pr) { return rowById("recipes", pr.recipeId); }).filter(function (r) { return !r.isPublished; });
  if (drafts.length) { return "\"" + drafts[0].title + "\" in this plan is not published. Take it out, or publish it, first."; }
  return "";
}

/* 3.3, as the database enforces it: a product sells only ProductOnly recipes (the
   product_recipes_product_only trigger), and the studio also asks for a published one, so a buyer never
   pays for a draft. "" means the recipe can go in a product. */
function placementProblem(recipe) {
  if (recipe === null) { return "There is no such recipe."; }
  if (recipe.visibility === "Public") {
    return "\"" + recipe.title + "\" is free to save, so it cannot go in a plan. Make it premium first.";
  }
  if (!recipe.isPublished) { return "\"" + recipe.title + "\" is a draft. Publish it first."; }
  return "";
}

/* 3.3: a recipe in a product cannot be made free (the recipes_in_product_product_only trigger). */
function visibilityProblem(recipe, visibility) {
  if (visibility !== "Public") { return ""; }
  var titles = [];
  rowsWhere("productRecipes", function (pr) { return pr.recipeId === recipe.id; }).forEach(function (pr) {
    var title = rowById("products", pr.productId).title;
    if (titles.indexOf(title) === -1) { titles.push(title); }
  });
  if (titles.length === 0) { return ""; }
  return "\"" + recipe.title + "\" is in " + titles.join(" and ") + ". Take it out first; buyers keep it either way.";
}

/* 3.1: saving, carts, orders and reviews belong to the HomeCook role. Every creator holds it too, so
   creators shop like anyone else; the admin holds no other role, so it never shops. */
function canShop(user) {
  return hasRole(user, "HomeCook");
}

/* The account's Paid order lines. A cancelled order owns nothing. */
function paidItemsOf(user) {
  if (user === null) { return []; }
  var tables = db();
  var paidOrderIds = tables.orders
    .filter(function (o) { return o.userId === user.id && o.status === "Paid"; })
    .map(function (o) { return o.id; });
  return tables.orderItems.filter(function (oi) { return paidOrderIds.indexOf(oi.orderId) !== -1; });
}

function ownsProduct(user, productId) {
  return paidItemsOf(user).some(function (oi) { return oi.productId === productId; });
}

/* The title of the purchase whose snapshot holds this recipe ("Yours through ..."), or null. */
function ownedThrough(user, recipeId) {
  var snapshot = db().orderItemRecipes;
  var items = paidItemsOf(user).filter(function (oi) {
    return snapshot.some(function (oir) { return oir.orderItemId === oi.id && oir.recipeId === recipeId; });
  });
  return items.length ? items[0].productTitle : null;
}

/* 3.3 and Q14: a recipe opens when it is published and Public, or when the viewer's purchase snapshot
   holds it. Its creator can always open it, drafts included. */
function canOpenRecipe(user, recipe) {
  if (recipe === null) { return false; }
  if (user !== null && recipe.creatorId === user.id) { return true; }
  if (!recipe.isPublished) { return false; }
  return recipe.visibility === "Public" || ownedThrough(user, recipe.id) !== null;
}

/* 3.3: saving follows visibility, and only published recipes can be saved. */
function canSave(user, recipe) {
  return canShop(user) && recipe !== null && recipe.isPublished && canOpenRecipe(user, recipe);
}

/* 3.9: a recipe can be planned for the week only by a cook who could save it: a shopper who may open it. */
function canPlan(user, recipe) {
  return canSave(user, recipe);
}

/* What the buy area of a product shows:
   noShop      the admin: no shop controls at all (3.1)
   yourOwn     the viewer created it; creators cannot buy their own products (3.1)
   owned       a Paid order holds it
   notForSale  the product is retired, or its creator is suspended (3.8)
   signIn      a signed-out visitor
   inCart      already in the cart, which holds one copy of each product
   buy         Add to cart */
function buyState(user, product) {
  if (user !== null && !canShop(user)) { return "noShop"; }
  if (user !== null && product.creatorId === user.id) { return "yourOwn"; }
  if (ownsProduct(user, product.id)) { return "owned"; }
  if (!isForSale(product)) { return "notForSale"; }
  if (user === null) { return "signIn"; }
  if (isInCartOf(user.id, product.id)) { return "inCart"; }
  return "buy";
}

/* What the review form shows (3.5: a review needs a Paid order for the product, one per account):
   signIn, noShop, yourOwn, alreadyReviewed, mustBuy, or canReview. */
function reviewState(user, productId) {
  if (user === null) { return "signIn"; }
  if (!canShop(user)) { return "noShop"; }
  if (rowById("products", productId).creatorId === user.id) { return "yourOwn"; }
  if (db().reviews.some(function (r) { return r.userId === user.id && r.productId === productId; })) { return "alreadyReviewed"; }
  if (!ownsProduct(user, productId)) { return "mustBuy"; }
  return "canReview";
}
