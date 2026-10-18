/* Cookfeed prototype - a shopping list (list.html?trip=), design section 3.9.

   One list for one visit to the store, readable on a phone: the lines to buy, sorted by aisle, with big
   boxes to tick as each thing goes in the basket, once the cook starts shopping; the recipes it cooks,
   each for a number of people, which can be changed, taken off or added to; and the list's life, with
   only the buttons that fit where it is:
   Building (start shopping, or send it to Instacart or Favor), Shopping (done shopping), Sent (read-only
   until the items arrive), and Done (kept as a record, and shopped again when no other list is going). A
   line the cook already has at home is taken off with Have it (shopping_trip_skips) and can be put back.
   The ticks are a per-device convenience, kept in localStorage, not a table. */

var trip = null;
var tripUser = null;

function haveKey() {
  return tripHaveKey(trip.id);
}

function haveItems() {
  return loadJson(haveKey(), {});
}

function setHave(key, have) {
  var items = haveItems();
  if (have) { items[key] = true; } else { delete items[key]; }
  saveJson(haveKey(), items);
}

/* ---------- the header and the buttons ---------- */

function renderHeader() {
  var items = tripItems(trip.id);
  var editable = tripEditable(trip);
  var status = trip.status;
  document.title = trip.name + " | Cookfeed";
  document.getElementById("tripHeading").textContent = trip.name;
  var tag = document.getElementById("tripStatus");
  tag.textContent = status === "Sent" ? "Sent to " + trip.sentTo : status === "Done" ? "Done " + formatDate(trip.completedAt) : status;
  tag.className = "tag " + (status === "Done" ? "tag-muted" : status === "Building" ? "tag-premium" : "tag-yes");
  document.getElementById("tripSummary").textContent = plural(items.length, "recipe", "recipes") + ", made " + formatDate(trip.createdAt);

  // Only the buttons that fit where the list is.
  document.getElementById("startShopping").hidden = status !== "Building";
  document.getElementById("sendInstacart").hidden = status !== "Building";
  document.getElementById("sendFavor").hidden = status !== "Building";
  document.getElementById("finishTrip").hidden = status !== "Shopping" && status !== "Sent";
  document.getElementById("finishTrip").textContent = status === "Sent" ? "Items arrived" : "Done shopping";
  document.getElementById("shopAgain").hidden = status !== "Done" || !canShopAgain(trip);
  document.getElementById("printTrip").hidden = !editable;
  document.getElementById("addMore").hidden = !editable;
  document.getElementById("itemsHint").hidden = !editable;
  document.getElementById("tripHint").textContent = status === "Building"
    ? "Press Have it on anything you already have at home. Then start shopping, or send the list to be delivered."
    : status === "Shopping" ? "Tick each thing as it goes in your basket. You can still change the list."
    : status === "Sent" ? "Sent to " + trip.sentTo + ". The list cannot change now. Press Items arrived when it comes."
    : canShopAgain(trip) ? "This list is done and kept as a record. Shop again makes a new list from it."
    : "This list is done and kept as a record. Finish your current shopping list before shopping this one again.";
}

/* ---------- the list ---------- */

function renderList() {
  var parts = tripList(trip.id);
  var have = haveItems();
  var editable = tripEditable(trip);
  // The tick boxes mean "in my basket", so they appear once the cook starts shopping, not while building.
  var ticking = trip.status === "Shopping";
  var html = "";
  var lastAisle = null;

  parts.lines.forEach(function (line) {
    if (line.aisle !== lastAisle) {
      html = html + "<h3>" + escapeHtml(line.aisle) + "</h3>";
      lastAisle = line.aisle;
    }
    var ticked = ticking && have[line.key] === true;
    var name = escapeHtml(line.name);
    html = html + "<div class='store-line" + (ticked ? " have" : "") + (editable ? "" : " read-only") + (ticking ? "" : " no-tick") + "' data-key='" + escapeHtml(line.key) +
      "' data-ingredient-id='" + line.ingredientId + "'>" +
      (ticking ? "<input type='checkbox' aria-label='In my basket: " + name + "'" + (ticked ? " checked" : "") + ">" : "") +
      "<span class='store-name'>" + name + "<small>for " + escapeHtml(line.recipes.join(", ")) + "</small></span>" +
      "<span class='store-qty'><span>" + formatQuantity(line.amount) + " " + escapeHtml(line.unit) + "</span>" +
      (editable ? "<button type='button' class='link-button skip-line' aria-label='Have it: " + name + "'>Have it</button>" : "") +
      "</span></div>";
  });
  document.getElementById("storeList").innerHTML = html || "<p class='meta'>Nothing to buy yet." + (editable ? " Add recipes below." : "") + "</p>";

  var strip = document.getElementById("skippedStrip");
  strip.hidden = parts.skipped.length === 0;
  strip.innerHTML = parts.skipped.length === 0 ? "" : "Already at home, off the list: " + parts.skipped.map(function (line) {
    return escapeHtml(line.name) + (editable ? " <button type='button' class='link-button unskip-line' data-ingredient-id='" + line.ingredientId +
      "' aria-label='Put " + escapeHtml(line.name) + " back on the list'>put back</button>" : "");
  }).join(", ");

  var remaining = parts.lines.filter(function (line) { return have[line.key] !== true; }).length;
  document.getElementById("listHeading").textContent = plural(parts.lines.length, "item", "items") + " to buy";
  document.getElementById("listProgress").hidden = !ticking;
  document.getElementById("listProgressText").textContent = parts.lines.length === 0 ? "0 of 0 items still to buy"
    : remaining === 0 ? "All done. Everything is in your basket." : remaining + " of " + parts.lines.length + " items still to buy";
  document.getElementById("listProgressFill").style.width =
    (parts.lines.length === 0 ? 0 : Math.round((parts.lines.length - remaining) / parts.lines.length * 100)) + "%";
}

/* ---------- the recipes on the list ---------- */

function renderItems() {
  var editable = tripEditable(trip);
  document.getElementById("tripItems").innerHTML = tripItems(trip.id).map(function (item) {
    return "<div class='trip-item' data-item-id='" + item.id + "'>" +
      "<a href='recipe.html?id=" + item.recipeId + "'>" + escapeHtml(item.title) + "</a>" +
      (editable ? "<span class='trip-people'>for " + peopleBoxHtml(item.servings, item.title) + "</span>" +
                  "<button type='button' class='link-button remove-item' aria-label='Take " + escapeHtml(item.title) + " off the list'>Take off list</button>"
                : "<span class='meta'>for " + item.servings + " people</span><span></span>") +
      "</div>";
  }).join("") || "<p class='meta'>No recipes on this list yet.</p>";
}

function renderTrip() {
  renderHeader();
  renderList();
  renderItems();
}

/* ---------- actions ---------- */

function onTripClicked(event) {
  var skip = event.target.closest(".skip-line");
  if (skip !== null) {
    var line = skip.closest(".store-line");
    setTripSkip(trip.id, Number(line.getAttribute("data-ingredient-id")), true);
    renderList();
    showToast("Off the list: you have it. Put it back from the strip below if you need it.");
    return;
  }
  var unskip = event.target.closest(".unskip-line");
  if (unskip !== null) {
    setTripSkip(trip.id, Number(unskip.getAttribute("data-ingredient-id")), false);
    renderList();
    return;
  }
  var remove = event.target.closest(".remove-item");
  if (remove !== null) {
    removeTripItem(Number(remove.closest(".trip-item").getAttribute("data-item-id")));
    renderTrip();
    showToast("Taken off the list.");
    document.getElementById("main").focus({ preventScroll: true });
  }
}

function onItemServingsChanged(input, people) {
  var saved = setTripItemServings(Number(input.closest(".trip-item").getAttribute("data-item-id")), people) !== null;
  renderList();
  return saved;
}

function onHaveChanged(event) {
  if (event.target.type !== "checkbox") { return; }
  setHave(event.target.closest(".store-line").getAttribute("data-key"), event.target.checked);
  renderList();
}

/* Sending and finishing both close the list's page and go back to My kitchen, where the list is in past
   lists. */
function send(partner) {
  confirmDialog("Send this list to " + partner + "? In the real app the list opens there to order; here it is marked sent and cannot change until the items arrive.",
    "Send to " + partner).then(function (ok) {
    if (!ok) { return; }
    setTripStatus(trip.id, "Sent", partner);
    window.location.href = "kitchen.html?sent=" + trip.id;
  });
}

function finish() {
  finishTrip(trip).then(function (done) {
    if (done) { window.location.href = "kitchen.html?done=" + trip.id; }
  });
}

function shopAgain() {
  var copy = copyTrip(trip.id);
  if (copy === null) { renderHeader(); return; }
  window.location.href = "list.html?trip=" + copy.id + "&added=" + tripItems(copy.id).length;
}

function onAddSubmitted(event) {
  event.preventDefault();
  var picked = readPicker(document.getElementById("buildForm"));
  if (picked.problem) {
    document.getElementById("buildError").textContent = picked.problem;
    return;
  }
  if (picked.productIds.length === 0 && picked.items.length === 0) {
    document.getElementById("buildError").textContent = "Tick at least one plan or recipe.";
    return;
  }
  var added = addTripItems(trip.id, picked.items).length;
  picked.productIds.forEach(function (id) { added = added + addProductToTrip(trip.id, id).length; });
  document.getElementById("buildDialog").close();
  renderTrip();
  if (added === 0) {
    showToast("Everything you ticked is already on this list.", "error");
    return;
  }
  showToast(plural(added, "recipe", "recipes") + " added to the list. A recipe already on it is never added twice.");
}

/* ---------- start ---------- */

document.addEventListener("DOMContentLoaded", function () {
  var user = currentUser();
  var id = queryNumber("trip");
  trip = id === null ? null : tripById(id);
  if (user === null || !canShop(user) || trip === null || trip.userId !== user.id) {
    document.getElementById("tripArea").innerHTML = "<span class='pill'>Shopping list</span><h1>Shopping list</h1>" +
      "<div class='card notice-card'><p>" + (user === null ? signInLink("see your shopping lists") + "."
        : !canShop(user) ? "Admin accounts do not shop." : "There is no list of yours at this address. <a href='kitchen.html'>Back to My kitchen</a>.") +
      "</p></div>";
    return;
  }
  tripUser = user;
  renderTrip();
  var added = queryNumber("added");
  if (added !== null) {
    showToast("Your new shopping list has " + plural(added, "recipe", "recipes") + ". Shop it or send it when you are ready.");
    window.history.replaceState(null, "", "list.html?trip=" + trip.id);
  }

  document.getElementById("tripArea").addEventListener("click", onTripClicked);
  // As the cook types a number, the list follows (input), not only when they leave the box (change).
  wirePeopleBoxes(document.getElementById("tripItems"), onItemServingsChanged);
  document.getElementById("storeList").addEventListener("change", onHaveChanged);
  document.getElementById("clearHave").addEventListener("click", function () { removeStored(haveKey()); renderList(); });
  document.getElementById("startShopping").addEventListener("click", function () {
    trip = setTripStatus(trip.id, "Shopping");
    renderTrip();
    showToast("Happy shopping. Tick each thing as it goes in your basket.");
  });
  document.getElementById("sendInstacart").addEventListener("click", function () { send("Instacart"); });
  document.getElementById("sendFavor").addEventListener("click", function () { send("Favor"); });
  document.getElementById("finishTrip").addEventListener("click", finish);
  document.getElementById("shopAgain").addEventListener("click", shopAgain);
  document.getElementById("printTrip").addEventListener("click", function () { window.print(); });
  document.getElementById("addMore").addEventListener("click", function () {
    document.getElementById("buildPlans").innerHTML = pickerPlansHtml(tripUser, trip.id);
    document.getElementById("buildRecipes").innerHTML = pickerRecipesHtml(tripUser, { preRecipeId: null, tripId: trip.id });
    wirePicker(document.getElementById("buildForm"));
    document.getElementById("buildError").textContent = "";
    document.getElementById("buildDialog").showModal();
  });
  document.getElementById("buildForm").addEventListener("submit", onAddSubmitted);
  document.getElementById("buildCancel").addEventListener("click", function () { document.getElementById("buildDialog").close(); });
  document.getElementById("deleteTrip").addEventListener("click", function () {
    confirmDialog("Delete the list \"" + trip.name + "\"? It cannot be brought back.", "Delete list").then(function (ok) {
      if (!ok) { return; }
      deleteTrip(trip.id);
      window.location.href = "kitchen.html";
    });
  });
});
