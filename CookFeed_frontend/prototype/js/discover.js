/* Cookfeed prototype - Discover, the home page

   Three lists from the store: the plans and collections for sale, the trending recipes, and the
   creators. Trending follows Q3: published Public recipes, most saved first, newest first on a tie.
   ProductOnly recipes never appear in the feed (design section 3.3). */

var TRENDING_COUNT = 6;

function renderProducts() {
  // For sale: active, and the creator is not suspended (3.8).
  var products = rowsWhere("products", isForSale).map(function (p) { return productWithRecipes(p.id); });
  document.getElementById("discoverProducts").innerHTML = products.map(productTileHtml).join("");
}

function renderTrending() {
  var recipes = rowsWhere("recipes", function (r) { return r.isPublished && r.visibility === "Public"; })
    .sort(function (a, b) {
      return saveCount(b.id) - saveCount(a.id) || (a.publishedAt < b.publishedAt ? 1 : -1);
    })
    .slice(0, TRENDING_COUNT);

  document.getElementById("trendingRecipes").innerHTML = recipes.map(function (r) {
    return recipeCardHtml(recipeWithDetails(r.id), { label: "by " + creatorFor(r.creatorId).handle, preview: true });
  }).join("");
}

function renderCreators() {
  document.getElementById("discoverCreators").innerHTML = rowsWhere("creatorProfiles", function () { return true; }).map(function (profile) {
    var creator = creatorFor(profile.userId);
    return "<a class='card creator-tile' href='creator.html?handle=" + encodeURIComponent(creator.handle) + "'>" +
      "<img src='" + escapeHtml(creator.avatarUrl || "") + "' alt=''>" +
      "<span><strong>" + escapeHtml(creator.displayName) + "</strong>" +
      (creator.isVerified ? " <span class='verified'>&#10003;</span>" : "") + "<br>" +
      "<span class='handle'>@" + escapeHtml(creator.handle) + "</span></span></a>";
  }).join("");
}

document.addEventListener("DOMContentLoaded", function () {
  var user = currentUser();
  document.getElementById("greeting").textContent = user === null
    ? "Short cooking videos, real recipes, and one shopping list for the week."
    : "Welcome back, " + user.displayName.split(" ")[0] + ".";

  renderProducts();
  renderTrending();
  renderCreators();

  var grid = document.getElementById("trendingRecipes");
  wirePreviews(grid);
  wireSaveButtons(grid, null);
});
