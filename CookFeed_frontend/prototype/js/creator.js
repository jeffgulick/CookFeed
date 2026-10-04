/* Cookfeed prototype - creator storefront page (kenji-kitchen) */

var followers = CREATOR.followerCount;
var following = false;

/* Kenji's published recipes, read from data.js. The draft miso soup is
   deliberately not in the data: a storefront only shows what is published. */
function publishedRecipes() {
  var list = [];
  for (var id in RECIPES) {
    if (RECIPES[id].creatorId === CREATOR.userId && RECIPES[id].isPublished === true) {
      list.push(RECIPES[id]);
    }
  }
  return list;
}

/* Sort the recipes and redraw them.
   Pass "saves" for the most saved first, or "newest" for the most recent. */
function showRecipes(sortBy) {
  var sorted = publishedRecipes();

  if (sortBy === "saves") {
    sorted.sort(function (a, b) { return currentSaveCount(b) - currentSaveCount(a); });
  } else {
    sorted.sort(function (a, b) { return new Date(b.publishedAt) - new Date(a.publishedAt); });
  }

  var html = "";
  for (var i = 0; i < sorted.length; i = i + 1) {
    var recipe = sorted[i];
    html = html + "<div class='recipe-card'>";
    html = html + "<a href='" + recipe.pageUrl + "'>";
    html = html + "<img src='" + recipe.thumbnailUrl + "' alt='" + escapeHtml(recipe.title) + "'>";
    html = html + "</a>";
    html = html + "<div class='recipe-body'>";
    html = html + "<div class='recipe-title'><a href='" + recipe.pageUrl + "'>" + recipe.title + "</a></div>";
    html = html + "<div class='meta'>" + (recipe.prepMinutes + recipe.cookMinutes) + " min &middot; " +
                  currentSaveCount(recipe) + " saves</div>";
    html = html + "<div class='meta'>Published " + formatDate(recipe.publishedAt) + "</div>";
    html = html + "</div></div>";
  }

  document.getElementById("creatorRecipes").innerHTML = html;

  document.getElementById("sortSaves").className = sortBy === "saves" ? "btn-small saved" : "btn-small";
  document.getElementById("sortNewest").className = sortBy === "newest" ? "btn-small saved" : "btn-small";
}

/* Follow or unfollow the creator and move the follower count. */
function followCreator() {
  var button = document.getElementById("followButton");

  following = !following;
  followers = following ? followers + 1 : followers - 1;
  button.textContent = following ? "Following ✓" : "Follow";
  button.className = following ? "btn-secondary" : "btn-primary";

  document.getElementById("followerCount").textContent = followers.toLocaleString();
}

document.addEventListener("DOMContentLoaded", function () {
  var recipes = publishedRecipes();
  var totalSaves = 0;
  for (var i = 0; i < recipes.length; i = i + 1) {
    totalSaves = totalSaves + currentSaveCount(recipes[i]);
  }

  document.getElementById("followerCount").textContent = followers.toLocaleString();
  document.getElementById("recipeCount").textContent = recipes.length;
  document.getElementById("totalSaves").textContent = totalSaves.toLocaleString();
  document.getElementById("planPrice").textContent = formatPrice(PRODUCT.priceCents);
  showRecipes("saves");

  document.getElementById("followButton").addEventListener("click", followCreator);
  document.getElementById("sortSaves").addEventListener("click", function () { showRecipes("saves"); });
  document.getElementById("sortNewest").addEventListener("click", function () { showRecipes("newest"); });
});
