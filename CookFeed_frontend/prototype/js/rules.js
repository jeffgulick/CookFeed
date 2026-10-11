/* Cookfeed prototype - the marketplace rules of the design document's section 3, in one place.

   Every page asks these functions what the signed-in account may do, and shows or hides its controls
   from the answer. The API enforces the same rules on every request (and the database refuses the rows
   it must never hold), so these only decide what the screen offers. A user here is userById's shape:
   { id, displayName, roles, handle }, or null for a signed-out visitor. */

function hasRole(user, role) {
  return user !== null && user.roles.indexOf(role) !== -1;
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

/* What the buy area of a product shows:
   noShop      the admin: no shop controls at all (3.1)
   yourOwn     the viewer created it; creators cannot buy their own products (3.1)
   owned       a Paid order holds it
   notForSale  the product is retired
   signIn      a signed-out visitor
   inCart      already in the cart, which holds one copy of each product
   buy         Add to cart */
function buyState(user, product) {
  if (user !== null && !canShop(user)) { return "noShop"; }
  if (user !== null && product.creatorId === user.id) { return "yourOwn"; }
  if (ownsProduct(user, product.id)) { return "owned"; }
  if (!product.isActive) { return "notForSale"; }
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
  if (reviewBy(user.id, productId) !== null) { return "alreadyReviewed"; }
  if (!ownsProduct(user, productId)) { return "mustBuy"; }
  return "canReview";
}
