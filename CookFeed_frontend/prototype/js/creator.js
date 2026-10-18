/* Cookfeed prototype - creator storefront (creator.html?handle=).

   A storefront lists only the creator's published Public recipes (Q2): drafts are unfinished, and a
   ProductOnly recipe is reached only by buying the product that holds it (design section 3.3). Every
   active product is for sale here, with the same buy area as its own page. */

var creator = null;

function publicRecipes() {
  return rowsWhere("recipes", function (r) {
    return r.creatorId === creator.userId && r.isPublished && r.visibility === "Public";
  }).map(function (r) { return recipeWithDetails(r.id); });
}

/* For sale: active, and the creator is not suspended (3.8). */
function activeProducts() {
  return rowsWhere("products", function (p) { return p.creatorId === creator.userId && isForSale(p); })
    .map(function (p) { return productWithRecipes(p.id); });
}

/* Sort the recipes and redraw them.
   Pass "saves" for the most saved (most popular) first, or "newest" for the most recent. */
function showRecipes(sortBy) {
  var sorted = publicRecipes();

  if (sortBy === "saves") {
    sorted.sort(function (a, b) { return saveCount(b.id) - saveCount(a.id); });
  } else {
    sorted.sort(function (a, b) { return new Date(b.publishedAt) - new Date(a.publishedAt); });
  }

  document.getElementById("creatorRecipes").innerHTML = sorted.map(function (recipe) {
    return recipeCardHtml(recipe, { label: "Published " + formatDate(recipe.publishedAt) });
  }).join("");

  document.getElementById("sortSaves").className = sortBy === "saves" ? "btn-small saved" : "btn-small";
  document.getElementById("sortNewest").className = sortBy === "newest" ? "btn-small saved" : "btn-small";
}

function renderHeader() {
  var recipes = publicRecipes();
  var totalSaves = recipes.reduce(function (sum, r) { return sum + saveCount(r.id); }, 0);

  document.title = creator.handle + " | Cookfeed";
  document.getElementById("creatorAvatar").src = creator.avatarUrl || "";
  document.getElementById("creatorAvatar").alt = "Profile picture for " + creator.handle;
  document.getElementById("creatorName").innerHTML = escapeHtml(creator.displayName) + (creator.isVerified
    ? " <span class='verified' title='Cookfeed has confirmed this creator is who they say they are'>&#10003; Verified creator</span>"
    : "");
  document.getElementById("creatorHandle").textContent = "@" + creator.handle;
  document.getElementById("creatorBio").textContent = creator.bio || "";
  document.getElementById("recipeCount").textContent = recipes.length;
  document.getElementById("totalSaves").textContent = totalSaves.toLocaleString();

  var user = currentUser();
  document.getElementById("ownStorefront").hidden = user === null || user.id !== creator.userId;
  document.getElementById("suspendedNote").hidden = creator.suspendedAt === null;
}

/* One card per product for sale, each with its own buy area. */
function renderProducts() {
  var products = activeProducts();
  var list = document.getElementById("creatorProducts");

  list.innerHTML = products.map(function (product) {
    return "<div class='card product-card' data-product-id='" + product.id + "'>" +
      "<img src='" + escapeHtml(product.coverImageUrl || "") + "' alt=''>" +
      "<div><span class='pill'>" + productTypeLabel(product) + "</span>" +
      "<h3><a href='" + productUrl(product.id) + "'>" + escapeHtml(product.title) + "</a></h3>" +
      "<p class='meta'>" + escapeHtml(product.description || "") + " " + productCounts(product) + ".</p>" +
      "<div class='buybar'><span class='price'>" + formatPrice(product.priceCents) + "</span>" +
      "<span class='buy-area'></span></div></div></div>";
  }).join("") || "<p class='meta'>Nothing for sale right now.</p>";

  products.forEach(function (product) {
    var area = list.querySelector("[data-product-id='" + product.id + "'] .buy-area");
    renderBuyArea(area, product, null);
  });
}

document.addEventListener("DOMContentLoaded", function () {
  var handle = queryText("handle");
  creator = handle === null ? null : creatorByHandle(handle.toLowerCase());
  if (creator === null) {
    showMissing("Creator not found", "There is no creator with this handle.");
    return;
  }

  renderHeader();
  showRecipes("saves");
  renderProducts();

  wireSaveButtons(document.getElementById("creatorRecipes"), renderHeader);
  document.getElementById("sortSaves").addEventListener("click", function () { showRecipes("saves"); });
  document.getElementById("sortNewest").addEventListener("click", function () { showRecipes("newest"); });
});
