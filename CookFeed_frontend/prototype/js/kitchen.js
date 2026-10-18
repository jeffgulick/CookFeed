/* Cookfeed prototype - My kitchen page (design section 3.9)

   In the order a cook uses it: the week they are cooking (opened on the current week), their one shopping
   list, the plans they bought, the recipes they saved, and their past lists. Saving a recipe or buying a plan
   puts nothing on a list: Shop this week, or Shop this on a recipe or plan page, adds to the list, and the
   list opens on its own page (list.html), where it is ticked off, edited, sent, and marked done. */

var kitchenUser = null;
var currentWeek = null;

function thisWeek() {
  return weekStartOf(parseIsoDate(todayIso()));
}

/* ---------- plans and saved recipes ---------- */

function renderOwnedPlans() {
  var owned = ownedProductsFor(kitchenUser);
  var label = weekLabel(currentWeek);
  var week = label === "This week" || label === "Next week" ? label.toLowerCase() : "the week shown";
  document.getElementById("ownedPlans").innerHTML = owned.map(function (o) {
    return "<div class='card product-tile plan-card' data-product-id='" + o.product.id + "'>" +
      "<img src='" + escapeHtml(o.product.coverImageUrl || "") + "' alt=''>" +
      "<span class='pill'>" + productTypeLabel(o.product) + "</span>" +
      "<span class='recipe-title'><a href='" + productUrl(o.product.id) + "'>" + escapeHtml(o.productTitle) + "</a></span>" +
      "<span class='meta'>" + productCounts(o) + " &middot; yours to keep</span>" +
      "<span class='tile-actions'>" + (productOnWeek(kitchenUser.id, currentWeek, o.product.id)
        ? "<span class='tag tag-yes'>On " + escapeHtml(week) + " &#10003;</span>"
        : "<button type='button' class='btn-small plan-product'>Add to " + escapeHtml(week) + "</button>") + "</span>" +
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
            "<button class='btn-small unsave-button' aria-label='Unsave " + escapeHtml(recipe.title) + "'>Unsave</button></span>"
    });
  }).join("");
  document.getElementById("emptyKitchen").hidden = ids.length > 0;
}

/* ---------- the week ---------- */

function dayLabel(iso) {
  return DAY_NAMES[(parseIsoDate(iso).getDay() + 6) % 7] + ", " + formatShortDate(iso);
}

function weekDays() {
  var days = [];
  for (var i = 0; i < 7; i = i + 1) { days.push(addDays(currentWeek, i)); }
  return days;
}

function renderWeek() {
  var plan = planFor(kitchenUser.id, currentWeek);
  var entries = plan === null ? [] : planEntries(plan.id);
  var onThisWeek = currentWeek === thisWeek();

  document.getElementById("weekLabel").textContent = weekLabel(currentWeek);
  document.getElementById("weekDates").textContent = formatShortDate(currentWeek) + " to " + formatShortDate(addDays(currentWeek, 6));
  document.getElementById("backRow").hidden = onThisWeek;
  var shop = document.getElementById("shopWeek");
  // The heading names the week, so the button needs no date: "Shop this week", "Shop next week", or, for any
  // other week, "Shop these meals".
  var label = weekLabel(currentWeek);
  shop.textContent = label === "This week" || label === "Next week" ? "Shop " + label.toLowerCase() : "Shop these meals";
  shop.disabled = entries.length === 0;

  // This week is empty but another week has meals: say where they are.
  var other = onThisWeek ? otherPlannedWeek(kitchenUser.id) : null;
  document.getElementById("otherWeek").hidden = other === null;
  if (other !== null) {
    var link = document.getElementById("otherWeekLink");
    link.textContent = weekLabel(other);
    link.href = "kitchen.html?week=" + other;
  }

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
      "<span class='week-servings'>for " + peopleBoxHtml(entry.planned, entry.title) + "</span>" +
      "<button type='button' class='link-button remove-entry' aria-label='Take " + escapeHtml(entry.title) + " off the week'>Take off week</button>" +
      "</div>";
  });
  document.getElementById("weekEntries").innerHTML = html ||
    "<p class='meta'>Nothing planned for " + escapeHtml(weekPhrase(currentWeek)) + " yet. Press <strong>Plan it</strong> on a saved recipe, " +
    "or add one of your plans.</p>";
}

/* ---------- the shopping list, and past lists ---------- */

function statusText(trip) {
  return trip.status === "Sent" ? "Sent to " + trip.sentTo : trip.status === "Done" ? "Done " + formatDate(trip.completedAt) : trip.status;
}

function statusTag(trip) {
  var kind = trip.status === "Done" ? "tag-muted" : trip.status === "Building" ? "tag-premium" : "tag-yes";
  return "<span class='tag " + kind + "'>" + escapeHtml(statusText(trip)) + "</span>";
}

function renderActiveList() {
  var trip = activeListFor(kitchenUser.id);
  var area = document.getElementById("activeList");
  if (trip === null) {
    area.innerHTML = "<p><strong>No shopping list yet.</strong></p>" +
      "<p class='meta'>Press <strong>Shop this week</strong> above, <strong>Shop this recipe</strong> on a recipe, or " +
      "<strong>Shop this plan</strong> on a plan you own, and it goes on your list.</p>" +
      "<button type='button' class='btn-secondary' id='startList'>Start a shopping list</button>";
    return;
  }
  var href = "list.html?trip=" + trip.id;
  area.innerHTML = "<p><a href='" + href + "'><strong>" + escapeHtml(trip.name) + "</strong></a> " + statusTag(trip) + "</p>" +
    "<p class='meta'>" + plural(tripItems(trip.id).length, "recipe", "recipes") + " &middot; " +
    plural(tripList(trip.id).lines.length, "item", "items") + " to buy</p>" +
    "<a class='btn-secondary' id='openActiveList' href='" + href + "'>Open list</a>";
}

function renderTrips() {
  var trips = tripsFor(kitchenUser.id).filter(function (t) { return t.status === "Sent" || t.status === "Done"; });
  document.getElementById("tripRows").innerHTML = trips.map(function (trip) {
    var href = "list.html?trip=" + trip.id;
    return "<tr data-trip-id='" + trip.id + "'" + (trip.status === "Done" ? " class='row-muted'" : "") + ">" +
      "<td data-label='List'><a href='" + href + "'>" + escapeHtml(trip.name) + "</a></td>" +
      "<td data-label='Made'>" + formatDate(trip.createdAt) + "</td>" +
      "<td data-label='Recipes'>" + plural(tripItems(trip.id).length, "recipe", "recipes") + "</td>" +
      "<td data-label='Status'>" + statusTag(trip) + "</td>" +
      "<td class='actions'><a class='btn-small' href='" + href + "'>Open</a> " +
      (trip.status === "Sent" ? "<button type='button' class='btn-small finish-trip'>Items arrived</button> " : "") +
      (canShopAgain(trip) ? "<button type='button' class='btn-small reshop-trip'>Shop again</button> " : "") +
      "<button type='button' class='btn-small delete-trip'>Delete</button></td></tr>";
  }).join("") || "<tr><td colspan='5' class='meta'>No past lists yet. A list you send or finish shopping is kept here.</td></tr>";
}

function renderKitchen() {
  renderWeek();
  renderActiveList();
  renderOwnedPlans();
  renderSavedRecipes();
  renderTrips();
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
    var planned = rowById("recipes", Number(planIt.getAttribute("data-recipe-id")));
    openPlanDialog(kitchenUser, planned, weekDays(), planned.servings, function () { renderWeek(); renderOwnedPlans(); });
    return;
  }
  var planProduct = event.target.closest(".plan-product");
  if (planProduct !== null) {
    var productId = Number(planProduct.closest(".plan-card").getAttribute("data-product-id"));
    var entries = addProductToPlan(kitchenUser.id, currentWeek, productId) || [];
    renderWeek();
    renderOwnedPlans();
    showToast(entries.length === 0 ? "Every meal of this plan is already on " + weekPhrase(currentWeek) + "."
      : plural(entries.length, "meal", "meals") + " added to " + weekPhrase(currentWeek) + ".");
    document.getElementById("weekEntries").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  var remove = event.target.closest(".remove-entry");
  if (remove !== null) {
    removePlanEntry(Number(remove.closest(".week-row").getAttribute("data-entry-id")));
    renderWeek();
    renderOwnedPlans();
    showToast("Taken off the week.");
    document.getElementById("main").focus({ preventScroll: true });
    return;
  }
  if (event.target.closest("#startList") !== null) {
    if (activeListFor(kitchenUser.id) === null) {
      window.location.href = "list.html?trip=" + createTrip(kitchenUser.id, listName(), []).id;
    }
    return;
  }
  var finish = event.target.closest(".finish-trip");
  if (finish !== null) {
    var finished = tripById(Number(finish.closest("tr").getAttribute("data-trip-id")));
    finishTrip(finished).then(function (done) {
      if (!done) { return; }
      renderTrips();
      showToast("\"" + finished.name + "\" is done. It stays in your past lists.");
      document.getElementById("main").focus({ preventScroll: true });
    });
    return;
  }
  var reshop = event.target.closest(".reshop-trip");
  if (reshop !== null) {
    var copy = copyTrip(Number(reshop.closest("tr").getAttribute("data-trip-id")));
    if (copy !== null) { window.location.href = "list.html?trip=" + copy.id + "&added=" + tripItems(copy.id).length; }
    return;
  }
  var del = event.target.closest(".delete-trip");
  if (del !== null) {
    var trip = tripById(Number(del.closest("tr").getAttribute("data-trip-id")));
    confirmDialog("Delete the list \"" + trip.name + "\"? It cannot be brought back.", "Delete list").then(function (ok) {
      if (!ok) { return; }
      deleteTrip(trip.id);
      renderTrips();
      showToast("\"" + trip.name + "\" is deleted.");
      document.getElementById("main").focus({ preventScroll: true });
    });
  }
}

function onWeekServingsChanged(input, people) {
  var entryId = Number(input.closest(".week-row").getAttribute("data-entry-id"));
  var entry = db().mealPlanEntries.filter(function (e) { return e.id === entryId; })[0];
  var recipe = rowById("recipes", entry.recipeId);
  return setEntryServings(entryId, people === recipe.servings ? null : people) !== null;
}

function shopTheWeek() {
  var result = shopWeek(kitchenUser.id, currentWeek);
  renderActiveList();
  tellShopped(result, renderActiveList);
}

function showWeek(weekStart) {
  currentWeek = weekStart;
  renderWeek();
  renderOwnedPlans();
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
  // Open on the current week, or on the week a link names (kitchen.html?week=2026-10-19).
  var asked = queryText("week");
  currentWeek = asked !== null && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? weekStartOf(parseIsoDate(asked)) : thisWeek();

  renderKitchen();
  // Back from a list that was sent or finished: say so, and show the past lists.
  var sent = queryNumber("sent");
  var done = queryNumber("done");
  if (sent !== null || done !== null) {
    var backFrom = tripById(sent !== null ? sent : done);
    if (backFrom !== null) {
      showToast(sent !== null ? "\"" + backFrom.name + "\" sent to " + backFrom.sentTo + ". Press Items arrived when it comes."
                              : "\"" + backFrom.name + "\" is done. It stays in your past lists.");
      document.getElementById("tripRows").scrollIntoView({ block: "center" });
    }
    window.history.replaceState(null, "", "kitchen.html");
  }
  document.querySelector("main").addEventListener("click", onKitchenClicked);
  wirePeopleBoxes(document.getElementById("weekEntries"), onWeekServingsChanged);
  document.getElementById("prevWeek").addEventListener("click", function () { showWeek(addDays(currentWeek, -7)); });
  document.getElementById("nextWeek").addEventListener("click", function () { showWeek(addDays(currentWeek, 7)); });
  document.getElementById("backToThisWeek").addEventListener("click", function () { showWeek(thisWeek()); });
  document.getElementById("shopWeek").addEventListener("click", shopTheWeek);
});
