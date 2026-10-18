/* Cookfeed prototype - a shopping trip (list.html?trip=), design section 3.9.

   One list for one visit to the store, readable on a phone: the lines to buy, sorted by aisle, with big
   boxes to tick off; the recipes it cooks, each for a number of people, which can be changed, removed or
   added to; and the trip's life: Building, then "I'm shopping this" or "Send to Instacart" / Favor, then
   Done, which clears it from the active trips and keeps it as history. Everything stays editable until
   the trip is done. A line the cook already has is taken off the list (shopping_trip_skips) and can be put
   back. The ticks are a per-device convenience, kept in localStorage, not a table. */

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
  document.title = trip.name + " | Cookfeed";
  document.getElementById("tripHeading").textContent = trip.name;
  var status = document.getElementById("tripStatus");
  status.textContent = trip.status === "Sent" ? "Sent to " + trip.sentTo
    : trip.status === "Done" ? "Done " + formatDate(trip.completedAt) : trip.status;
  status.className = "tag " + (trip.status === "Done" ? "tag-muted" : trip.status === "Building" ? "tag-premium" : "tag-yes");
  document.getElementById("tripSummary").textContent = plural(items.length, "recipe", "recipes") + ", made " + formatDate(trip.createdAt);

  document.getElementById("startShopping").hidden = trip.status !== "Building";
  document.getElementById("sendInstacart").hidden = !editable || trip.status === "Sent";
  document.getElementById("sendFavor").hidden = !editable || trip.status === "Sent";
  document.getElementById("finishTrip").hidden = !editable;
  document.getElementById("finishTrip").querySelector(".send-text").textContent =
    trip.status === "Sent" ? "Items received" : "Trip complete";
  document.getElementById("shopAgain").hidden = trip.status === "Building" || trip.status === "Shopping";
  document.getElementById("addMore").hidden = !editable;
  document.getElementById("tripHint").textContent = trip.status === "Building"
    ? "Tick off what you already have, take off what you do not need, then shop it yourself or send it."
    : trip.status === "Shopping" ? "Tick things off as you go. You can still change the list. Trip complete takes you back to your kitchen."
    : trip.status === "Sent" ? "Confirm when the items arrive, or shop it again as a new trip." : "This trip is done. It stays here as a record; Shop it again makes a new trip from it.";
}

/* ---------- the list ---------- */

function renderList() {
  var parts = tripList(trip.id);
  var have = haveItems();
  var editable = tripEditable(trip);
  var html = "";
  var lastAisle = null;

  parts.lines.forEach(function (line) {
    if (line.aisle !== lastAisle) {
      html = html + "<h3>" + escapeHtml(line.aisle) + "</h3>";
      lastAisle = line.aisle;
    }
    var ticked = have[line.key] === true;
    html = html + "<div class='store-line" + (ticked ? " have" : "") + "' data-key='" + escapeHtml(line.key) + "' data-ingredient-id='" + line.ingredientId + "'>" +
      "<input type='checkbox' aria-label='Got " + escapeHtml(line.name) + "'" + (ticked ? " checked" : "") + ">" +
      "<span class='store-name'>" + escapeHtml(line.name) + "<small>for " + escapeHtml(line.recipes.join(", ")) + "</small></span>" +
      "<span class='store-qty'>" + formatQuantity(line.amount) + " " + escapeHtml(line.unit) +
      (editable ? " <button type='button' class='link-button skip-line' aria-label='Take " + escapeHtml(line.name) + " off the list'>Remove</button>" : "") +
      "</span></div>";
  });
  document.getElementById("storeList").innerHTML = html || "<p class='meta'>Nothing to buy. Add recipes below.</p>";

  var strip = document.getElementById("skippedStrip");
  strip.hidden = parts.skipped.length === 0;
  strip.innerHTML = parts.skipped.length === 0 ? "" : "Already have, off the list: " + parts.skipped.map(function (line) {
    return escapeHtml(line.name) + (editable ? "<button type='button' class='link-button unskip-line' data-ingredient-id='" + line.ingredientId + "'>put back</button>" : "");
  }).join(", ");

  var remaining = parts.lines.filter(function (line) { return have[line.key] !== true; }).length;
  document.getElementById("listHeading").textContent = plural(parts.lines.length, "item", "items") + " to buy";
  document.getElementById("listProgressText").textContent = parts.lines.length === 0 ? "0 of 0 items still to buy"
    : remaining === 0 ? "Everything is in the cart." : remaining + " of " + parts.lines.length + " items still to buy";
  document.getElementById("listProgressFill").style.width =
    (parts.lines.length === 0 ? 0 : Math.round((parts.lines.length - remaining) / parts.lines.length * 100)) + "%";
}

/* ---------- the recipes on the trip ---------- */

function renderItems() {
  var editable = tripEditable(trip);
  document.getElementById("tripItems").innerHTML = tripItems(trip.id).map(function (item) {
    return "<div class='trip-item' data-item-id='" + item.id + "'>" +
      "<a href='recipe.html?id=" + item.recipeId + "'>" + escapeHtml(item.title) + "</a>" +
      (editable ? "<span class='trip-people'>for " + peopleBoxHtml(item.servings, item.title) + "</span>" +
                  "<button type='button' class='link-button remove-item'>Remove</button>"
                : "<span class='meta'>for " + item.servings + " people</span><span></span>") +
      "</div>";
  }).join("") || "<p class='meta'>No recipes on this trip yet.</p>";
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
    showToast("Taken off the list. Put it back from the strip below if you need it.");
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
    showToast("Taken off the trip. The list is updated.");
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

/* Sending and finishing both close the trip page and go back to My kitchen, where the trip's row shows its
   new state and can be opened, finished, shopped again or deleted. */
function send(partner) {
  confirmDialog("Send this list to " + partner + "? In the real app the list opens there to order; here the trip is marked sent and you go back to My kitchen.",
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
    showToast("Everything you ticked is already on this trip.", "error");
    return;
  }
  showToast(plural(added, "recipe", "recipes") + " added to the trip. A recipe already on it is never added twice.");
}

/* ---------- start ---------- */

document.addEventListener("DOMContentLoaded", function () {
  var user = currentUser();
  var id = queryNumber("trip");
  trip = id === null ? null : tripById(id);
  if (user === null || !canShop(user) || trip === null || trip.userId !== user.id) {
    document.getElementById("tripArea").innerHTML = "<span class='pill'>Shopping trip</span><h1>Shopping trip</h1>" +
      "<div class='card notice-card'><p>" + (user === null ? signInLink("see your shopping trips") + "."
        : !canShop(user) ? "Admin accounts do not shop." : "There is no trip of yours at this address. <a href='kitchen.html'>Back to My kitchen</a>.") +
      "</p></div>";
    return;
  }
  tripUser = user;
  renderTrip();
  var added = queryNumber("added");
  if (added !== null) {
    if (added === 0) { showToast("Nothing added: it is already on this trip.", "error"); }
    else { showToast(plural(added, "recipe", "recipes") + " added. This is your trip: shop it or send it when you are ready."); }
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
    showToast("Happy shopping. Tick things off as you go.");
  });
  document.getElementById("sendInstacart").addEventListener("click", function () { send("Instacart"); });
  document.getElementById("sendFavor").addEventListener("click", function () { send("Favor"); });
  document.getElementById("finishTrip").addEventListener("click", finish);
  document.getElementById("shopAgain").addEventListener("click", shopAgain);
  document.getElementById("printTrip").addEventListener("click", function () { window.print(); });
  document.getElementById("addMore").addEventListener("click", function () {
    document.getElementById("buildPlans").innerHTML = pickerPlansHtml(tripUser, trip.id);
    document.getElementById("buildRecipes").innerHTML = pickerRecipesHtml(tripUser, { withDays: false, preRecipeId: null, tripId: trip.id });
    wirePicker(document.getElementById("buildForm"));
    document.getElementById("buildError").textContent = "";
    document.getElementById("buildDialog").showModal();
  });
  document.getElementById("buildForm").addEventListener("submit", onAddSubmitted);
  document.getElementById("buildCancel").addEventListener("click", function () { document.getElementById("buildDialog").close(); });
  document.getElementById("deleteTrip").addEventListener("click", function () {
    confirmDialog("Delete the trip \"" + trip.name + "\"? Its list goes with it.", "Delete trip").then(function (ok) {
      if (!ok) { return; }
      deleteTrip(trip.id);
      window.location.href = "kitchen.html";
    });
  });
});
