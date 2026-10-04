/* Cookfeed prototype - My kitchen page

   Shows the recipes the shopper saved (from the product page or a recipe page)
   and builds one shopping list from all of them, using the same function as the
   product page. Removing a recipe here updates the list straight away. */

/* Saved recipe ids, newest save first, skipping any recipe no longer in the data. */
function savedRecipeIds() {
  var saves = getSaves().slice();

  saves.sort(function (a, b) { return new Date(b.savedAt) - new Date(a.savedAt); });

  return saves
    .map(function (save) { return save.recipeId; })
    .filter(function (id) { return RECIPES[id] !== undefined; });
}

function renderSavedRecipes(ids) {
  var html = "";

  for (var i = 0; i < ids.length; i = i + 1) {
    var recipe = RECIPES[ids[i]];

    html = html + "<div class='recipe-card' data-recipe-id='" + recipe.id + "'>";
    html = html + "<a href='" + recipe.pageUrl + "'>";
    html = html + "<img src='" + recipe.thumbnailUrl + "' alt='" + escapeHtml(recipe.title) + "'>";
    html = html + "</a>";
    html = html + "<div class='recipe-body'>";
    html = html + "<div class='recipe-title'><a href='" + recipe.pageUrl + "'>" + recipe.title + "</a></div>";
    html = html + "<div class='meta'>Serves " + recipe.servings + " &middot; " +
                  (recipe.prepMinutes + recipe.cookMinutes) + " min &middot; " +
                  recipe.ingredients.length + " ingredients</div>";
    html = html + "<div class='recipe-foot'>";
    html = html + "<a class='meta' href='" + recipe.pageUrl + "'>Cook it &rarr;</a>";
    html = html + "<button class='btn-small unsave-button'>Remove</button>";
    html = html + "</div></div></div>";
  }

  document.getElementById("savedRecipes").innerHTML = html;
  document.getElementById("emptyKitchen").hidden = ids.length > 0;

  var word = ids.length === 1 ? "recipe" : "recipes";
  document.getElementById("kitchenSummary").textContent = ids.length === 0
    ? "Recipes you save show up here, with one shopping list for all of them."
    : "You have saved " + ids.length + " " + word + ". Their ingredients are combined in the shopping list below.";
}

function renderKitchenList(ids) {
  var list = buildShoppingList(ids, null);
  var html = "";

  for (var i = 0; i < list.length; i = i + 1) {
    var line = list[i];
    html = html + "<tr>";
    html = html + "<td class='qty'>" + formatQuantity(line.amount) + " " + line.unit + "</td>";
    html = html + "<td>" + line.name + "</td>";
    html = html + "<td class='aisle'>" + line.recipes.join(", ") + "</td>";
    html = html + "<td class='aisle'>" + line.aisle + "</td>";
    html = html + "</tr>";
  }

  if (list.length === 0) {
    html = "<tr><td colspan='4' class='meta'>Save a recipe and its ingredients will appear here.</td></tr>";
  }

  document.getElementById("kitchenRows").innerHTML = html;
  document.getElementById("kitchenListHeading").textContent = list.length === 0
    ? "Your shopping list is empty"
    : list.length + " items for your saved recipes";
  document.getElementById("kitchenPrint").disabled = list.length === 0;
}

function renderKitchen() {
  var ids = savedRecipeIds();
  renderSavedRecipes(ids);
  renderKitchenList(ids);
}

/* Remove a recipe from the saved list; the shopping list shrinks with it. */
function onKitchenClicked(event) {
  var button = event.target.closest(".unsave-button");
  if (button === null) {
    return;
  }

  var recipe = RECIPES[Number(button.closest(".recipe-card").getAttribute("data-recipe-id"))];
  toggleSave(recipe.id);
  renderKitchen();
  showToast(recipe.title + " removed. Its ingredients are off your list.");
}

document.addEventListener("DOMContentLoaded", function () {
  renderKitchen();
  document.getElementById("savedRecipes").addEventListener("click", onKitchenClicked);
  document.getElementById("kitchenPrint").addEventListener("click", function () { window.print(); });
});
