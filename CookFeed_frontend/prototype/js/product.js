/* Cookfeed prototype - product page (product.html?id=), for meal plans and recipe collections alike.

   What the viewer sees follows rules.js buyState:
     - someone deciding (a guest, or a cook who has not bought it): the price, what it holds, and why buy it;
     - a cook who owns it: no price or sales copy, and Shop this plan and Add to my week at the top, with
       the recipes and the list taken from their purchase (3.3: what they bought, not the plan as it is now);
     - the creator on their own plan, the admin, or a plan no longer for sale: the plan, without a pitch.
   "What you'll buy" is read-only: ticking things off, sending and printing happen on the shopping list
   (list.html), which Shop this plan fills. A ProductOnly recipe the viewer has not bought shows without a
   link and stays off the list (design section 3.3). */

var product = null;
var state = null;

/* "Monday dinner" for a meal plan's placement; nothing for a collection. */
function placementLabel(placement) {
  return placement.dayOffset === null ? "" : DAY_NAMES[placement.dayOffset] + " " + (placement.slot || "Dinner").toLowerCase();
}

function viewerCanOpen(recipeId) {
  return canOpenRecipe(currentUser(), rowById("recipes", recipeId));
}

/* The meals the viewer sees: an owner's purchase snapshot, or the plan as it is for everyone else. */
function viewerPlacements() {
  if (state !== "owned") { return product.recipes; }
  return ownedProductsFor(currentUser()).filter(function (o) { return o.product.id === product.id; })[0].recipes;
}

/* The recipe of every placement the viewer can open, in plan order. A recipe placed twice is listed
   twice, so its ingredients are bought for both meals. */
function shoppableRecipeIds() {
  return viewerPlacements()
    .map(function (placement) { return placement.recipeId; })
    .filter(viewerCanOpen);
}

/* "A", "A and B", "A, B and C". */
function joinWithAnd(items) {
  return items.length > 1 ? items.slice(0, -1).join(", ") + " and " + items[items.length - 1] : items.join("");
}

/* The distinct titles of a list of recipe ids, in order. */
function distinctTitles(ids) {
  var titles = [];
  ids.forEach(function (id) {
    var title = rowById("recipes", id).title;
    if (titles.indexOf(title) === -1) { titles.push(title); }
  });
  return titles;
}

/* The titles of the recipes the viewer cannot open yet. */
function lockedTitles() {
  return distinctTitles(viewerPlacements().map(function (p) { return p.recipeId; }).filter(function (id) { return !viewerCanOpen(id); }));
}

/* True for someone who could still buy it: a guest, or a cook who neither owns nor made it. */
function deciding() {
  return state === "buy" || state === "inCart" || state === "signIn";
}

/* ---------- the header and "what you get" ---------- */

/* The distinct days of a meal plan, in order: "Monday, Wednesday and Thursday". */
function planDays() {
  var days = [];
  product.recipes.forEach(function (placement) {
    var day = DAY_NAMES[placement.dayOffset];
    if (days.indexOf(day) === -1) { days.push(day); }
  });
  return joinWithAnd(days);
}

function renderHeader() {
  var creator = creatorFor(product.creatorId);
  var noun = productNoun(product);

  document.title = product.title + " | Cookfeed";
  document.getElementById("productCover").src = product.coverImageUrl || "";
  document.getElementById("productCover").alt = "Cover of " + product.title;
  document.getElementById("productType").textContent = productTypeLabel(product);
  document.getElementById("productTitle").textContent = product.title;
  document.getElementById("productByline").innerHTML = creatorByline(creator);
  document.getElementById("productDescription").textContent = product.description || "";
  document.getElementById("priceTag").textContent = formatPrice(product.priceCents);
  document.getElementById("priceNote").textContent =
    "One-time purchase · yours to keep · " + productCounts(product);
  document.getElementById("reviewsLink").href = "reviews.html?product=" + product.id;
  document.getElementById("ratingLink").href = "reviews.html?product=" + product.id;
  document.getElementById("ratingLink").textContent = ratingText(product.id);
  document.getElementById("reviewsNoun").textContent = noun;

  // The price shows to someone deciding and to the creator; the pitch only to someone deciding.
  document.getElementById("priceTag").hidden = !(deciding() || state === "yourOwn");
  document.getElementById("priceNote").hidden = !deciding();
  document.getElementById("whatYouGet").hidden = !deciding();
  document.getElementById("ctaFoot").hidden = !deciding();
  document.getElementById("ownerActions").hidden = state !== "owned";

  var items = [];
  items.push("<strong>" + plural(product.recipeCount, "full cooking video", "full cooking videos") + ".</strong> " +
    "Every step is marked in the video, so you can jump straight to the part you are on.");
  if (product.type === "MealPlan") {
    items.push("<strong>Every ingredient for all " + plural(product.mealCount, "meal", "meals") + ",</strong> " +
      "combined and sorted by aisle. Shop this plan puts it all on your shopping list in one press.");
    items.push("<strong>A plan that is already worked out.</strong> Meals on " + planDays() +
      ", chosen so the ingredients overlap and little goes to waste.");
  } else {
    items.push("<strong>Every ingredient for every recipe,</strong> combined and sorted by aisle. " +
      "Shop this collection puts it all on your shopping list in one press.");
    items.push("<strong>Chosen by " + escapeHtml(creator.displayName) + ",</strong> in the order they would cook them.");
  }
  // A product sells only ProductOnly recipes (design section 3.3; the database refuses anything else).
  if (product.recipes.length > 0) {
    items.push("<strong>Recipes you will not find in the feed.</strong> Every recipe in this " + noun +
      " is premium: none of them is free to save.");
  }
  items.push("<strong>Yours to keep.</strong> Pay once. No subscription, and the " + noun + " stays in your account.");

  document.getElementById("valueHeading").textContent = "What your " + formatPrice(product.priceCents) + " gets you";
  document.getElementById("valueList").innerHTML = "<li>" + items.join("</li><li>") + "</li>";
}

/* The buy area, and everything that changes once the viewer owns the product. */
function renderBuy() {
  renderBuyArea(document.getElementById("buyArea"), product, function () {
    state = buyState(currentUser(), product);
  });
}

/* ---------- "What you'll buy": the plan's ingredients, read-only ---------- */

/* A viewer who can open none of the recipes yet gets a sentence about the list instead of an empty table.
   The section is left out for the admin and for a plan no longer for sale that the viewer does not own:
   nobody there is going to buy anything. */
function renderWhatYouBuy() {
  var section = document.getElementById("buySection");
  section.hidden = state === "noShop" || state === "notForSale" || viewerPlacements().length === 0;
  if (section.hidden) { return; }

  var nothingOpen = shoppableRecipeIds().length === 0;
  document.getElementById("listBody").hidden = nothingOpen;
  document.getElementById("listPreview").hidden = !nothingOpen;
  document.getElementById("buyFrom").hidden = nothingOpen;
  if (nothingOpen) {
    document.getElementById("listNote").textContent = "";
    document.getElementById("lockedNote").textContent = "";
    document.getElementById("listPreview").textContent = "Buy it and every ingredient for " +
      (product.type === "MealPlan" ? "all " + plural(product.mealCount, "meal", "meals")
                                   : "all " + plural(product.recipeCount, "recipe", "recipes")) +
      " is listed here, combined, sorted by aisle.";
    return;
  }

  document.getElementById("buyFrom").textContent = "For " + joinWithAnd(distinctTitles(shoppableRecipeIds())) + ".";
  document.getElementById("listNote").textContent = "Amounts as each recipe is written." +
    (state === "owned" ? " Shop this plan puts all of it on your shopping list, where you can change the people." : "");

  document.getElementById("shoppingRows").innerHTML = buildShoppingList(shoppableRecipeIds(), null).map(function (line) {
    return "<tr><td class='qty'>" + formatQuantity(line.amount) + " " + escapeHtml(line.unit) + "</td>" +
      "<td>" + escapeHtml(line.name) + "<span class='cell-note'>" + escapeHtml(line.aisle) + "</span></td>" +
      "<td class='aisle col-wide'>" + escapeHtml(line.aisle) + "</td></tr>";
  }).join("");

  var locked = lockedTitles();
  document.getElementById("lockedNote").textContent = locked.length === 0 ? ""
    : "Not on this list yet: " + joinWithAnd(locked) + ". " + (locked.length === 1 ? "Its" : "Their") +
      " ingredients are added when you buy the " + productNoun(product) + ".";
}

/* ---------- the recipe cards and their hover preview ---------- */

function renderRecipeCards() {
  var placements = viewerPlacements();
  // "Included when you buy" only means something to someone who can buy it.
  var lockText = deciding() ? null : "Premium recipe";
  var html = placements.map(function (placement) {
    var recipe = recipeWithDetails(placement.recipeId);
    return recipeCardHtml(recipe, {
      label: placementLabel(placement),
      productId: product.id,
      productNoun: productNoun(product),
      lockText: lockText,
      preview: true,
      locked: !viewerCanOpen(recipe.id)
    });
  }).join("");

  if (placements.length === 0) {
    html = "<p class='meta'>This " + productNoun(product) + " has no recipes listed.</p>";
  }

  var grid = document.getElementById("planRecipes");
  grid.innerHTML = html;
  document.getElementById("hoverHint").hidden = placements.length === 0 || shoppableRecipeIds().length === 0;
  wirePreviews(grid);
}

/* ---------- start ---------- */

document.addEventListener("DOMContentLoaded", function () {
  var id = queryNumber("id");
  product = id === null ? null : productWithRecipes(id);
  if (product === null) {
    showMissing("Plan not found", "There is no meal plan or collection at this address.");
    return;
  }
  state = buyState(currentUser(), product);

  renderHeader();
  renderBuy();
  renderRecipeCards();
  renderWhatYouBuy();

  wireSaveButtons(document.getElementById("planRecipes"), null);

  // 3.9: every meal the cook bought onto the shopping list, from their purchase snapshot (3.3).
  document.getElementById("shopPlan").addEventListener("click", function () {
    tellShopped(shopProduct(currentUser().id, product.id));
  });
  document.getElementById("planPlan").addEventListener("click", function () { openPlanProductDialog(currentUser(), product); });
});
