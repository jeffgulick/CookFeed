/* Cookfeed prototype - Recipes (recipes.html): every published recipe, searched and sorted.

   Free (Public) recipes open for anyone, with the same cards as Discover. Premium (ProductOnly) recipes
   are listed too, each naming the plan it is sold in: locked for a viewer who does not own that plan,
   open and "Yours through" for one who does (rules.js canOpenRecipe, design section 3.3). */

var sortBy = "saves";

function matchesSearch(recipe, query) {
  if (query === "") { return true; }
  var creator = creatorFor(recipe.creatorId);
  return recipe.title.toLowerCase().indexOf(query) !== -1 ||
    creator.handle.indexOf(query) !== -1 || creator.displayName.toLowerCase().indexOf(query) !== -1;
}

function sortRecipes(recipes) {
  return recipes.sort(function (a, b) {
    if (sortBy === "saves") {
      return saveCount(b.id) - saveCount(a.id) || (a.publishedAt < b.publishedAt ? 1 : -1);
    }
    return a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : b.id - a.id;
  });
}

/* The active plans that sell a premium recipe. */
function plansSelling(recipeId) {
  return rowsWhere("productRecipes", function (pr) { return pr.recipeId === recipeId; })
    .map(function (pr) { return rowById("products", pr.productId); })
    .filter(function (p, index, all) { return isForSale(p) && all.indexOf(p) === index; });
}

function renderRecipes() {
  var query = document.getElementById("recipeSearch").value.trim().toLowerCase();
  var user = currentUser();
  var published = rowsWhere("recipes", function (r) { return r.isPublished && matchesSearch(r, query); });
  var free = sortRecipes(published.filter(function (r) { return r.visibility === "Public"; }));
  var premium = sortRecipes(published.filter(function (r) { return r.visibility === "ProductOnly"; }));

  document.getElementById("freeRecipes").innerHTML = free.map(function (r) {
    return recipeCardHtml(recipeWithDetails(r.id), { label: "by " + creatorFor(r.creatorId).handle, preview: true });
  }).join("");
  document.getElementById("noFree").hidden = free.length > 0;

  document.getElementById("premiumRecipes").innerHTML = premium.map(function (r) {
    var plans = plansSelling(r.id);
    var links = plans.map(function (p) {
      return "<a href='" + productUrl(p.id) + "'>" + escapeHtml(p.title) + "</a>";
    });
    var locked = !canOpenRecipe(user, r);
    return recipeCardHtml(recipeWithDetails(r.id), {
      label: "by " + creatorFor(r.creatorId).handle,
      preview: !locked,
      locked: locked,
      productId: plans.length ? plans[0].id : undefined,
      foot: "<span class='meta'>" + (links.length ? "In " + links.join(" and ") : "Not for sale right now") + "</span>" +
        (locked ? "" : saveButtonHtml(r))
    });
  }).join("");
  document.getElementById("noPremium").hidden = premium.length > 0;

  document.getElementById("recipeShowing").textContent =
    plural(free.length, "free recipe", "free recipes") + ", " + plural(premium.length, "premium", "premium");

  var buttons = document.querySelectorAll("[data-sort]");
  for (var i = 0; i < buttons.length; i = i + 1) {
    var active = buttons[i].getAttribute("data-sort") === sortBy;
    buttons[i].className = active ? "btn-small saved" : "btn-small";
    buttons[i].setAttribute("aria-pressed", String(active));
  }

  wirePreviews(document.getElementById("freeRecipes"));
  wirePreviews(document.getElementById("premiumRecipes"));
  wireSaveButtons(document.getElementById("freeRecipes"), null);
  wireSaveButtons(document.getElementById("premiumRecipes"), null);
}

document.addEventListener("DOMContentLoaded", function () {
  renderRecipes();
  document.getElementById("recipeSearch").addEventListener("input", renderRecipes);
  document.querySelector(".toolbar").addEventListener("click", function (event) {
    var button = event.target.closest("[data-sort]");
    if (button === null) { return; }
    sortBy = button.getAttribute("data-sort");
    renderRecipes();
  });
});
