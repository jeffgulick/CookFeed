/* Cookfeed prototype - My kitchen page

   Shows the recipes the signed-in account saved and builds one shopping list from all of them, using
   the same function as the product page. Removing a recipe here updates the list straight away. */

/* Saved recipe ids, newest save first. */
function savedRecipeIds() {
  return savesFor(currentUser().id).map(function (save) { return save.recipeId; });
}

function renderSavedRecipes(ids) {
  document.getElementById("savedRecipes").innerHTML = ids.map(function (id) {
    var recipe = recipeWithDetails(id);
    return recipeCardHtml(recipe, {
      foot: "<a class='meta' href='" + recipe.pageUrl + "'>Cook it &rarr;</a>" +
            "<button class='btn-small unsave-button'>Remove</button>"
    });
  }).join("");
  document.getElementById("emptyKitchen").hidden = ids.length > 0;

  document.getElementById("kitchenSummary").textContent = ids.length === 0
    ? "Recipes you save show up here, with one shopping list for all of them."
    : "You have saved " + plural(ids.length, "recipe", "recipes") +
      ". Their ingredients are combined in the shopping list below.";
}

function renderKitchenList(ids) {
  var list = buildShoppingList(ids, null);
  var html = "";

  for (var i = 0; i < list.length; i = i + 1) {
    var line = list[i];
    html = html + "<tr>";
    html = html + "<td class='qty'>" + formatQuantity(line.amount) + " " + escapeHtml(line.unit) + "</td>";
    html = html + "<td>" + escapeHtml(line.name) + "<span class='cell-note'>" +
                  escapeHtml(line.aisle + " \u00b7 for " + line.recipes.join(", ")) + "</span></td>";
    html = html + "<td class='aisle col-wide'>" + escapeHtml(line.recipes.join(", ")) + "</td>";
    html = html + "<td class='aisle col-wide'>" + escapeHtml(line.aisle) + "</td>";
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

  var recipe = rowById("recipes", Number(button.closest(".recipe-card").getAttribute("data-recipe-id")));
  setSaved(currentUser().id, recipe.id, false);
  renderKitchen();
  showToast(recipe.title + " removed. Its ingredients are off your list.");
}

document.addEventListener("DOMContentLoaded", function () {
  var user = currentUser();
  if (user === null || !canShop(user)) {
    document.querySelector("main").innerHTML = "<span class='pill'>My kitchen</span><h1>Your saved recipes</h1>" +
      "<div class='card notice-card'><p>" + (user === null ? signInLink("see the recipes you saved") + "."
        : "Admin accounts do not save recipes.") + "</p></div>";
    return;
  }

  renderKitchen();
  document.getElementById("savedRecipes").addEventListener("click", onKitchenClicked);
  document.getElementById("kitchenPrint").addEventListener("click", function () { window.print(); });
});
