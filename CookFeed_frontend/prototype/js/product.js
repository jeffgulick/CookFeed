/* Cookfeed prototype - product page (product.html?id=), for meal plans and recipe collections alike.

   Homework 3 interactions on this page:
     1. Servings stepper     - input, click and keyboard events rescale the list live
     2. Recipe card preview  - mouseenter / mouseleave (and focus) show more detail
     3. "Have it" checklist  - change events tick items off and update the progress bar
     4. Add to cart and Save - click events, kept per account across pages and reloads

   What the viewer sees follows rules.js: the buy area comes from buyState, and a ProductOnly recipe
   the viewer has not bought shows without a link and stays off the shopping list (design section 3.3). */

var product = null;

/* null means "show the list as each recipe was published", shown as an empty servings box: the
   recipes do not all serve the same number, so no one number would be true. A number means every
   meal of the plan is cooked for that many people. */
var currentPeople = null;

/* Which shopping-list lines the shopper already has at home, keyed by line.
   Kept separately from the list so ticks survive when the list is rescaled. */
var haveItems = {};

/* "Monday dinner" for a meal plan's placement; nothing for a collection. */
function placementLabel(placement) {
  return placement.dayOffset === null ? "" : DAY_NAMES[placement.dayOffset] + " " + placement.slot.toLowerCase();
}

function viewerCanOpen(recipeId) {
  return canOpenRecipe(currentUser(), rowById("recipes", recipeId));
}

/* The recipe of every placement the viewer can open, in plan order. A recipe placed twice is listed
   twice, so its ingredients are bought for both meals. */
function shoppableRecipeIds() {
  return product.recipes
    .map(function (placement) { return placement.recipeId; })
    .filter(viewerCanOpen);
}

/* "A", "A and B", "A, B and C". */
function joinWithAnd(items) {
  return items.length > 1 ? items.slice(0, -1).join(", ") + " and " + items[items.length - 1] : items.join("");
}

/* The titles of the recipes the viewer cannot open yet. */
function lockedTitles() {
  var titles = [];
  product.recipes.forEach(function (placement) {
    var title = rowById("recipes", placement.recipeId).title;
    if (!viewerCanOpen(placement.recipeId) && titles.indexOf(title) === -1) {
      titles.push(title);
    }
  });
  return titles;
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
    "One-time purchase \u00b7 yours to keep \u00b7 " + productCounts(product) + ", 1 shopping list";
  document.getElementById("reviewsLink").href = "reviews.html?product=" + product.id;
  document.getElementById("ratingLink").href = "reviews.html?product=" + product.id;
  document.getElementById("ratingLink").textContent = ratingText(product.id);
  document.getElementById("reviewsNoun").textContent = noun;

  var items = [];
  items.push("<strong>" + plural(product.recipeCount, "full cooking video", "full cooking videos") + ".</strong> " +
    "Every step is marked in the video, so you can jump straight to the part you are on.");
  if (product.type === "MealPlan") {
    items.push("<strong>One shopping list for all " + plural(product.mealCount, "meal", "meals") + ",</strong> " +
      "scaled to however many people you cook for, sorted by aisle, and ready to print.");
    items.push("<strong>A plan that is already worked out.</strong> Meals on " + planDays() +
      ", chosen so the ingredients overlap and little goes to waste.");
  } else {
    items.push("<strong>One shopping list for every recipe,</strong> scaled to however many people you cook for, " +
      "sorted by aisle, and ready to print.");
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
  renderBuyArea(document.getElementById("buyArea"), product, null);
}

/* ---------- 1. shopping list and servings stepper ---------- */

/* Draw the shopping list, keeping any "have it" ticks the shopper already made. A viewer who can open
   none of the recipes yet gets a sentence about the list instead of an empty table. */
function renderShoppingList() {
  var nothingOpen = shoppableRecipeIds().length === 0 && product.recipes.length > 0;
  document.getElementById("listBody").hidden = nothingOpen;
  document.querySelector(".stepper-row").hidden = nothingOpen;
  document.getElementById("hoverHint").hidden = nothingOpen;
  document.getElementById("listPreview").hidden = !nothingOpen;
  if (nothingOpen) {
    document.getElementById("listHeading").textContent = "Your shopping list comes with the " + productNoun(product);
    document.getElementById("listNote").textContent = "";
    document.getElementById("lockedNote").textContent = "";
    document.getElementById("listPreview").textContent = "Buy it and every ingredient for " +
      (product.type === "MealPlan" ? "all " + plural(product.mealCount, "meal", "meals")
                                   : "all " + plural(product.recipeCount, "recipe", "recipes")) +
      " appears here, combined into one list, sorted by aisle and scaled to however many people you cook for.";
    return;
  }

  var list = buildShoppingList(shoppableRecipeIds(), currentPeople);
  var html = "";

  for (var i = 0; i < list.length; i = i + 1) {
    var line = list[i];
    var have = haveItems[line.key] === true;

    html = html + "<tr class='" + (have ? "have" : "") + "' data-key='" + escapeHtml(line.key) + "'>";
    html = html + "<td class='have-col'><input type='checkbox' aria-label='I already have " +
                  escapeHtml(line.name) + "'" + (have ? " checked" : "") + "></td>";
    html = html + "<td class='qty'>" + formatQuantity(line.amount) + " " + escapeHtml(line.unit) + "</td>";
    html = html + "<td>" + escapeHtml(line.name) + "<span class='cell-note'>" + escapeHtml(line.aisle) + "</span></td>";
    html = html + "<td class='aisle col-wide'>" + escapeHtml(line.aisle) + "</td>";
    html = html + "</tr>";
  }

  document.getElementById("shoppingRows").innerHTML = html;

  var heading = document.getElementById("listHeading");
  var note = document.getElementById("listNote");

  if (currentPeople === null) {
    heading.innerHTML = "Shopping list &mdash; as published";
    var seen = [];
    var servings = shoppableRecipeIds()
      .filter(function (id) { var fresh = seen.indexOf(id) === -1; seen.push(id); return fresh; })
      .map(function (id) { var r = rowById("recipes", id); return r.title + " serves " + r.servings; });
    note.textContent = "Quantities as each recipe was written: " + servings.join("; ") + ".";
  } else {
    var word = currentPeople === 1 ? "person" : "people";
    heading.textContent = "Shopping list for " + currentPeople + " " + word;
    note.textContent = "Scaled from the published servings. Every meal is now cooked for " +
                       currentPeople + " " + word + ".";
  }

  var locked = lockedTitles();
  document.getElementById("lockedNote").textContent = locked.length === 0 ? ""
    : "Not on this list yet: " + joinWithAnd(locked) + ". " + (locked.length === 1 ? "Its" : "Their") +
      " ingredients are added when you buy the " + productNoun(product) + ".";

  updateProgress();
}

/* Read the box and, if it holds a sensible number, rescale the list. When it
   does not, explain why under the box and leave the list as it was. An empty
   box means "as published". */
function applyServingsInput() {
  var input = document.getElementById("servingsInput");
  var error = document.getElementById("servingsError");

  if (input.value.trim() === "") {
    error.textContent = "";
    input.classList.remove("invalid");
    currentPeople = null;
    updateStepperButtons();
    renderShoppingList();
    return;
  }

  var problem = servingsProblem(input.value);

  error.textContent = problem;

  if (problem !== "") {
    input.classList.add("invalid");
    return;
  }

  input.classList.remove("invalid");
  currentPeople = Number(input.value);
  updateStepperButtons();
  renderShoppingList();
}

/* Grey out minus at the bottom of the range and plus at the top. From an empty
   box ("as published") both work. */
function updateStepperButtons() {
  var input = document.getElementById("servingsInput");
  var value = Number(input.value);
  var empty = input.value.trim() === "";
  document.getElementById("servingsDown").disabled = !empty && value <= LIMITS.servingsMin;
  document.getElementById("servingsUp").disabled = !empty && value >= LIMITS.servingsMax;
  document.getElementById("servingsReset").hidden = empty;
}

/* Move the number up or down by one from the minus and plus buttons. From an
   empty box, the first press starts at 2 people. */
function stepServings(change) {
  var input = document.getElementById("servingsInput");
  var value = Number(input.value);

  if (isNaN(value) || input.value.trim() === "") {
    value = 2 - change;
  }

  value = Math.min(LIMITS.servingsMax, Math.max(LIMITS.servingsMin, Math.round(value) + change));
  input.value = value;
  applyServingsInput();
}

/* Go back to the quantities exactly as the creator published them. */
function resetServings() {
  var input = document.getElementById("servingsInput");
  input.value = "";
  input.classList.remove("invalid");
  document.getElementById("servingsError").textContent = "";
  currentPeople = null;
  updateStepperButtons();
  renderShoppingList();
  showToast("Back to the quantities as published.");
}

/* ---------- 2. recipe cards and the hover preview ---------- */

function renderRecipeCards() {
  var html = "";

  for (var i = 0; i < product.recipes.length; i = i + 1) {
    var placement = product.recipes[i];
    var recipe = recipeWithDetails(placement.recipeId);
    html = html + recipeCardHtml(recipe, {
      label: placementLabel(placement),
      productId: product.id,
      productNoun: productNoun(product),
      preview: true,
      locked: !viewerCanOpen(recipe.id)
    });
  }

  if (product.recipes.length === 0) {
    html = "<p class='meta'>This " + productNoun(product) + " has no recipes listed.</p>";
  }

  var grid = document.getElementById("planRecipes");
  grid.innerHTML = html;

  var cards = grid.querySelectorAll(".recipe-card");
  for (var k = 0; k < cards.length; k = k + 1) {
    /* Mouse events: show the preview while the pointer is over the card. Keyboard users get the
       same preview when they tab onto the card's link. */
    cards[k].addEventListener("mouseenter", showPreview);
    cards[k].addEventListener("mouseleave", hidePreview);
    cards[k].addEventListener("focusin", showPreview);
    cards[k].addEventListener("focusout", hidePreview);
  }
}

function showPreview(event) {
  event.currentTarget.classList.add("previewing");
}

function hidePreview(event) {
  event.currentTarget.classList.remove("previewing");
}

/* ---------- 3. "have it" checklist ---------- */

/* One listener on the table handles every checkbox, including the ones drawn
   later when the list is rescaled (event delegation). */
function onHaveChanged(event) {
  if (event.target.type !== "checkbox") {
    return;
  }

  var row = event.target.closest("tr");
  var key = row.getAttribute("data-key");
  var have = event.target.checked;

  if (have) {
    haveItems[key] = true;
  } else {
    delete haveItems[key];
  }

  row.classList.toggle("have", have);
  updateProgress();
}

/* How many lines are still unticked. */
function countRemaining() {
  var boxes = document.querySelectorAll("#shoppingRows input[type='checkbox']");
  var remaining = 0;
  for (var i = 0; i < boxes.length; i = i + 1) {
    if (boxes[i].checked === false) {
      remaining = remaining + 1;
    }
  }
  return remaining;
}

/* Rewrite "N of M items still to buy" and move the progress bar. */
function updateProgress() {
  var total = document.querySelectorAll("#shoppingRows tr").length;
  var remaining = countRemaining();
  var percentDone = total === 0 ? 0 : Math.round(((total - remaining) / total) * 100);
  var text = document.getElementById("listProgressText");

  if (remaining === 0 && total > 0) {
    text.textContent = "You already have everything. Nothing to buy!";
  } else {
    text.textContent = remaining + " of " + total + " items still to buy";
  }

  document.getElementById("listProgressFill").style.width = percentDone + "%";
}

function clearHaveItems() {
  haveItems = {};
  renderShoppingList();
}

/* ---------- sending and printing the list ---------- */

var sendTargets = {
  instacart: { name: "Instacart" },
  favor: { name: "Favor" }
};

/* The delivery partners are not connected yet, so this says what the button
   will do rather than pretending the order went through. */
function sendList(target) {
  var partner = sendTargets[target];
  var remaining = countRemaining();
  showToast("Send to " + partner.name + " is coming soon. Your " + remaining +
            " remaining items are ready to hand over.");
}

/* Printing is real: the print stylesheet leaves only the lines still to buy. */
function printList() {
  if (countRemaining() === 0) {
    showToast("Every item is ticked off, so there is nothing to print.", "error");
    return;
  }
  window.print();
}

/* ---------- start ---------- */

document.addEventListener("DOMContentLoaded", function () {
  var id = queryNumber("id");
  product = id === null ? null : productWithRecipes(id);
  if (product === null) {
    showMissing("Plan not found", "There is no meal plan or collection at this address.");
    return;
  }

  renderHeader();
  renderBuy();
  renderRecipeCards();
  renderShoppingList();
  updateStepperButtons();

  wireSaveButtons(document.getElementById("planRecipes"), null);

  var servingsInput = document.getElementById("servingsInput");
  servingsInput.addEventListener("input", applyServingsInput);
  document.getElementById("servingsDown").addEventListener("click", function () { stepServings(-1); });
  document.getElementById("servingsUp").addEventListener("click", function () { stepServings(1); });
  document.getElementById("servingsReset").addEventListener("click", resetServings);

  document.getElementById("shoppingRows").addEventListener("change", onHaveChanged);
  document.getElementById("clearHave").addEventListener("click", clearHaveItems);

  document.getElementById("sendInstacart").addEventListener("click", function () { sendList("instacart"); });
  document.getElementById("sendFavor").addEventListener("click", function () { sendList("favor"); });
  document.getElementById("printButton").addEventListener("click", printList);
});
