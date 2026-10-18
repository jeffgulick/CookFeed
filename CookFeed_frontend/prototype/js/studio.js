/* Cookfeed prototype - My studio (studio.html), for creators (design section 3.8).

   A creator's own recipes and plans, with the writes db.js offers: draft, edit, publish and unpublish a
   recipe; make it free or premium; create a plan or collection from premium recipes; retire or restore a
   plan; and the sales and reviews of their plans. Every control is offered only for the creator's own
   rows (rules.js canManageRecipe / canManageProduct), and the two database rules of 3.3 are explained
   before they would refuse a change (placementProblem / visibilityProblem). */

var studioUser = null;
var editingRecipeId = null;     // null while the recipe form creates a new one
var editingProductId = null;
var originalVisibility = null;  // free or premium when the recipe form opened
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
    ", free and premium" + (recipes.length > published ? ", plus " + plural(recipes.length - published, "draft", "drafts") : "") + "</span></div>" +
    "<div class='stat'><b id='statProducts'>" + forSale + "</b><span>" + (forSale === 1 ? "plan" : "plans") + " for sale</span></div>" +
    "<div class='stat'><b id='statSales'>" + sales.length + "</b><span>" + (sales.length === 1 ? "sale" : "sales") + "</span></div>" +
    "<div class='stat'><b id='statEarned'>" + formatPrice(earned) + "</b><span>earned</span></div>" +
    "<div class='stat'><b>" + saves + "</b><span>saves of your recipes</span></div>";
  document.getElementById("storefrontLink").href = "creator.html?handle=" + encodeURIComponent(studioUser.handle);
  var banner = document.getElementById("suspendedBanner");
  banner.hidden = !isSuspended();
}

function isSuspended() {
  var creator = creatorFor(studioUser.id);
  return creator !== null && creator.suspendedAt !== null;
}

/* ---------- recipes ---------- */

function renderRecipes() {
  var html = myRecipes().map(function (recipe) {
    var inPlans = plansHolding(recipe.id);
    var free = recipe.visibility === "Public";
    var publishHint = creatorPublishProblem(recipe, !recipe.isPublished);
    var note = publishHint;

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
  // What the editor does not show (the line as written, "optional") rides along, so saving an unchanged
  // recipe changes nothing. A new ingredient on the line drops the old wording.
  return "<div class='ingredient-line'" + (line ? " data-ingredient-id='" + line.ingredientId + "' data-display='" +
      escapeHtml(line.displayText || "") + "' data-optional='" + (line.isOptional ? "true" : "false") + "'" : "") + ">" +
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

/* The lines as typed, or { problem } naming the first line whose amount is missing or not above 0. */
function readIngredientLines() {
  var lines = [];
  var rows = document.querySelectorAll("#ingredientLines .ingredient-line");
  for (var i = 0; i < rows.length; i = i + 1) {
    var text = rows[i].querySelector(".line-quantity").value.trim();
    var quantity = Number(text);
    if (text === "" || !(quantity > 0)) {
      return { problem: "Line " + (i + 1) + " needs an amount above 0. Fix it, or remove the line with ×." };
    }
    var ingredientId = Number(rows[i].querySelector(".line-ingredient").value);
    var same = Number(rows[i].getAttribute("data-ingredient-id")) === ingredientId;
    lines.push({
      ingredientId: ingredientId,
      unitId: Number(rows[i].querySelector(".line-unit").value),
      quantity: quantity,
      preparation: rows[i].querySelector(".line-prep").value.trim() || null,
      displayText: same ? rows[i].getAttribute("data-display") || null : null,
      isOptional: same && rows[i].getAttribute("data-optional") === "true"
    });
  }
  return { lines: lines, problem: "" };
}

function openRecipeForm(recipe) {
  editingRecipeId = recipe ? recipe.id : null;
  var form = document.getElementById("recipeForm");
  var details = recipe ? recipeWithDetails(recipe.id) : null;
  originalVisibility = recipe ? recipe.visibility : null;

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
  var lines = recipe ? rowsWhere("recipeIngredients", function (ri) { return ri.recipeId === recipe.id; })
    .sort(bySortOrder) : [];
  if (lines.length === 0) { lines = [null]; }
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
  if (servingsProblem(document.getElementById("recipeServings").value) !== "") {
    document.getElementById("recipeServingsError").textContent = servingsProblem(document.getElementById("recipeServings").value);
    ok = false;
  }
  var duplicate = myRecipes().some(function (r) { return r.id !== editingRecipeId && r.title.toLowerCase() === title.toLowerCase(); });
  if (title !== "" && duplicate) {
    document.getElementById("recipeTitleError").textContent = "You already have a recipe called \"" + title + "\". Give this one its own name.";
    ok = false;
  }
  var prep = minutesValue("recipePrep"), cook = minutesValue("recipeCook");
  if (prep === null || cook === null) {
    document.getElementById("recipeTimeError").textContent = "Prep and cook times are whole minutes from 0 to 1,440 (a day).";
    ok = false;
  }
  var read = readIngredientLines();
  if (read.problem) {
    document.getElementById("recipeIngredientsError").textContent = read.problem;
    ok = false;
  }
  var steps = readSteps();
  var editing = editingRecipeId === null ? null : rowById("recipes", editingRecipeId);
  if (editing !== null && editing.isPublished && !read.problem && (read.lines.length === 0 || steps.length === 0)) {
    document.getElementById(read.lines.length === 0 ? "recipeIngredientsError" : "recipeStepsError").textContent =
      "A published recipe needs at least one ingredient and one step. Unpublish it first if you want to clear it out.";
    ok = false;
  }
  if (!ok) {
    showToast("Please fix the highlighted fields.", "error");
    return;
  }

  var fields = {
    title: title,
    description: document.getElementById("recipeDescription").value.trim() || null,
    servings: Number(document.getElementById("recipeServings").value),
    prepMinutes: prep,
    cookMinutes: cook,
    ingredients: read.lines,
    steps: steps
  };
  var visibility = form.querySelector("input[name='recipeVisibility']:checked").value;
  var savers = editing === null ? 0 : saveCount(editing.id);
  var losing = editing !== null && originalVisibility === "Public" && visibility === "ProductOnly" && savers > 0;
  var asked = losing
    ? confirmDialog("Make \"" + title + "\" premium? Only buyers of a plan it is in will open it, and " +
        plural(savers, "cook who saved it loses", "cooks who saved it lose") + " it until they buy that plan.", "Make premium")
    : Promise.resolve(true);
  asked.then(function (go) {
    if (!go) { return; }
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
  });
}

/* Whole minutes from 0 to 1,440, or null. */
function minutesValue(id) {
  var text = document.getElementById(id).value.trim();
  var minutes = Number(text);
  return text !== "" && /^[0-9]+$/.test(text) && minutes <= 1440 ? minutes : null;
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
/* The plan builder: one row per meal (a meal plan) or per recipe (a collection), in order. A recipe may sit on
   more than one day of a meal plan, so a plan opens with exactly the meals it has and saves them back
   unchanged. Each row offers only the recipes that can be sold: the creator's published premium ones. */
function eligibleRecipes() {
  return myRecipes().filter(function (r) { return placementProblem(r) === ""; })
    .sort(function (a, b) { return a.title < b.title ? -1 : 1; });
}

function placementRowHtml(placement, isMealPlan) {
  var recipes = eligibleRecipes();
  var current = placement && placement.recipeId ? rowById("recipes", placement.recipeId) : null;
  // A recipe taken down since the plan was made still shows, marked, so the creator can take it out.
  if (current !== null && recipes.indexOf(current) === -1) { recipes = [current].concat(recipes); }
  var options = "<option value=''>Choose a recipe</option>" + recipes.map(function (r) {
    var off = placementProblem(r);
    return "<option value='" + r.id + "'" + (current === r ? " selected" : "") + ">" + escapeHtml(r.title) +
      (off ? " (not published: take it out)" : "") + "</option>";
  }).join("");
  var row = "<div class='placement meal-row'>" +
    "<select class='place-recipe' aria-label='Recipe'>" + options + "</select>";
  if (isMealPlan) {
    row = row + "<select class='place-day' aria-label='Day'>" + DAY_NAMES.map(function (day, i) {
        return "<option value='" + i + "'" + (placement && placement.dayOffset === i ? " selected" : "") + ">" + day + "</option>";
      }).join("") + "</select>" +
      "<select class='place-slot' aria-label='Meal'>" + SLOTS.map(function (slot) {
        return "<option value='" + slot + "'" + (placement && placement.slot === slot ? " selected" : "") + ">" + slot + "</option>";
      }).join("") + "</select>";
  }
  return row + "<button type='button' class='link-button remove-placement'>Remove</button></div>";
}

/* The next free dinner, Monday first, then the other meals: a new row never lands on a taken day. */
function nextFreeSlot() {
  var taken = readPlacements(true, true).map(function (p) { return p.dayOffset + "|" + p.slot; });
  var order = ["Dinner", "Lunch", "Breakfast", "Snack"];
  for (var k = 0; k < order.length; k = k + 1) {
    for (var day = 0; day < 7; day = day + 1) {
      if (taken.indexOf(day + "|" + order[k]) === -1) { return { dayOffset: day, slot: order[k] }; }
    }
  }
  return { dayOffset: 0, slot: "Dinner" };
}

function renderPlacementList(product) {
  var isMealPlan = document.querySelector("input[name='productType']:checked").value === "MealPlan";
  var rows = product ? product.recipes.slice().sort(bySortOrder) : readPlacements(isMealPlan, true);
  if (rows.length === 0) { rows = [isMealPlan ? { recipeId: null, dayOffset: 0, slot: "Dinner" } : { recipeId: null }]; }
  document.getElementById("placementList").innerHTML = rows.map(function (p) { return placementRowHtml(p, isMealPlan); }).join("");
  document.getElementById("addPlacement").textContent = isMealPlan ? "Add a meal" : "Add a recipe";
  var others = myRecipes().length - eligibleRecipes().length;
  document.getElementById("placementHint").textContent = eligibleRecipes().length === 0
    ? "You have no published premium recipes yet. Make a recipe premium and publish it, then it can go in a plan."
    : (isMealPlan ? "Pick a recipe, a day and a meal for each row. A recipe can be on more than one day. " : "Pick the recipes in the order to cook them. ") +
      (others ? "Only published premium recipes can be sold; " + plural(others, "of your recipes is", "of your recipes are") + " free or a draft, so not listed." : "");
}

function addPlacementRow() {
  var isMealPlan = document.querySelector("input[name='productType']:checked").value === "MealPlan";
  var next = isMealPlan ? nextFreeSlot() : {};
  document.getElementById("placementList").insertAdjacentHTML("beforeend",
    placementRowHtml({ recipeId: null, dayOffset: next.dayOffset, slot: next.slot }, isMealPlan));
  var selects = document.querySelectorAll("#placementList .place-recipe");
  selects[selects.length - 1].focus();
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

/* The rows in order. Unless keepEmpty, a row with no recipe chosen is skipped. */
function readPlacements(isMealPlan, keepEmpty) {
  var placements = [];
  var rows = document.querySelectorAll("#placementList .meal-row");
  for (var i = 0; i < rows.length; i = i + 1) {
    var value = rows[i].querySelector(".place-recipe").value;
    if (value === "" && !keepEmpty) { continue; }
    var day = rows[i].querySelector(".place-day");
    placements.push({
      recipeId: value === "" ? null : Number(value),
      dayOffset: isMealPlan && day ? Number(day.value) : null,
      slot: isMealPlan && day ? rows[i].querySelector(".place-slot").value : null
    });
  }
  return placements;
}

/* What is wrong with the rows, in words the creator can act on; "" when nothing is. */
function placementsProblem(rows, isMealPlan) {
  if (rows.length === 0) { return "Add at least one recipe."; }
  for (var i = 0; i < rows.length; i = i + 1) {
    if (rows[i].recipeId === null) { return "Row " + (i + 1) + " has no recipe. Choose one, or remove the row."; }
    var problem = placementProblem(rowById("recipes", rows[i].recipeId));
    if (problem) { return problem.replace(" Publish it first.", " Take it out of this plan, or publish it first."); }
  }
  var seen = {};
  for (var k = 0; k < rows.length; k = k + 1) {
    var key = isMealPlan ? rows[k].dayOffset + "|" + rows[k].slot : String(rows[k].recipeId);
    if (seen[key]) {
      return isMealPlan ? DAY_NAMES[rows[k].dayOffset] + " " + rows[k].slot.toLowerCase() + " has two recipes. Move one to another meal."
        : "\"" + rowById("recipes", rows[k].recipeId).title + "\" is in the collection twice. Remove one.";
    }
    seen[key] = true;
  }
  return "";
}

/* A price from $0.99 to $500.00, in cents, or null. */
function priceCents(text) {
  var trimmed = text.trim();
  if (!/^[0-9]+(\.[0-9]{1,2})?$/.test(trimmed)) { return null; }
  var cents = Math.round(Number(trimmed) * 100);
  return cents >= 99 && cents <= 50000 ? cents : null;
}

function onProductSubmitted(event) {
  event.preventDefault();
  var form = document.getElementById("productForm");
  clearErrors(form);
  var type = form.querySelector("input[name='productType']:checked").value;
  var title = document.getElementById("productTitle").value.trim();
  var cents = priceCents(document.getElementById("productPrice").value);
  var placements = readPlacements(type === "MealPlan", true);
  var placementIssue = placementsProblem(placements, type === "MealPlan");
  var ok = true;

  if (title === "") { document.getElementById("productTitleError").textContent = "Give it a title."; ok = false; }
  if (cents === null) { document.getElementById("productPriceError").textContent = "Enter a price from $0.99 to $500, like 9.99."; ok = false; }
  if (placementIssue) { document.getElementById("placementError").textContent = placementIssue; ok = false; }
  if (editingProductId === null && isSuspended()) {
    document.getElementById("placementError").textContent = "Your account is suspended, so you cannot put a new plan on sale.";
    ok = false;
  }
  if (!ok) {
    showToast("Please fix the highlighted fields.", "error");
    return;
  }

  var fields = { type: type, title: title, description: document.getElementById("productDescription").value.trim() || null,
    priceCents: cents, placements: placements };
  var problem;
  if (editingProductId === null) {
    var result = createProduct(studioUser.id, fields);
    problem = result.problem || "";
    if (problem === "") { showToast("\"" + title + "\"" + (isForSale(result.product) ? " is on sale." : " is saved, but not for sale.")); }
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

/* Enter in a box or a menu never saves the form: a browser submits a form on Enter, so confirming a choice in
   a menu or finishing a line of typing put a whole plan on sale and closed the form. Only Save saves; Enter
   still starts a new line in a text area and presses the button it is on. */
function keepOpenOnEnter(form) {
  form.addEventListener("keydown", function (event) {
    if (event.key !== "Enter") { return; }
    var tag = event.target.tagName;
    if (tag === "TEXTAREA" || tag === "BUTTON") { return; }
    event.preventDefault();
  });
}

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
  keepOpenOnEnter(document.getElementById("recipeForm"));
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
  keepOpenOnEnter(document.getElementById("productForm"));
  document.getElementById("cancelProduct").addEventListener("click", closeProductForm);
  document.getElementById("productTypeField").addEventListener("change", function () {
    renderPlacementList(editingProductId === null ? null : productWithRecipes(editingProductId));
  });
  document.getElementById("addPlacement").addEventListener("click", addPlacementRow);
  document.getElementById("placementList").addEventListener("click", function (event) {
    var remove = event.target.closest(".remove-placement");
    if (remove !== null) { remove.closest(".meal-row").remove(); }
  });
  document.getElementById("productRows").addEventListener("click", onProductTableClicked);
});
