/* Cookfeed prototype - creator storefront page (kenji-kitchen) */

var followers = 18400;
var following = false;

/* Kenji's published recipes. The draft miso soup is deliberately not here:
   a storefront only shows what the creator has published. */
var creatorRecipes = [
  { title: "Chicken Teriyaki, the Real Way", saves: 733, published: "July 13, 2026", minutes: 20, image: "images/recipe-teriyaki.svg", page: "recipe-teriyaki.html" },
  { title: "Onigiri Three Ways",             saves: 504, published: "July 17, 2026", minutes: 40, image: "images/recipe-onigiri.svg", page: "recipe-onigiri.html" },
  { title: "10-Minute Ginger Garlic Stir-Fry", saves: 387, published: "July 23, 2026", minutes: 13, image: "images/recipe-stirfry.svg", page: "recipe-stirfry.html" }
];

/* Sort the recipes and redraw them.
   Pass "saves" for the most saved first, or "newest" for the most recent. */
function showRecipes(sortBy) {
  var sorted = creatorRecipes.slice();

  if (sortBy === "saves") {
    sorted.sort(function (a, b) { return b.saves - a.saves; });
  } else {
    sorted.sort(function (a, b) { return new Date(b.published) - new Date(a.published); });
  }

  var html = "";
  for (var i = 0; i < sorted.length; i = i + 1) {
    var recipe = sorted[i];
    html = html + "<div class='recipe-card'>";
    html = html + "<a href='" + recipe.page + "'>";
    html = html + "<img src='" + recipe.image + "' alt='" + recipe.title + "'>";
    html = html + "</a>";
    html = html + "<div class='recipe-body'>";
    html = html + "<div class='recipe-title'><a href='" + recipe.page + "'>" + recipe.title + "</a></div>";
    html = html + "<div class='meta'>" + recipe.minutes + " min &middot; " + recipe.saves + " saves</div>";
    html = html + "<div class='meta'>Published " + recipe.published + "</div>";
    html = html + "</div></div>";
  }

  document.getElementById("creatorRecipes").innerHTML = html;

  document.getElementById("sortSaves").className = sortBy === "saves" ? "btn-small saved" : "btn-small";
  document.getElementById("sortNewest").className = sortBy === "newest" ? "btn-small saved" : "btn-small";
}

/* Follow or unfollow the creator and move the follower count. */
function followCreator() {
  var button = document.getElementById("followButton");

  if (following === false) {
    following = true;
    followers = followers + 1;
    button.innerHTML = "Following \u2713";
    button.className = "btn-secondary";
  } else {
    following = false;
    followers = followers - 1;
    button.innerHTML = "Follow";
    button.className = "btn-primary";
  }

  document.getElementById("followerCount").innerHTML = followers.toLocaleString();
}

/* Draw the page in its starting state. */
function startCreatorPage() {
  document.getElementById("followerCount").innerHTML = followers.toLocaleString();
  document.getElementById("planPrice").innerHTML = formatPrice(1299);
  showRecipes("saves");
}
