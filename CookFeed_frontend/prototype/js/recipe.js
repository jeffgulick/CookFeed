/* Cookfeed prototype - recipe page (recipe.html?id=, with &product= when opened from a plan).

   The recipe opens only for a viewer rules.js lets in: published and Public, bought through a plan, or
   the viewer's own (design section 3.3). Anyone else sees which plan includes it. */

var currentRecipe = null;
var currentServings = 0;

/* Turn a number of seconds into the clock format a video player shows. */
function formatTime(seconds) {
  var minutes = Math.floor(seconds / 60);
  var rest = seconds % 60;
  if (rest < 10) {
    return minutes + ":0" + rest;
  }
  return minutes + ":" + rest;
}

/* Draw the ingredient list for however many people the cook is feeding. */
function renderIngredients(people) {
  var html = "";

  for (var i = 0; i < currentRecipe.ingredients.length; i = i + 1) {
    var item = currentRecipe.ingredients[i];
    var amount = item.quantity * people / currentRecipe.servings;
    var note = item.preparation === null ? "" : ", " + item.preparation;

    html = html + "<li><strong>" + formatQuantity(amount) + " " + escapeHtml(item.unit) + "</strong> ";
    html = html + escapeHtml(item.name + note) + "</li>";
  }

  if (currentRecipe.ingredients.length === 0) {
    html = "<li class='meta'>No ingredients yet.</li>";
  }

  document.getElementById("ingredientList").innerHTML = html;
  document.getElementById("servingsLabel").textContent = people;
}

/* ---------- servings box ----------
   The same minus / plus box as the product page. Typing or clicking rescales
   the ingredient list straight away; anything outside 1-20 gets a message. */

function updateServingsButtons() {
  var value = Number(document.getElementById("servingsInput").value);
  document.getElementById("servingsDown").disabled = value <= LIMITS.servingsMin;
  document.getElementById("servingsUp").disabled = value >= LIMITS.servingsMax;
}

function applyRecipeServings() {
  var input = document.getElementById("servingsInput");
  var problem = servingsProblem(input.value);

  document.getElementById("servingsError").textContent = problem;
  input.classList.toggle("invalid", problem !== "");

  if (problem !== "") {
    return;
  }

  currentServings = Number(input.value);
  updateServingsButtons();
  renderIngredients(currentServings);
}

function stepRecipeServings(change) {
  var input = document.getElementById("servingsInput");
  var value = Number(input.value);

  if (isNaN(value) || input.value.trim() === "") {
    value = currentRecipe.servings;
  }

  input.value = Math.min(LIMITS.servingsMax, Math.max(LIMITS.servingsMin, Math.round(value) + change));
  applyRecipeServings();
}

function resetRecipeServings() {
  document.getElementById("servingsInput").value = currentRecipe.servings;
  applyRecipeServings();
}

/* ---------- the mock video and the steps ---------- */

/* Move the video to the moment a step happens and highlight that step. */
function jumpToStep(seconds, stepNumber) {
  var percent = (seconds / currentRecipe.videoSeconds) * 100;

  document.getElementById("videoTime").textContent =
    formatTime(seconds) + " / " + formatTime(currentRecipe.videoSeconds);
  document.getElementById("videoProgress").style.width = percent + "%";
  document.getElementById("videoLabel").textContent = "Step " + stepNumber + " of " + currentRecipe.steps.length;

  var steps = document.querySelectorAll("#stepList .step");
  for (var i = 0; i < steps.length; i = i + 1) {
    steps[i].classList.toggle("playing", steps[i].getAttribute("data-step") === String(stepNumber));
  }
}

/* Draw the numbered steps, each one able to move the video. */
function renderSteps() {
  var html = "";

  for (var i = 0; i < currentRecipe.steps.length; i = i + 1) {
    var step = currentRecipe.steps[i];

    html = html + "<li class='step' data-step='" + step.stepNumber + "'>";
    html = html + "<div>" + escapeHtml(step.instruction) + "</div>";
    if (step.videoTimestampSeconds !== null) {
      html = html + "<button class='btn-small' data-seconds='" + step.videoTimestampSeconds +
                    "' data-step='" + step.stepNumber + "'>";
      html = html + "Watch at " + formatTime(step.videoTimestampSeconds) + "</button>";
    }
    html = html + "</li>";
  }

  document.getElementById("stepList").innerHTML = html;
}

/* One listener for every "Watch at" button. */
function onStepClicked(event) {
  var button = event.target.closest("button[data-step]");
  if (button !== null) {
    jumpToStep(Number(button.getAttribute("data-seconds")), Number(button.getAttribute("data-step")));
  }
}

/* ---------- saving ---------- */

/* The save button follows canSave: a guest gets a sign-in link, the admin gets nothing. */
function renderSaveState() {
  var user = currentUser();
  var area = document.getElementById("saveArea");

  document.getElementById("savedBy").textContent = savedByText(saveCount(currentRecipe.id));

  if (user === null) {
    area.innerHTML = signInLink("save");
    return;
  }
  if (!canSave(user, currentRecipe)) {
    area.innerHTML = "";
    return;
  }
  var saved = isSavedBy(user.id, currentRecipe.id);
  area.innerHTML = "<button type='button' id='saveButton' class='" + (saved ? "btn-secondary" : "btn-primary") +
    "' title='" + SAVE_HINT + "'>" + (saved ? "Saved &#10003;" : "Save recipe") + "</button>";
  document.getElementById("saveButton").addEventListener("click", saveThisRecipe);
}

function saveThisRecipe() {
  var user = currentUser();
  var nowSaved = !isSavedBy(user.id, currentRecipe.id);
  setSaved(user.id, currentRecipe.id, nowSaved);
  renderSaveState();
  showToast(nowSaved ? "Saved to My kitchen."
                     : "Removed from your saved recipes.");
}

/* ---------- the header ---------- */

/* When the page was opened from a plan that holds this recipe, the crumb leads back to it and the
   pill names the day. Otherwise the crumb leads to the creator. */
function renderHeader() {
  var creator = creatorFor(currentRecipe.creatorId);
  var productId = queryNumber("product");
  var product = productId === null ? null : productWithRecipes(productId);
  var placement = product === null ? null
    : product.recipes.filter(function (p) { return p.recipeId === currentRecipe.id; })[0] || null;
  var user = currentUser();

  document.title = currentRecipe.title + " | Cookfeed";
  document.getElementById("recipeTitle").textContent = currentRecipe.title;
  document.getElementById("recipeByline").innerHTML = creatorByline(creator);
  document.getElementById("recipeDescription").textContent = currentRecipe.description || "";
  // A draft may not have a thumbnail yet; the player then shows only its controls.
  var image = document.getElementById("recipeImage");
  image.hidden = !currentRecipe.thumbnailUrl;
  if (currentRecipe.thumbnailUrl) {
    image.src = currentRecipe.thumbnailUrl;
  } else {
    image.removeAttribute("src");
  }
  image.alt = currentRecipe.title;
  document.getElementById("servesCount").textContent = currentRecipe.servings;
  document.getElementById("totalTime").textContent = (currentRecipe.prepMinutes || 0) + (currentRecipe.cookMinutes || 0);

  var crumb = document.getElementById("recipeCrumb");
  var pill = document.getElementById("recipePill");
  var foot = document.getElementById("recipeFoot");

  if (placement !== null) {
    var day = placement.dayOffset === null ? "" : DAY_NAMES[placement.dayOffset] + " " + placement.slot.toLowerCase();
    crumb.innerHTML = "<a href='" + productUrl(product.id) + "'>" + escapeHtml(product.title) + "</a>" +
      (day ? " &rsaquo; " + escapeHtml(day) : "");
    pill.textContent = day || productTypeLabel(product);
    foot.innerHTML = "<p><strong>One of " + productCounts(product) + " in " + escapeHtml(product.title) + ".</strong></p>" +
      "<p><a href='" + productUrl(product.id) + "'>&larr; Back to " + escapeHtml(product.title) + "</a></p>";
  } else {
    crumb.innerHTML = "<a href='creator.html?handle=" + encodeURIComponent(creator.handle) + "'>" +
      escapeHtml(creator.displayName) + "</a> &rsaquo; Recipes";
    pill.textContent = currentRecipe.isPublished ? "Recipe" : "Draft";
    foot.innerHTML = "<p><strong>More from " + escapeHtml(creator.displayName) + "</strong></p>" +
      "<p><a href='creator.html?handle=" + encodeURIComponent(creator.handle) + "'>See every recipe from " +
      escapeHtml(creator.handle) + " &rarr;</a></p>";
  }

  var note = document.getElementById("ownedNote");
  var through = currentRecipe.visibility === "ProductOnly" ? ownedThrough(user, currentRecipe.id) : null;
  if (!currentRecipe.isPublished) {
    note.textContent = "A draft. Only you can see it until you publish it.";
    note.hidden = false;
  } else if (through !== null) {
    note.textContent = "Yours through " + through;
    note.hidden = false;
  } else if (currentRecipe.visibility === "ProductOnly" && user !== null && currentRecipe.creatorId === user.id) {
    note.textContent = "Only buyers of your plans can open this recipe.";
    note.hidden = false;
  }
}

/* The active products whose recipes include this one, for the locked notice. */
function productsWith(recipeId) {
  return rowsWhere("productRecipes", function (pr) { return pr.recipeId === recipeId; })
    .map(function (pr) { return rowById("products", pr.productId); })
    .filter(function (p, index, all) { return p.isActive && all.indexOf(p) === index; });
}

function showLocked(recipe) {
  var links = productsWith(recipe.id).map(function (p) {
    return "<a href='" + productUrl(p.id) + "'>" + escapeHtml(p.title) + "</a>";
  });
  var where = links.length ? " It comes with " + links.join(" and ") + "." : "";
  showMissing(recipe.title, "&#128274; This recipe is only for cooks who bought the plan it is in." + where);
}

/* ---------- start ---------- */

document.addEventListener("DOMContentLoaded", function () {
  var id = queryNumber("id");
  var row = id === null ? null : rowById("recipes", id);
  var user = currentUser();

  // A draft is visible only to its creator; to anyone else it does not exist.
  if (row === null || (!row.isPublished && !canOpenRecipe(user, row))) {
    showMissing("Recipe not found", "There is no recipe at this address.");
    return;
  }
  if (!canOpenRecipe(user, row)) {
    showLocked(row);
    return;
  }

  currentRecipe = recipeWithDetails(id);
  currentServings = currentRecipe.servings;

  renderHeader();
  document.getElementById("videoTime").textContent = "0:00 / " + formatTime(currentRecipe.videoSeconds);
  renderSaveState();
  renderIngredients(currentServings);
  renderSteps();

  document.getElementById("servingsInput").value = currentRecipe.servings;
  document.getElementById("servingsReset").textContent = "Reset to " + currentRecipe.servings + " as written";
  updateServingsButtons();

  document.getElementById("servingsInput").addEventListener("input", applyRecipeServings);
  document.getElementById("servingsDown").addEventListener("click", function () { stepRecipeServings(-1); });
  document.getElementById("servingsUp").addEventListener("click", function () { stepRecipeServings(1); });
  document.getElementById("servingsReset").addEventListener("click", resetRecipeServings);
  document.getElementById("stepList").addEventListener("click", onStepClicked);
});
