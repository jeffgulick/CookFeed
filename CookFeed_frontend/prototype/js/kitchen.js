/* Cookfeed prototype - My kitchen page (design section 3.9)

   The plans the signed-in account bought, the recipes it saved, the week it is cooking, and its shopping
   trips. Saving a recipe or buying a plan puts nothing on a list: the cook builds a trip when they want
   one, for a single visit to the store, from any recipes and plans, or from a planned week. A trip opens on
   its own page (list.html), where it is ticked off, edited, sent, and marked done. */

var kitchenUser = null;
var currentWeek = null;
var dialogMode = "trip";    // "trip": a new shopping trip; "week": recipes and plans onto this week

/* ---------- plans and saved recipes ---------- */

function renderOwnedPlans() {
  var owned = ownedProductsFor(kitchenUser);
  document.getElementById("ownedPlans").innerHTML = owned.map(function (o) {
    return "<div class='card product-tile plan-card' data-product-id='" + o.product.id + "'>" +
      "<img src='" + escapeHtml(o.product.coverImageUrl || "") + "' alt=''>" +
      "<span class='pill'>" + productTypeLabel(o.product) + "</span>" +
      "<span class='recipe-title'><a href='" + productUrl(o.product.id) + "'>" + escapeHtml(o.productTitle) + "</a></span>" +
      "<span class='meta'>" + productCounts(o) + " &middot; yours to keep</span>" +
      "<span class='tile-actions'><button type='button' class='btn-small plan-product'>Add to this week</button></span>" +
      "</div>";
  }).join("");
  document.getElementById("noPlans").hidden = owned.length > 0;
}

function renderSavedRecipes() {
  var ids = savesFor(kitchenUser.id).map(function (save) { return save.recipeId; });
  document.getElementById("savedRecipes").innerHTML = ids.map(function (id) {
    var recipe = recipeWithDetails(id);
    return recipeCardHtml(recipe, {
      foot: "<a class='meta' href='" + recipe.pageUrl + "'>Cook it &rarr;</a>" +
            "<span><button class='btn-small plan-recipe' data-recipe-id='" + id + "'>Plan it</button> " +
            "<button class='btn-small unsave-button'>Remove</button></span>"
    });
  }).join("");
  document.getElementById("emptyKitchen").hidden = ids.length > 0;
}

/* ---------- the week ---------- */

function dayLabel(iso) {
  return DAY_NAMES[(parseIsoDate(iso).getDay() + 6) % 7] + ", " + formatShortDate(iso);
}

function renderWeek() {
  var plan = planFor(kitchenUser.id, currentWeek);
  var entries = plan === null ? [] : planEntries(plan.id);

  document.getElementById("weekLabel").textContent = "Week of " + formatShortDate(currentWeek);
  document.getElementById("tripFromWeek").disabled = entries.length === 0;

  var html = "";
  var lastDay = null;
  entries.forEach(function (entry) {
    if (entry.plannedDate !== lastDay) {
      html = html + "<h4 class='week-day'>" + dayLabel(entry.plannedDate) + "</h4>";
      lastDay = entry.plannedDate;
    }
    html = html + "<div class='week-row' data-entry-id='" + entry.id + "'>" +
      "<span class='week-slot'>" + entry.slot + "</span>" +
      "<a href='recipe.html?id=" + entry.recipeId + "'>" + escapeHtml(entry.title) + "</a>" +
      "<label class='week-servings'>for <input type='number' min='1' max='20' value='" + entry.planned +
        "' aria-label='People for " + escapeHtml(entry.title) + "'> people</label>" +
      "<button type='button' class='link-button remove-entry'>Remove</button>" +
      "</div>";
  });
  document.getElementById("weekEntries").innerHTML = html ||
    "<p class='meta'>Nothing planned for this week yet. Press <strong>Add to this week</strong> to pick what to cook.</p>";
}

/* ---------- shopping trips ---------- */

function statusTag(trip) {
  var text = trip.status === "Sent" ? "Sent to " + trip.sentTo : trip.status === "Done" ? "Done " + formatDate(trip.completedAt) : trip.status;
  var kind = trip.status === "Done" ? "tag-muted" : trip.status === "Building" ? "tag-premium" : "tag-yes";
  return "<span class='tag " + kind + "'>" + escapeHtml(text) + "</span>";
}

function renderTrips() {
  var trips = tripsFor(kitchenUser.id);
  document.getElementById("tripRows").innerHTML = trips.map(function (trip) {
    var items = tripItems(trip.id);
    return "<tr data-trip-id='" + trip.id + "'" + (trip.status === "Done" ? " class='row-muted'" : "") + ">" +
      "<td><a href='list.html?trip=" + trip.id + "'>" + escapeHtml(trip.name) + "</a></td>" +
      "<td>" + formatDate(trip.createdAt) + "</td>" +
      "<td>" + plural(items.length, "recipe", "recipes") + "</td>" +
      "<td>" + statusTag(trip) + "</td>" +
      "<td class='actions'><a class='btn-small' href='list.html?trip=" + trip.id + "'>Open</a> " +
      "<button type='button' class='btn-small delete-trip'>Delete</button></td></tr>";
  }).join("") || "<tr><td colspan='5' class='meta'>No trips yet. Press <strong>New shopping trip</strong>, or make one from the week above.</td></tr>";
}

function renderKitchen() {
  renderOwnedPlans();
  renderSavedRecipes();
  renderWeek();
  renderTrips();
}

/* ---------- the Build dialog, for a new trip or for the week ---------- */

function openDialog(mode, preRecipeId) {
  dialogMode = mode;
  var forWeek = mode === "week";
  document.getElementById("buildHeading").textContent = forWeek ? "Add to the week of " + formatShortDate(currentWeek) : "New shopping trip";
  document.getElementById("tripNameField").hidden = forWeek;
  document.getElementById("buildHint").textContent = forWeek
    ? "A plan goes on its own days. A recipe goes on the day and meal you pick, for the people you choose."
    : "Tick anything you want to cook, as many recipes as you like, each for the people you choose. You can add more and take things off later.";
  document.getElementById("buildPlans").innerHTML = pickerPlansHtml(kitchenUser);
  document.getElementById("buildRecipes").innerHTML = pickerRecipesHtml(kitchenUser, { withDays: forWeek, preRecipeId: preRecipeId });
  document.getElementById("buildSubmit").textContent = forWeek ? "Add to the week" : "Create the trip";
  document.getElementById("buildError").textContent = "";
  if (!forWeek) { document.getElementById("tripName").value = ""; }
  document.getElementById("buildDialog").showModal();
}

function onBuildSubmitted(event) {
  event.preventDefault();
  var picked = readPicker(document.getElementById("buildForm"));
  if (picked.productIds.length === 0 && picked.items.length === 0) {
    document.getElementById("buildError").textContent = "Tick at least one plan or recipe.";
    return;
  }

  if (dialogMode === "week") {
    var added = 0;
    picked.productIds.forEach(function (id) { added = added + addProductToPlan(kitchenUser.id, currentWeek, id).length; });
    picked.items.forEach(function (item) {
      var recipe = rowById("recipes", item.recipeId);
      var entry = addPlanEntry(kitchenUser.id, currentWeek, item.recipeId, addDays(currentWeek, item.dayOffset), item.slot,
        item.servings === recipe.servings || item.servings === 0 ? null : item.servings);
      if (entry !== null) { added = added + 1; }
    });
    document.getElementById("buildDialog").close();
    renderKitchen();
    showToast(plural(added, "meal", "meals") + " added to the week of " + formatShortDate(currentWeek) + ".");
    return;
  }

  var name = document.getElementById("tripName").value.trim() || "Trip on " + formatShortDate(isoDate(new Date()));
  var trip = createTrip(kitchenUser.id, name, picked.items);
  picked.productIds.forEach(function (id) { addProductToTrip(trip.id, id); });
  document.getElementById("buildDialog").close();
  window.location.href = "list.html?trip=" + trip.id;
}

/* ---------- clicks ---------- */

function onKitchenClicked(event) {
  var unsave = event.target.closest(".unsave-button");
  if (unsave !== null) {
    var recipe = rowById("recipes", Number(unsave.closest(".recipe-card").getAttribute("data-recipe-id")));
    setSaved(kitchenUser.id, recipe.id, false);
    renderKitchen();
    showToast(recipe.title + " removed from your saved recipes.");
    return;
  }
  var planIt = event.target.closest(".plan-recipe");
  if (planIt !== null) {
    openDialog("week", Number(planIt.getAttribute("data-recipe-id")));
    return;
  }
  var planProduct = event.target.closest(".plan-product");
  if (planProduct !== null) {
    var productId = Number(planProduct.closest(".plan-card").getAttribute("data-product-id"));
    var entries = addProductToPlan(kitchenUser.id, currentWeek, productId);
    renderWeek();
    showToast(plural(entries.length, "meal", "meals") + " added to the week of " + formatShortDate(currentWeek) + ".");
    document.getElementById("weekEntries").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  var remove = event.target.closest(".remove-entry");
  if (remove !== null) {
    removePlanEntry(Number(remove.closest(".week-row").getAttribute("data-entry-id")));
    renderWeek();
    showToast("Taken off the week.");
    document.getElementById("main").focus({ preventScroll: true });
    return;
  }
  var del = event.target.closest(".delete-trip");
  if (del !== null) {
    var trip = tripById(Number(del.closest("tr").getAttribute("data-trip-id")));
    confirmDialog("Delete the trip \"" + trip.name + "\"? Its list goes with it.", "Delete trip").then(function (ok) {
      if (!ok) { return; }
      deleteTrip(trip.id);
      renderTrips();
      showToast("\"" + trip.name + "\" is deleted.");
      document.getElementById("main").focus({ preventScroll: true });
    });
  }
}

function onWeekServingsChanged(event) {
  var input = event.target;
  if (input.type !== "number") { return; }
  var people = Number(input.value);
  if (!(people >= LIMITS.servingsMin && people <= LIMITS.servingsMax)) { return; }
  var entryId = Number(input.closest(".week-row").getAttribute("data-entry-id"));
  var entry = db().mealPlanEntries.filter(function (e) { return e.id === entryId; })[0];
  var recipe = rowById("recipes", entry.recipeId);
  setEntryServings(entryId, people === recipe.servings ? null : people);
}

function makeTripFromWeek() {
  var trip = tripFromWeek(kitchenUser.id, currentWeek);
  if (trip === null) { return; }
  window.location.href = "list.html?trip=" + trip.id;
}

function moveWeek(days) {
  currentWeek = addDays(currentWeek, days);
  renderWeek();
}

/* ---------- start ---------- */

document.addEventListener("DOMContentLoaded", function () {
  var user = currentUser();
  if (user === null || !canShop(user)) {
    document.querySelector("main").innerHTML = "<span class='pill'>My kitchen</span><h1>Your kitchen</h1>" +
      "<div class='card notice-card'><p>" + (user === null ? signInLink("see your kitchen") + "."
        : "Admin accounts do not save recipes, plan weeks or shop.") + "</p></div>";
    return;
  }
  kitchenUser = user;
  // Start on the latest week the cook planned, or this week.
  var plans = plansFor(user.id);
  currentWeek = plans.length ? plans[0].weekStart : weekStartOf(new Date());

  renderKitchen();
  document.querySelector("main").addEventListener("click", onKitchenClicked);
  document.getElementById("weekEntries").addEventListener("input", onWeekServingsChanged);
  document.getElementById("prevWeek").addEventListener("click", function () { moveWeek(-7); });
  document.getElementById("nextWeek").addEventListener("click", function () { moveWeek(7); });
  document.getElementById("planWeek").addEventListener("click", function () { openDialog("week", null); });
  document.getElementById("tripFromWeek").addEventListener("click", makeTripFromWeek);
  document.getElementById("newTrip").addEventListener("click", function () { openDialog("trip", null); });
  document.getElementById("buildForm").addEventListener("submit", onBuildSubmitted);
  document.getElementById("buildCancel").addEventListener("click", function () { document.getElementById("buildDialog").close(); });
});
