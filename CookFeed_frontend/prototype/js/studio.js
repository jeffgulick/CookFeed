/* Cookfeed prototype - My studio (studio.html), for creators (design section 3.8).

   A creator's own recipes and plans, with the writes db.js offers: draft, edit, publish and unpublish a
   recipe; make it free or premium; create a plan or collection from premium recipes; retire or restore a
   plan; and the sales and reviews of their plans. Every control is offered only for the creator's own
   rows (rules.js canManageRecipe / canManageProduct), and the two database rules of 3.3 are explained
   before they would refuse a change (placementProblem / visibilityProblem). */

var studioUser = null;
var editingRecipeId = null;     // null while the recipe form creates a new one
var editingProductId = null;
var SLOTS = ["Breakfast", "Lunch", "Dinner", "Snack"];

function myRecipes() {
  return rowsWhere("recipes", function (r) { return r.creatorId === studioUser.id; })
    .sort(function (a, b) { return b.id - a.id; });
}

function myProducts() {
  return rowsWhere("products", function (p) { return p.creatorId === studioUser.id; })
    .sort(function (a, b) { return b.id - a.id; })
    .map(function (p) { return productWithRecipes(p.id); });
}

/* The titles of the products that hold a recipe. */
function plansHolding(recipeId) {
  var titles = [];
  rowsWhere("productRecipes", function (pr) { return pr.recipeId === recipeId; }).forEach(function (pr) {
    var title = rowById("products", pr.productId).title;
    if (titles.indexOf(title) === -1) { titles.push(title); }
  });
  return titles;
}

/* A recipe can be published once it has something to cook from. */
function paidSales() {
  return salesFor(studioUser.id).filter(function (s) { return s.status === "Paid"; });
}

/* ---------- the header ---------- */

function renderStats() {
  var recipes = myRecipes();
  var published = recipes.filter(function (r) { return r.isPublished; }).length;
  var products = myProducts();
  var forSale = products.filter(isForSale).length;
  var sales = paidSales();
  var earned = sales.reduce(function (sum, s) { return sum + s.unitPriceCents; }, 0);
  var saves = recipes.reduce(function (sum, r) { return sum + saveCount(r.id); }, 0);

  document.getElementById("studioStats").innerHTML =
    "<div class='stat'><b id='statRecipes'>" + published + "</b><span>published " + plural(published, "recipe", "recipes").replace(/^\d+ /, "") +
    (recipes.length > published ? ", " + plural(recipes.length - published, "draft", "drafts") : "") + "</span></div>" +
    "<div class='stat'><b id='statProducts'>" + forSale + "</b><span>for sale</span></div>" +
    "<div class='stat'><b id='statSales'>" + sales.length + "</b><span>" + (sales.length === 1 ? "sale" : "sales") + "</span></div>" +
    "<div class='stat'><b id='statEarned'>" + formatPrice(earned) + "</b><span>earned</span></div>" +
    "<div class='stat'><b>" + saves + "</b><span>saves of your recipes</span></div>";
  document.getElementById("storefrontLink").href = "creator.html?handle=" + encodeURIComponent(studioUser.handle);
}

/* ---------- recipes ---------- */

function renderRecipes() {
  var html = myRecipes().map(function (recipe) {
    var inPlans = plansHolding(recipe.id);
    var free = recipe.visibility === "Public";
    var freeProblem = free ? "" : visibilityProblem(recipe, "Public");
    var publishHint = creatorPublishProblem(recipe, !recipe.isPublished);
    var note = publishHint || freeProblem;

    return "<tr data-recipe-id='" + recipe.id + "'>" +
      "<td><a href='recipe.html?id=" + recipe.id + "'>" + escapeHtml(recipe.title) + "</a>" +
      "<span class='cell-note'>Serves " + recipe.servings + "</span></td>" +
      "<td><span class='tag " + (recipe.isPublished ? "tag-yes" : "tag-muted") + "'>" + (recipe.isPublished ? "Published" : "Draft") + "</span></td>" +
      "<td><span class='tag " + (free ? "tag-muted" : "tag-premium") + "'>" + (free ? "Free" : "Premium") + "</span></td>" +
      "<td>" + plural(saveCount(recipe.id), "cook", "cooks") + "</td>" +
      "<td>" + (inPlans.length ? escapeHtml(inPlans.join(", ")) : "<span class='meta'>none</span>") + "</td>" +
      "<td class='actions'>" +
      "<button type='button' class='btn-small' data-action='publish'" + (publishHint ? " disabled" : "") + ">" +
        (recipe.isPublished ? "Unpublish" : "Publish") + "</button> " +
      "<button type='button' class='btn-small' data-action='visibility'" + (freeProblem ? " disabled" : "") + ">" +
        (free ? "Make premium" : "Make free") + "</button> " +
      "<button type='button' class='btn-small' data-action='edit'>Edit</button>" +
      // Why a button is off, as text anyone can read (a tooltip never shows on a phone).
      (note ? "<span class='action-note'>" + escapeHtml(note) + "</span>" : "") +
      "</td></tr>";
  }).join("");
  document.getElementById("recipeRows").innerHTML = html || "<tr><td colspan='6' class='meta'>No recipes yet. Start one above.</td></tr>";
}

/* One ingredient line of the editor: ingredient, quantity, unit, preparation. */
function ingredientLineHtml(line) {
  var ingredients = SEED.ingredients.slice().sort(function (a, b) { return a.name < b.name ? -1 : 1; });
  var units = SEED.units;
  return "<div class='ingredient-line'>" +
    "<select aria-label='Ingredient' class='line-ingredient'>" + ingredients.map(function (i) {
      return "<option value='" + i.id + "'" + (line && line.ingredientId === i.id ? " selected" : "") + ">" + escapeHtml(i.name) + "</option>";
    }).join("") + "</select>" +
    "<input type='number' aria-label='Quantity' class='line-quantity' min='0.01' step='0.01' value='" + (line ? line.quantity : 1) + "'>" +
    "<select aria-label='Unit' class='line-unit'>" + units.map(function (u) {
      return "<option value='" + u.id + "'" + (line && line.unitId === u.id ? " selected" : "") + ">" + escapeHtml(u.abbreviation) + "</option>";
    }).join("") + "</select>" +
    "<input type='text' aria-label='Preparation, such as diced' class='line-prep' placeholder='diced, optional' maxlength='80' value='" +
      escapeHtml(line && line.preparation ? line.preparation : "") + "'>" +
    "<button type='button' class='btn-small remove-line' aria-label='Remove this ingredient'>&times;</button>" +
    "</div>";
}

function readIngredientLines() {
  var lines = [];
  var rows = document.querySelectorAll("#ingredientLines .ingredient-line");
  for (var i = 0; i < rows.length; i = i + 1) {
    var quantity = Number(rows[i].querySelector(".line-quantity").value);
    if (!(quantity > 0)) { continue; }
    lines.push({
      ingredientId: Number(rows[i].querySelector(".line-ingredient").value),
      unitId: Number(rows[i].querySelector(".line-unit").value),
      quantity: quantity,
      preparation: rows[i].querySelector(".line-prep").value.trim() || null
    });
  }
  return lines;
}

function openRecipeForm(recipe) {
  editingRecipeId = recipe ? recipe.id : null;
  var form = document.getElementById("recipeForm");
  var details = recipe ? recipeWithDetails(recipe.id) : null;

  document.getElementById("recipeFormHeading").textContent = recipe ? "Edit " + recipe.title : "New recipe";
  document.getElementById("recipeTitle").value = recipe ? recipe.title : "";
  document.getElementById("recipeDescription").value = recipe && recipe.description ? recipe.description : "";
  document.getElementById("recipeServings").value = recipe ? recipe.servings : 4;
  document.getElementById("recipePrep").value = recipe && recipe.prepMinutes !== null ? recipe.prepMinutes : 10;
  document.getElementById("recipeCook").value = recipe && recipe.cookMinutes !== null ? recipe.cookMinutes : 20;
  var visibility = recipe ? recipe.visibility : "Public";
  var radios = form.querySelectorAll("input[name='recipeVisibility']");
  for (var i = 0; i < radios.length; i = i + 1) {
    radios[i].checked = radios[i].value === visibility;
    // A recipe in a plan stays premium (3.3); the radio says why.
    radios[i].disabled = recipe && radios[i].value === "Public" && visibilityProblem(recipe, "Public") !== "";
  }
  var lines = details ? details.ingredients.map(function (line) {
    return { ingredientId: rowsWhere("ingredients", function (i) { return i.name === line.name; })[0].id,
      unitId: rowsWhere("units", function (u) { return u.abbreviation === line.unit; })[0].id,
      quantity: line.quantity, preparation: line.preparation };
  }) : [null];
  document.getElementById("ingredientLines").innerHTML = lines.map(ingredientLineHtml).join("");
  document.getElementById("recipeSteps").value = details ? details.steps.map(function (s) { return s.instruction; }).join("\n") : "";
  document.getElementById("saveRecipe").textContent = recipe ? "Save changes" : "Save as draft";
  clearErrors(form);
  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("recipeTitle").focus();
}

function closeRecipeForm() {
  document.getElementById("recipeForm").hidden = true;
  editingRecipeId = null;
}

function clearErrors(form) {
  var errors = form.querySelectorAll(".field-error");
  for (var i = 0; i < errors.length; i = i + 1) { errors[i].textContent = ""; }
}

function readSteps() {
  return document.getElementById("recipeSteps").value.split("\n")
    .map(function (s) { return s.trim(); })
    .filter(function (s) { return s !== ""; });
}

function onRecipeSubmitted(event) {
  event.preventDefault();
  var form = document.getElementById("recipeForm");
  clearErrors(form);
  var title = document.getElementById("recipeTitle").value.trim();
  var servings = Number(document.getElementById("recipeServings").value);
  var ok = true;

  if (title === "") {
    document.getElementById("recipeTitleError").textContent = "Give the recipe a title.";
    ok = false;
  }
  if (servingsProblem(String(servings)) !== "") {
    document.getElementById("recipeServingsError").textContent = servingsProblem(String(servings));
    ok = false;
  }
  if (!ok) {
    showToast("Please fix the highlighted fields.", "error");
    return;
  }

  var fields = {
    title: title,
    description: document.getElementById("recipeDescription").value.trim() || null,
    servings: servings,
    prepMinutes: Number(document.getElementById("recipePrep").value) || 0,
    cookMinutes: Number(document.getElementById("recipeCook").value) || 0,
    ingredients: readIngredientLines(),
    steps: readSteps()
  };
  var visibility = form.querySelector("input[name='recipeVisibility']:checked").value;

  if (editingRecipeId === null) {
    fields.visibility = visibility;
    var recipe = createRecipe(studioUser.id, fields);
    showToast("\"" + recipe.title + "\" is saved as a draft. Publish it when it is ready.");
  } else {
    updateRecipe(editingRecipeId, fields);
    var problem = setRecipeVisibility(editingRecipeId, visibility);
    showToast(problem !== "" ? problem : "\"" + fields.title + "\" is updated.", problem !== "" ? "error" : undefined);
  }
  closeRecipeForm();
  refreshAll();
  document.getElementById("recipeTable").focus({ preventScroll: true });
}

function onRecipeTableClicked(event) {
  var button = event.target.closest("button[data-action]");
  if (button === null) { return; }
  var recipe = rowById("recipes", Number(button.closest("tr").getAttribute("data-recipe-id")));
  if (!canManageRecipe(studioUser, recipe)) { return; }
  var action = button.getAttribute("data-action");

  if (action === "edit") {
    openRecipeForm(recipe);
  } else if (action === "publish") {
    var publishing = !recipe.isPublished;
    confirmDialog(publishing ? "Publish \"" + recipe.title + "\"? " + (recipe.visibility === "Public"
        ? "Anyone will be able to open and save it." : "Only buyers of a plan it is in will open it.")
      : "Unpublish \"" + recipe.title + "\"? Only you will see it.",
      publishing ? "Publish" : "Unpublish").then(function (ok) {
      if (!ok) { return; }
      var problem = setRecipePublished(recipe.id, publishing);
      refreshAll();
      showToast(problem || (publishing ? "\"" + recipe.title + "\" is published." : "\"" + recipe.title + "\" is a draft again."),
        problem ? "error" : undefined);
    });
  } else if (action === "visibility") {
    var toFree = recipe.visibility === "ProductOnly";
    var savers = saveCount(recipe.id);
    confirmDialog(toFree ? "Make \"" + recipe.title + "\" free? Anyone will be able to open and save it."
        : "Make \"" + recipe.title + "\" premium? Only buyers of a plan it is in will open it." +
          (savers ? " " + plural(savers, "cook who saved it loses", "cooks who saved it lose") + " it until they buy that plan." : ""),
      toFree ? "Make free" : "Make premium").then(function (ok) {
      if (!ok) { return; }
      var problem = setRecipeVisibility(recipe.id, toFree ? "Public" : "ProductOnly");
      refreshAll();
      showToast(problem !== "" ? problem : "\"" + recipe.title + "\" is now " + (toFree ? "free to save." : "premium."),
        problem !== "" ? "error" : undefined);
    });
  }
}

/* ---------- plans and collections ---------- */

function salesOf(productId) {
  return paidSales().filter(function (s) { return s.productId === productId; }).length;
}

function renderProducts() {
  var html = myProducts().map(function (product) {
    var suspended = creatorFor(studioUser.id).suspendedAt !== null;
    var status = !product.isActive ? "<span class='tag tag-muted'>Retired</span>"
      : suspended ? "<span class='tag tag-no'>Not for sale: account suspended</span>"
      : "<span class='tag tag-yes'>For sale</span>";
    return "<tr data-product-id='" + product.id + "'>" +
      "<td><a href='" + productUrl(product.id) + "'>" + escapeHtml(product.title) + "</a></td>" +
      "<td>" + productTypeLabel(product) + "</td>" +
      "<td>" + formatPrice(product.priceCents) + "</td>" +
      "<td>" + productCounts(product) + "</td>" +
      "<td>" + status + "</td>" +
      "<td>" + salesOf(product.id) + "</td>" +
      "<td class='actions'>" +
      "<button type='button' class='btn-small' data-action='active'>" + (product.isActive ? "Retire" : "Restore") + "</button> " +
      "<button type='button' class='btn-small' data-action='edit'>Edit</button> " +
      "<a class='btn-small' href='reviews.html?product=" + product.id + "'>Reviews</a>" +
      "</td></tr>";
  }).join("");
  document.getElementById("productRows").innerHTML = html || "<tr><td colspan='7' class='meta'>Nothing for sale yet.</td></tr>";
}

/* The recipes a plan can hold: the creator's published premium ones. The rest are listed with the reason. */
function renderPlacementList(product) {
  var isMealPlan = document.querySelector("input[name='productType']:checked").value === "MealPlan";
  var current = product ? product.recipes : [];
  var html = myRecipes().map(function (recipe) {
    var problem = placementProblem(recipe);
    var placement = current.filter(function (p) { return p.recipeId === recipe.id; })[0];
    var checked = placement !== undefined;
    var row = "<div class='placement" + (problem ? " placement-off" : "") + "'>" +
      "<label><input type='checkbox' class='place-recipe' value='" + recipe.id + "'" + (checked ? " checked" : "") +
      (problem ? " disabled" : "") + "> " + escapeHtml(recipe.title) + "</label>";
    if (problem) {
      row = row + "<span class='meta'>" + escapeHtml(problem) + "</span>";
    } else if (isMealPlan) {
      row = row + "<select aria-label='Day for " + escapeHtml(recipe.title) + "' class='place-day'>" + DAY_NAMES.map(function (day, i) {
        return "<option value='" + i + "'" + (placement && placement.dayOffset === i ? " selected" : "") + ">" + day + "</option>";
      }).join("") + "</select>" +
      "<select aria-label='Meal for " + escapeHtml(recipe.title) + "' class='place-slot'>" + SLOTS.map(function (slot) {
        return "<option value='" + slot + "'" + (placement && placement.slot === slot ? " selected" : "") + ">" + slot + "</option>";
      }).join("") + "</select>";
    }
    return row + "</div>";
  }).join("");
  document.getElementById("placementList").innerHTML = html || "<p class='meta'>You have no recipes yet.</p>";
}

function openProductForm(product) {
  editingProductId = product ? product.id : null;
  var form = document.getElementById("productForm");
  document.getElementById("productFormHeading").textContent = product ? "Edit " + product.title : "New plan or collection";
  var radios = form.querySelectorAll("input[name='productType']");
  for (var i = 0; i < radios.length; i = i + 1) {
    radios[i].checked = radios[i].value === (product ? product.type : "MealPlan");
    radios[i].disabled = product !== null;   // the type is fixed once sold
  }
  document.getElementById("productTitle").value = product ? product.title : "";
  document.getElementById("productDescription").value = product && product.description ? product.description : "";
  document.getElementById("productPrice").value = product ? (product.priceCents / 100).toFixed(2) : "9.99";
  renderPlacementList(product);
  document.getElementById("saveProduct").textContent = product ? "Save changes" : "Put it on sale";
  clearErrors(form);
  form.hidden = false;
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  document.getElementById("productTitle").focus();
}

function closeProductForm() {
  document.getElementById("productForm").hidden = true;
  editingProductId = null;
}

function readPlacements(isMealPlan) {
  var placements = [];
  var rows = document.querySelectorAll("#placementList .placement");
  for (var i = 0; i < rows.length; i = i + 1) {
    var box = rows[i].querySelector(".place-recipe");
    if (!box.checked) { continue; }
    placements.push({
      recipeId: Number(box.value),
      dayOffset: isMealPlan ? Number(rows[i].querySelector(".place-day").value) : null,
      slot: isMealPlan ? rows[i].querySelector(".place-slot").value : null
    });
  }
  return placements;
}

function onProductSubmitted(event) {
  event.preventDefault();
  var form = document.getElementById("productForm");
  clearErrors(form);
  var type = form.querySelector("input[name='productType']:checked").value;
  var title = document.getElementById("productTitle").value.trim();
  var dollars = Number(document.getElementById("productPrice").value);
  var placements = readPlacements(type === "MealPlan");
  var ok = true;

  if (title === "") { document.getElementById("productTitleError").textContent = "Give it a title."; ok = false; }
  if (isNaN(dollars) || dollars < 0) { document.getElementById("productPriceError").textContent = "Enter a price of 0 or more."; ok = false; }
  if (placements.length === 0) { document.getElementById("placementError").textContent = "Pick at least one recipe."; ok = false; }
  if (!ok) {
    showToast("Please fix the highlighted fields.", "error");
    return;
  }

  var fields = { type: type, title: title, description: document.getElementById("productDescription").value.trim() || null,
    priceCents: Math.round(dollars * 100), placements: placements };
  var problem;
  if (editingProductId === null) {
    var result = createProduct(studioUser.id, fields);
    problem = result.problem || "";
    if (problem === "") { showToast("\"" + title + "\" is on sale."); }
  } else {
    problem = updateProduct(editingProductId, fields);
    if (problem === "") { showToast("\"" + title + "\" is updated. Cooks who already bought it keep what they bought."); }
  }
  if (problem !== "") {
    document.getElementById("placementError").textContent = problem;
    showToast(problem, "error");
    return;
  }
  closeProductForm();
  refreshAll();
  document.getElementById("productTable").focus({ preventScroll: true });
}

function onProductTableClicked(event) {
  var button = event.target.closest("button[data-action]");
  if (button === null) { return; }
  var product = productWithRecipes(Number(button.closest("tr").getAttribute("data-product-id")));
  if (!canManageProduct(studioUser, product)) { return; }

  if (button.getAttribute("data-action") === "edit") {
    openProductForm(product);
    return;
  }
  var retiring = product.isActive;
  confirmDialog(retiring ? "Retire \"" + product.title + "\"? It leaves the store; everyone who bought it keeps it."
                         : "Put \"" + product.title + "\" back on sale?", retiring ? "Retire" : "Restore").then(function (ok) {
    if (!ok) { return; }
    var problem = setProductActive(product.id, !retiring);
    refreshAll();
    showToast(problem || (retiring ? "\"" + product.title + "\" is retired." : "\"" + product.title + "\" is for sale again."),
      problem ? "error" : undefined);
  });
}

/* ---------- sales and reviews ---------- */

function renderSales() {
  var sales = salesFor(studioUser.id);
  var paid = sales.filter(function (s) { return s.status === "Paid"; });
  var earned = paid.reduce(function (sum, s) { return sum + s.unitPriceCents; }, 0);
  document.getElementById("salesSummary").textContent = paid.length === 0
    ? "No sales yet."
    : plural(paid.length, "sale", "sales") + ", " + formatPrice(earned) + " earned. Each line is the price at the time of purchase.";
  document.getElementById("salesRows").innerHTML = sales.map(function (s) {
    return "<tr><td>" + formatDate(s.placedAt) + "</td><td>" + escapeHtml(s.buyerName) + "</td>" +
      "<td>" + escapeHtml(s.productTitle) + "</td><td>" + formatPrice(s.unitPriceCents) + "</td>" +
      "<td><span class='tag " + (s.status === "Paid" ? "tag-yes" : "tag-no") + "'>" + s.status + "</span></td></tr>";
  }).join("") || "<tr><td colspan='5' class='meta'>Nothing sold yet.</td></tr>";
}

function renderReviews() {
  var html = "";
  myProducts().forEach(function (product) {
    reviewsFor(product.id).forEach(function (review) {
      html = html + "<div class='review'><div class='review-head'>" +
        "<span class='reviewer'>" + escapeHtml(review.reviewerName) + "</span>" +
        "<span class='stars' aria-label='" + review.rating + " out of 5 stars'>" + buildStars(review.rating) + "</span>" +
        "<span class='meta'>on " + escapeHtml(product.title) + "</span>" +
        "<span class='review-date'>" + formatDate(review.createdAt) + "</span></div>" +
        "<p>" + escapeHtml(review.body) + "</p></div>";
    });
  });
  document.getElementById("studioReviews").innerHTML = html || "<p class='meta'>No reviews of your plans yet.</p>";
}

function refreshAll() {
  renderStats();
  renderRecipes();
  renderProducts();
  renderSales();
  renderReviews();
}

/* ---------- start ---------- */

document.addEventListener("DOMContentLoaded", function () {
  var user = currentUser();
  if (!isCreator(user)) {
    document.getElementById("studioArea").innerHTML = "<div class='card notice-card'><p>" +
      (user === null ? signInLink("open your studio") + ". The studio is where creators publish recipes and sell plans."
                     : "Only creators have a studio. Sign in as Maria, Kenji or Dan to see one.") + "</p></div>";
    return;
  }
  studioUser = user;
  refreshAll();

  document.getElementById("newRecipe").addEventListener("click", function () { openRecipeForm(null); });
  document.getElementById("recipeForm").addEventListener("submit", onRecipeSubmitted);
  document.getElementById("cancelRecipe").addEventListener("click", closeRecipeForm);
  document.getElementById("addIngredient").addEventListener("click", function () {
    document.getElementById("ingredientLines").insertAdjacentHTML("beforeend", ingredientLineHtml(null));
  });
  document.getElementById("ingredientLines").addEventListener("click", function (event) {
    var remove = event.target.closest(".remove-line");
    if (remove !== null) { remove.closest(".ingredient-line").remove(); }
  });
  document.getElementById("recipeRows").addEventListener("click", onRecipeTableClicked);

  document.getElementById("newProduct").addEventListener("click", function () { openProductForm(null); });
  document.getElementById("productForm").addEventListener("submit", onProductSubmitted);
  document.getElementById("cancelProduct").addEventListener("click", closeProductForm);
  document.getElementById("productTypeField").addEventListener("change", function () {
    renderPlacementList(editingProductId === null ? null : productWithRecipes(editingProductId));
  });
  document.getElementById("productRows").addEventListener("click", onProductTableClicked);
});
