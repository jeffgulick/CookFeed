/* Cookfeed prototype - product page (Three Weeknights in Japan)

   Homework 3 interactions on this page:
     1. Servings stepper     - input, click and keyboard events rescale the list live
     2. Recipe card preview  - mouseenter / mouseleave (and focus) show more detail
     3. "Have it" checklist  - change events tick items off and update the progress bar
     4. Add to cart and Save - click events, remembered across pages and reloads */

/* Tooltip on every Save button, so a first-time visitor knows what saving does. */
var SAVE_HINT = "Saving keeps this recipe in your saved recipes and adds its ingredients to your shopping list";

/* null means "show the list as each recipe was published". A number means every
   night of the plan is cooked for that many people. */
var currentPeople = null;

/* Which shopping-list lines the shopper already has at home, keyed by line.
   Kept separately from the list so ticks survive when the list is rescaled. */
var haveItems = {};

/* ---------- building the shopping list ---------- */

/* Every ingredient across the plan's recipes, each tagged with its own recipe's
   servings. The recipes do not all serve the same number (teriyaki and stir-fry
   serve 2, onigiri serves 4), so each line has to be scaled against its own recipe. */
function collectIngredients() {
  var rows = [];

  for (var i = 0; i < PRODUCT.recipes.length; i = i + 1) {
    var recipe = RECIPES[PRODUCT.recipes[i].recipeId];

    for (var j = 0; j < recipe.ingredients.length; j = j + 1) {
      var item = recipe.ingredients[j];
      rows.push({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        aisle: item.aisle,
        baseServings: recipe.servings
      });
    }
  }

  return rows;
}

/* Add up the plan's ingredients for the chosen number of people.
   Two lines only merge when they share a name AND a unit, which is why the two
   soy sauce entries become one row but the rice and the ginger never combine.
   The result is sorted by aisle so the list follows a walk through the store. */
function buildShoppingList(people) {
  var rows = collectIngredients();
  var totals = {};
  var list = [];

  for (var i = 0; i < rows.length; i = i + 1) {
    var row = rows[i];
    var scale = 1;

    if (people !== null) {
      scale = people / row.baseServings;
    }

    var key = row.name + "|" + row.unit;

    if (totals[key] === undefined) {
      totals[key] = { key: key, name: row.name, unit: row.unit, aisle: row.aisle, amount: 0 };
      list.push(totals[key]);
    }
    totals[key].amount = totals[key].amount + row.quantity * scale;
  }

  list.sort(function (a, b) {
    if (a.aisle !== b.aisle) {
      return a.aisle < b.aisle ? -1 : 1;
    }
    return a.name < b.name ? -1 : 1;
  });

  return list;
}

/* Draw the shopping list, keeping any "have it" ticks the shopper already made. */
function renderShoppingList() {
  var list = buildShoppingList(currentPeople);
  var html = "";

  for (var i = 0; i < list.length; i = i + 1) {
    var line = list[i];
    var have = haveItems[line.key] === true;

    html = html + "<tr class='" + (have ? "have" : "") + "' data-key='" + escapeHtml(line.key) + "'>";
    html = html + "<td class='have-col'><input type='checkbox' aria-label='I already have " +
                  escapeHtml(line.name) + "'" + (have ? " checked" : "") + "></td>";
    html = html + "<td class='qty'>" + formatQuantity(line.amount) + " " + line.unit + "</td>";
    html = html + "<td>" + line.name + "</td>";
    html = html + "<td class='aisle'>" + line.aisle + "</td>";
    html = html + "</tr>";
  }

  document.getElementById("shoppingRows").innerHTML = html;

  var heading = document.getElementById("listHeading");
  var note = document.getElementById("listNote");

  if (currentPeople === null) {
    heading.innerHTML = "Shopping list &mdash; as published";
    note.textContent = "Teriyaki and stir-fry serve 2, onigiri serves 4. One list, one grocery trip.";
  } else {
    var word = currentPeople === 1 ? "person" : "people";
    heading.textContent = "Shopping list for " + currentPeople + " " + word;
    note.textContent = "Scaled from the published servings. Every night is now cooked for " +
                       currentPeople + " " + word + ".";
  }

  updateProgress();
}

/* ---------- 1. servings stepper ---------- */

/* Check what the shopper typed. Returns an error message, or "" when the
   value is a whole number of people inside the allowed range. */
function servingsProblem(text) {
  if (text.trim() === "") {
    return "Enter how many people you are cooking for.";
  }

  var people = Number(text);

  if (isNaN(people) || Math.floor(people) !== people) {
    return "Use a whole number of people.";
  }
  if (people < LIMITS.servingsMin || people > LIMITS.servingsMax) {
    return "Choose between " + LIMITS.servingsMin + " and " + LIMITS.servingsMax + " people.";
  }
  return "";
}

/* Read the box and, if it holds a sensible number, rescale the list. When it
   does not, explain why under the box and leave the list as it was. */
function applyServingsInput() {
  var input = document.getElementById("servingsInput");
  var error = document.getElementById("servingsError");
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

/* Grey out minus at the bottom of the range and plus at the top. */
function updateStepperButtons() {
  var value = Number(document.getElementById("servingsInput").value);
  document.getElementById("servingsDown").disabled = value <= LIMITS.servingsMin;
  document.getElementById("servingsUp").disabled = value >= LIMITS.servingsMax;
}

/* Move the number up or down by one from the minus and plus buttons. */
function stepServings(change) {
  var input = document.getElementById("servingsInput");
  var value = Number(input.value);

  if (isNaN(value) || input.value.trim() === "") {
    value = 2;
  }

  value = Math.min(LIMITS.servingsMax, Math.max(LIMITS.servingsMin, Math.round(value) + change));
  input.value = value;
  applyServingsInput();
}

/* Go back to the quantities exactly as the creator published them. */
function resetServings() {
  var input = document.getElementById("servingsInput");
  input.value = 2;
  input.classList.remove("invalid");
  document.getElementById("servingsError").textContent = "";
  currentPeople = null;
  updateStepperButtons();
  renderShoppingList();
  showToast("Back to the quantities as published.");
}

/* ---------- 2. recipe cards and the hover preview ---------- */

/* Draw one card per recipe in the plan. Each card carries a hidden preview with
   the details a shopper wants before clicking through. */
function renderRecipeCards() {
  var html = "";

  for (var i = 0; i < PRODUCT.recipes.length; i = i + 1) {
    var placement = PRODUCT.recipes[i];
    var recipe = RECIPES[placement.recipeId];
    var minutes = recipe.prepMinutes + recipe.cookMinutes;
    var saved = isSaved(recipe.id);

    html = html + "<div class='recipe-card' data-recipe-id='" + recipe.id + "'>";
    html = html + "<a class='card-media' href='" + recipe.pageUrl + "'>";
    html = html + "<img src='" + recipe.thumbnailUrl + "' alt='" + escapeHtml(recipe.title) + "'>";
    html = html + "<div class='preview' aria-hidden='true'>";
    html = html + "<div><b>" + recipe.prepMinutes + " min prep &middot; " + recipe.cookMinutes + " min cook</b></div>";
    html = html + "<div>" + recipe.ingredients.length + " ingredients &middot; " + recipe.steps.length + " steps</div>";
    html = html + "<div class='preview-step'>First: " + recipe.steps[0].instruction + "</div>";
    html = html + "</div></a>";
    html = html + "<div class='recipe-body'>";
    html = html + "<div class='day'>" + DAY_NAMES[placement.dayOffset] + " " + placement.slot.toLowerCase() + "</div>";
    html = html + "<div class='recipe-title'><a href='" + recipe.pageUrl + "'>" + recipe.title + "</a></div>";
    html = html + "<div class='meta'>Serves " + recipe.servings + " &middot; " + minutes + " min</div>";
    html = html + "<div class='recipe-foot'>";
    html = html + "<span class='meta'>saved by <span class='save-count'>" + currentSaveCount(recipe) + "</span> cooks</span>";
    html = html + "<button class='btn-small save-button" + (saved ? " saved" : "") + "' title='" + SAVE_HINT + "'>" +
                  (saved ? "Saved ✓" : "Save recipe") + "</button>";
    html = html + "</div></div></div>";
  }

  document.getElementById("planRecipes").innerHTML = html;

  var cards = document.querySelectorAll("#planRecipes .recipe-card");

  for (var k = 0; k < cards.length; k = k + 1) {
    var card = cards[k];

    /* Mouse events: show the preview while the pointer is over the card. */
    card.addEventListener("mouseenter", showPreview);
    card.addEventListener("mouseleave", hidePreview);

    /* Keyboard users get the same preview when they tab onto the card's link. */
    card.addEventListener("focusin", showPreview);
    card.addEventListener("focusout", hidePreview);

    card.querySelector(".save-button").addEventListener("click", saveRecipe);
  }
}

function showPreview(event) {
  event.currentTarget.classList.add("previewing");
}

function hidePreview(event) {
  event.currentTarget.classList.remove("previewing");
}

/* Save or unsave one recipe. The same saved list is read by the recipe pages. */
function saveRecipe(event) {
  var button = event.currentTarget;
  var card = button.closest(".recipe-card");
  var recipe = RECIPES[Number(card.getAttribute("data-recipe-id"))];
  var nowSaved = toggleSave(recipe.id);

  button.textContent = nowSaved ? "Saved ✓" : "Save recipe";
  button.classList.toggle("saved", nowSaved);
  card.querySelector(".save-count").textContent = currentSaveCount(recipe);

  showToast(nowSaved ? recipe.title + " saved. Its ingredients are now on your shopping list."
                     : recipe.title + " removed from your saved recipes.");
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

/* ---------- 4. add to cart ---------- */

/* Make the buy button match the cart: "Add to cart" or "In cart, go to cart". */
function renderBuyButton() {
  var button = document.getElementById("buyButton");

  if (isInCart(PRODUCT.id)) {
    button.textContent = "In cart ✓ — go to cart";
    button.className = "btn-primary done";
  } else {
    button.textContent = "Add to cart — " + formatPrice(PRODUCT.priceCents);
    button.className = "btn-primary";
  }
}

function onBuyClicked() {
  if (isInCart(PRODUCT.id)) {
    window.location.href = "cart.html";
    return;
  }

  addProductToCart(PRODUCT.id);
  renderBuyButton();
  showToast(PRODUCT.title + " added. Your shopping list is waiting in the cart.");
}

/* Show the plan's average rating next to the creator's name. */
function renderRatingLink() {
  var reviews = getAllReviews(PRODUCT.id);
  var link = document.getElementById("ratingLink");

  if (reviews.length === 0) {
    link.textContent = "no reviews yet";
    return;
  }

  var total = 0;
  for (var i = 0; i < reviews.length; i = i + 1) {
    total = total + reviews[i].rating;
  }
  var average = total / reviews.length;
  link.textContent = "★ " + average.toFixed(1) + " (" + reviews.length + " reviews)";
}

/* ---------- start ---------- */

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("priceTag").textContent = formatPrice(PRODUCT.priceCents);
  renderBuyButton();
  renderRatingLink();
  renderRecipeCards();
  renderShoppingList();
  updateStepperButtons();

  document.getElementById("buyButton").addEventListener("click", onBuyClicked);

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
