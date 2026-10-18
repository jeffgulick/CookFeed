/* Cookfeed prototype - Recipes (recipes.html): every free recipe, searched and sorted.

   Only free (Public) recipes are listed, with the same cards as Discover. A premium (ProductOnly) recipe is
   sold inside a plan or collection, so it is shown only on that plan's page, and in the kitchen of a cook who
   bought it (design section 3.3). Listing it here, even locked, would give away what the plan sells. */

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

function renderRecipes() {
  var query = document.getElementById("recipeSearch").value.trim().toLowerCase();
  var free = sortRecipes(rowsWhere("recipes", function (r) {
    return r.isPublished && r.visibility === "Public" && matchesSearch(r, query);
  }));

  document.getElementById("freeRecipes").innerHTML = free.map(function (r) {
    return recipeCardHtml(recipeWithDetails(r.id), { label: "by " + creatorFor(r.creatorId).handle, preview: true });
  }).join("");
  document.getElementById("noFree").hidden = free.length > 0;
  document.getElementById("recipeShowing").textContent = plural(free.length, "free recipe", "free recipes");

  var buttons = document.querySelectorAll("[data-sort]");
  for (var i = 0; i < buttons.length; i = i + 1) {
    var active = buttons[i].getAttribute("data-sort") === sortBy;
    buttons[i].className = active ? "btn-small saved" : "btn-small";
    buttons[i].setAttribute("aria-pressed", String(active));
  }

  // The cards are new on every search and sort, so their previews are wired again. The Save buttons are not:
  // one listener on the grid serves every card, and wiring it again would answer one press more than once.
  wirePreviews(document.getElementById("freeRecipes"));
}

document.addEventListener("DOMContentLoaded", function () {
  renderRecipes();
  wireSaveButtons(document.getElementById("freeRecipes"), null);
  document.getElementById("recipeSearch").addEventListener("input", renderRecipes);
  document.querySelector(".toolbar").addEventListener("click", function (event) {
    var button = event.target.closest("[data-sort]");
    if (button === null) { return; }
    sortBy = button.getAttribute("data-sort");
    renderRecipes();
  });
});
