/* Cookfeed prototype - functions shared by every page.
   Loaded after seed-data.js, db.js and rules.js, and before the page's own script. */

/* ---------- formatting ---------- */

/* Turn a whole number of cents into a price string.
   Prices are stored as integer cents so money math never picks up
   floating point rounding errors. */
function formatPrice(cents) {
  var dollars = cents / 100;
  return "$" + dollars.toFixed(2);
}

/* Build a five character star rating out of filled and empty stars. */
function buildStars(rating) {
  var stars = "";
  for (var i = 1; i <= 5; i = i + 1) {
    if (i <= rating) {
      stars = stars + "\u2605";
    } else {
      stars = stars + "\u2606";
    }
  }
  return stars;
}

/* Tidy a scaled quantity for display: 1500 stays 1500, 4.5 stays 4.5,
   and 2.00 becomes 2 instead of showing pointless decimal places. */
function formatQuantity(amount) {
  var rounded = Math.round(amount * 100) / 100;
  return String(rounded);
}

/* Turn an ISO date string such as "2026-08-12T12:00:00Z" into "August 12, 2026". */
function formatDate(isoText) {
  var date = new Date(isoText);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/* Make text safe to place inside innerHTML. Anything a shopper types, such as a
   review, goes through this first, so typing <b> or a <script> tag shows the
   characters instead of changing the page. Text from the database goes through
   it too, because in the real application creators type that text. */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function plural(count, one, many) {
  return count + " " + (count === 1 ? one : many);
}

/* ---------- reading the address ----------
   The page templates name what they show in the query string: product.html?id=3,
   creator.html?handle=kenji-kitchen. */

function queryText(name) {
  return new URLSearchParams(window.location.search).get(name);
}

/* A whole-number parameter, or null when it is missing or not a number. */
function queryNumber(name) {
  var text = queryText(name);
  return text !== null && /^[0-9]+$/.test(text) ? Number(text) : null;
}

/* Replace the page's content with a short message, for an id that names nothing. */
function showMissing(heading, message) {
  document.title = heading + " | Cookfeed";
  document.querySelector("main").innerHTML =
    "<div class='card notice-card'><h1>" + escapeHtml(heading) + "</h1><p>" + message + "</p>" +
    "<p><a href='index.html'>Back to Discover</a></p></div>";
}

/* ---------- who is signed in ----------
   The prototype's stand-in for logging in, the same idea as the API's X-User-Id header until real
   login arrives: signin.html stores the id of one of the seeded accounts, and every page reads it back. */

var USER_KEY = "cookfeed.userId";

var ROLE_LABELS = { HomeCook: "Home cook", Creator: "Creator", Admin: "Admin" };

/* The signed-in account (userById's shape), or null when browsing signed out or the stored id no
   longer names a user. */
function currentUser() {
  var id = loadJson(USER_KEY, null);
  return typeof id === "number" ? userById(id) : null;
}

function signIn(userId) {
  saveJson(USER_KEY, userId);
}

function signOut() {
  removeStored(USER_KEY);
}

/* A link that sends a signed-out visitor to sign in, e.g. "Sign in to save". */
function signInLink(action) {
  return "<a class='sign-in-to' href='signin.html'>Sign in to " + action + "</a>";
}

/* The nav's account area: "Sign in" when signed out, otherwise the account's name and a Sign out
   button. Signing out reloads the page, so everything on it is drawn again for a guest. */
function updateAccountArea() {
  var area = document.getElementById("accountArea");
  if (!area) {
    return;
  }
  var user = currentUser();
  if (!user) {
    area.innerHTML = '<a class="navlink" href="signin.html">Sign in</a>';
    return;
  }
  area.innerHTML =
    '<a class="account-name" href="signin.html" title="Switch account">Signed in as <strong>' +
    escapeHtml(user.displayName) + '</strong></a>' +
    '<button type="button" class="link-button" id="signOutButton">Sign out</button>';
  document.getElementById("signOutButton").addEventListener("click", function () {
    signOut();
    window.location.reload();
  });
}

/* Links marked data-shop (My kitchen, Your orders, the cart) belong to shoppers. The admin account
   never shops (design section 3.1), so its nav leaves them out. */
/* The studio link is for creators and the Admin link for the admin (3.8). */
function updateRoleLinks() {
  var user = currentUser();
  var creatorLinks = document.querySelectorAll("[data-creator]");
  var adminLinks = document.querySelectorAll("[data-admin]");
  for (var i = 0; i < creatorLinks.length; i = i + 1) { creatorLinks[i].hidden = !isCreator(user); }
  for (var k = 0; k < adminLinks.length; k = k + 1) { adminLinks[k].hidden = !isAdmin(user); }
}

function updateShopLinks() {
  var hide = currentUser() !== null && !canShop(currentUser());
  var links = document.querySelectorAll("[data-shop]");
  for (var i = 0; i < links.length; i = i + 1) {
    links[i].hidden = hide;
  }
}

/* ---------- cart chip ---------- */

function updateCartChip() {
  var chip = document.getElementById("cartCount");
  var user = currentUser();
  if (chip !== null) {
    chip.textContent = user === null ? 0 : cartFor(user.id).length;
  }
}

/* ---------- products ---------- */

function productTypeLabel(product) {
  return product.type === "MealPlan" ? "Meal plan" : "Recipe collection";
}

/* "plan" or "collection", for sentences such as "You own this plan". */
function productNoun(product) {
  return product.type === "MealPlan" ? "plan" : "collection";
}

/* "5 recipes, 6 meals" for a meal plan that repeats a recipe; "3 recipes" for a collection. */
function productCounts(product) {
  var text = plural(product.recipeCount, "recipe", "recipes");
  if (product.mealCount !== null && product.mealCount !== product.recipeCount) {
    text = text + ", " + plural(product.mealCount, "meal", "meals");
  }
  return text;
}

function productUrl(productId) {
  return "product.html?id=" + productId;
}

/* "by kenji-kitchen (Verified creator)", linked to the storefront. */
function creatorByline(creator) {
  var html = "by <a href='creator.html?handle=" + encodeURIComponent(creator.handle) + "'>" +
    escapeHtml(creator.handle) + "</a>";
  if (creator.isVerified) {
    html = html + " <span class='verified' title='Cookfeed has confirmed this creator is who they say they are'>" +
      "&#10003; Verified creator</span>";
  }
  return html;
}

/* The average star rating of a product's reviews, or null when it has none. */
function averageRating(productId) {
  var reviews = reviewsFor(productId);
  if (reviews.length === 0) {
    return null;
  }
  var total = reviews.reduce(function (sum, r) { return sum + r.rating; }, 0);
  return { average: total / reviews.length, count: reviews.length };
}

function ratingText(productId) {
  var rating = averageRating(productId);
  return rating === null ? "no reviews yet"
    : "\u2605 " + rating.average.toFixed(1) + " (" + plural(rating.count, "review", "reviews") + ")";
}

/* The buy area of a product, from rules.js buyState. Used by the product page and the storefront.
   onChange runs after the cart changes, so the page can redraw what depends on it. */
function renderBuyArea(container, product, onChange) {
  var user = currentUser();
  var state = buyState(user, product);
  var noun = productNoun(product);
  var html = "";

  if (state === "buy") {
    html = "<button type='button' class='btn-primary buy-button'>Add to cart &mdash; " +
      formatPrice(product.priceCents) + "</button>";
  } else if (state === "inCart") {
    html = "<a class='btn-primary done' href='cart.html'>In your cart &#10003; &mdash; go to cart</a>";
  } else if (state === "owned") {
    html = "<span class='owned-label'>&#10003; You own this " + noun + "</span> " +
      "<a class='meta' href='orders.html'>See your orders</a>";
  } else if (state === "yourOwn") {
    html = "<span class='meta'>This is your " + noun + ". Creators can't buy their own.</span>";
  } else if (state === "notForSale") {
    html = "<span class='meta'>No longer for sale</span>";
  } else if (state === "signIn") {
    html = signInLink("buy");
  }
  // noShop: the admin sees no shop controls at all.

  container.innerHTML = html;

  var button = container.querySelector(".buy-button");
  if (button !== null) {
    button.addEventListener("click", function () {
      addToCart(user.id, product.id);
      updateCartChip();
      renderBuyArea(container, product, onChange);
      showToast(product.title + " added to your cart.");
      if (onChange) { onChange(); }
    });
  }
}

/* ---------- recipe cards ----------
   One card shape for every grid of recipes: Discover, a product, a storefront and My kitchen.
   options:
     label      a line above the title, such as "Monday dinner"
     productId  link to the recipe in the context of this product
     preview    include the hover preview of times, counts and the first step
     locked     the viewer cannot open it: no link, and a note instead of the save button
     foot       HTML for the card's foot, replacing the save count and Save button */

/* Tooltip on every Save button, so a first-time visitor knows what saving does. */
var SAVE_HINT = "Saving keeps this recipe in My kitchen, ready to plan into a week and a shopping list";

function recipeHref(recipe, productId) {
  return recipe.pageUrl + (productId ? "&product=" + productId : "");
}

/* "saved by 1 cook" or "saved by 7 cooks": the wording first-time visitors understood best (Homework 3). */
function savedByText(count) {
  return "saved by " + plural(count, "cook", "cooks");
}

function saveButtonHtml(recipe) {
  var user = currentUser();
  if (user === null) {
    return signInLink("save");
  }
  if (!canSave(user, recipe)) {
    return "";
  }
  var saved = isSavedBy(user.id, recipe.id);
  return "<button type='button' class='btn-small save-button" + (saved ? " saved" : "") + "' title='" + SAVE_HINT +
    "' data-recipe-id='" + recipe.id + "'>" + (saved ? "Saved &#10003;" : "Save recipe") + "</button>";
}

function recipeCardHtml(recipe, options) {
  var href = recipeHref(recipe, options.productId);
  var minutes = (recipe.prepMinutes || 0) + (recipe.cookMinutes || 0);
  var image = "<img src='" + escapeHtml(recipe.thumbnailUrl || "") + "' alt='" + escapeHtml(recipe.title) + "'>";
  var html = "<div class='recipe-card" + (options.locked ? " locked" : "") + "' data-recipe-id='" + recipe.id + "'>";

  if (options.locked) {
    html = html + "<div class='card-media'>" + image + "</div>";
  } else {
    html = html + "<a class='card-media' href='" + href + "'>" + image;
    if (options.preview && recipe.steps.length > 0) {
      html = html + "<div class='preview' aria-hidden='true'>";
      html = html + "<div><b>" + recipe.prepMinutes + " min prep &middot; " + recipe.cookMinutes + " min cook</b></div>";
      html = html + "<div>" + recipe.ingredients.length + " ingredients &middot; " + recipe.steps.length + " steps</div>";
      html = html + "<div class='preview-step'>First: " + escapeHtml(recipe.steps[0].instruction) + "</div>";
      html = html + "</div>";
    }
    html = html + "</a>";
  }

  html = html + "<div class='recipe-body'>";
  if (options.label) {
    html = html + "<div class='day'>" + escapeHtml(options.label) + "</div>";
  }
  html = html + "<div class='recipe-title'>" + (options.locked ? escapeHtml(recipe.title)
    : "<a href='" + href + "'>" + escapeHtml(recipe.title) + "</a>") + "</div>";
  html = html + "<div class='meta'>Serves " + recipe.servings + " &middot; " + minutes + " min</div>";

  var user = currentUser();
  var through = recipe.visibility === "ProductOnly" ? ownedThrough(user, recipe.id) : null;
  if (options.locked) {
    html = html + "<div class='lock-label'>&#128274; Included when you buy the " +
      (options.productNoun || "plan") + "</div>";
  } else if (through !== null) {
    html = html + "<div class='owned-label'>Yours through " + escapeHtml(through) + "</div>";
  }

  if (options.foot !== undefined) {
    html = html + "<div class='recipe-foot'>" + options.foot + "</div>";
  } else if (!options.locked) {
    html = html + "<div class='recipe-foot'>";
    html = html + "<span class='meta save-text'>" + savedByText(saveCount(recipe.id)) + "</span>";
    html = html + saveButtonHtml(recipe);
    html = html + "</div>";
  }
  html = html + "</div></div>";
  return html;
}

/* Save buttons on any grid of cards. One listener per grid handles every card (event delegation). */
function wireSaveButtons(grid, onChange) {
  grid.addEventListener("click", function (event) {
    var button = event.target.closest(".save-button");
    if (button === null) {
      return;
    }
    var user = currentUser();
    var recipe = rowById("recipes", Number(button.getAttribute("data-recipe-id")));
    var nowSaved = !isSavedBy(user.id, recipe.id);
    setSaved(user.id, recipe.id, nowSaved);

    button.innerHTML = nowSaved ? "Saved &#10003;" : "Save recipe";
    button.classList.toggle("saved", nowSaved);
    var count = button.closest(".recipe-card").querySelector(".save-text");
    if (count !== null) {
      count.textContent = savedByText(saveCount(recipe.id));
    }
    showToast(nowSaved ? recipe.title + " saved to My kitchen."
                       : recipe.title + " removed from your saved recipes.");
    if (onChange) { onChange(); }
  });
}

/* ---------- product tiles and card previews ----------
   Shared by Discover, Plans and Recipes. */

/* One tile per plan or collection for sale. A plan the viewer owns says so. */
function productTileHtml(product) {
  var creator = creatorFor(product.creatorId);
  var owned = ownsProduct(currentUser(), product.id);
  return "<a class='card product-tile" + (owned ? " owned" : "") + "' href='" + productUrl(product.id) + "'>" +
    "<img src='" + escapeHtml(product.coverImageUrl || "") + "' alt=''>" +
    "<span class='pill'>" + productTypeLabel(product) + "</span>" +
    "<span class='recipe-title'>" + escapeHtml(product.title) + "</span>" +
    "<span class='meta'>by " + escapeHtml(creator.handle) + " &middot; " + productCounts(product) + "</span>" +
    "<span class='meta'>" + ratingText(product.id) + "</span>" +
    (owned ? "<span class='owned-label'>&#10003; You own this</span>" : "<span class='price'>" + formatPrice(product.priceCents) + "</span>") +
    "</a>";
}

/* Hovering or focusing a recipe card shows its preview, as on a product page. */
function wirePreviews(grid) {
  var cards = grid.querySelectorAll(".recipe-card");
  for (var i = 0; i < cards.length; i = i + 1) {
    cards[i].addEventListener("mouseenter", function (event) { event.currentTarget.classList.add("previewing"); });
    cards[i].addEventListener("mouseleave", function (event) { event.currentTarget.classList.remove("previewing"); });
    cards[i].addEventListener("focusin", function (event) { event.currentTarget.classList.add("previewing"); });
    cards[i].addEventListener("focusout", function (event) { event.currentTarget.classList.remove("previewing"); });
  }
}

/* ---------- servings ----------
   Used by the servings boxes on the product page and the recipe page. */

/* Check what the shopper typed. Returns an error message, or "" when the
   value is a whole number of people inside the allowed range. */
function servingsProblem(text) {
  if (text.trim() === "") {
    return "Enter how many people you are cooking for.";
  }

  var people = Number(text);

  if (isNaN(people) || Math.floor(people) !== people) {
    return "Use a whole number of people.";
  }
  if (people < LIMITS.servingsMin || people > LIMITS.servingsMax) {
    return "Choose between " + LIMITS.servingsMin + " and " + LIMITS.servingsMax + " people.";
  }
  return "";
}

/* ---------- feedback ----------
   A small message that slides up at the bottom of the screen and fades away on
   its own. It replaces most of the alert() boxes from Homework 1, which stopped
   the shopper and made them click OK before they could carry on. */

var toastTimer = null;

function showToast(message, kind) {
  var toast = document.getElementById("toast");

  if (toast === null) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.className = "toast show" + (kind === "error" ? " error" : "");

  if (toastTimer !== null) {
    window.clearTimeout(toastTimer);
  }
  toastTimer = window.setTimeout(function () {
    toast.className = "toast";
  }, 3200);
}

/* ---------- confirmation dialog ----------
   Cookfeed's own version of confirm(): the same question and two buttons, in the site's style, as a
   modal <dialog>. It returns a Promise of true (confirmed) or false (cancelled, Escape, or a click on
   the backdrop), so callers write confirmDialog(...).then(function (ok) { ... }). Focus goes back to
   whatever had it before, usually the button that asked. */

function confirmDialog(message, confirmLabel) {
  var dialog = document.getElementById("confirmDialog");
  var opener = document.activeElement;

  if (dialog === null) {
    dialog = document.createElement("dialog");
    dialog.id = "confirmDialog";
    dialog.className = "confirm-dialog";
    dialog.setAttribute("aria-labelledby", "confirmMessage");
    dialog.innerHTML =
      "<form method='dialog'>" +
      "<p id='confirmMessage'></p>" +
      "<div class='dialog-actions'>" +
      "<button type='submit' value='cancel' class='btn-secondary' id='confirmCancel'>Cancel</button>" +
      "<button type='submit' value='confirm' class='btn-primary' id='confirmOk'></button>" +
      "</div></form>";
    document.body.appendChild(dialog);

    // A click on the backdrop lands on the dialog element itself, outside its form: treat it as Cancel.
    dialog.addEventListener("click", function (event) {
      if (event.target === dialog) { dialog.close("cancel"); }
    });
  }

  document.getElementById("confirmMessage").textContent = message;
  document.getElementById("confirmOk").textContent = confirmLabel || "OK";
  dialog.returnValue = "cancel";

  return new Promise(function (resolve) {
    dialog.addEventListener("close", function onClose() {
      dialog.removeEventListener("close", onClose);
      if (opener && typeof opener.focus === "function" && document.contains(opener)) {
        opener.focus();
      }
      resolve(dialog.returnValue === "confirm");
    });
    dialog.showModal();
    document.getElementById("confirmCancel").focus();
  });
}

/* ---------- the menu on small screens ----------
   On a phone the nav's links fold into a Menu button (see "small screens" in styles.css). The button
   is hidden in the HTML and shown here, so without JavaScript the links simply stay visible. */

function setUpMenu() {
  var nav = document.querySelector(".nav");
  var button = document.getElementById("menuButton");
  if (nav === null || button === null) {
    return;
  }

  function setOpen(open) {
    nav.classList.toggle("open", open);
    button.setAttribute("aria-expanded", String(open));
    button.textContent = open ? "Close" : "Menu";
  }

  nav.classList.add("has-menu");
  button.hidden = false;
  button.addEventListener("click", function () {
    setOpen(!nav.classList.contains("open"));
  });

  // Escape closes the open menu and puts focus back on its button.
  nav.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && nav.classList.contains("open")) {
      setOpen(false);
      button.focus();
    }
  });
}

/* ---------- storage check ----------
   Some browsers are set to stop sites from saving data. The prototype still
   works there, but the cart, saves and reviews reset on every page. Rather than
   let that look like a bug, a notice explains it. */

function storageWorks() {
  try {
    var key = "cookfeed.storage-test";
    window.localStorage.setItem(key, "1");
    var ok = window.localStorage.getItem(key) === "1";
    window.localStorage.removeItem(key);
    return ok;
  } catch (error) {
    return false;
  }
}

function showStorageNotice() {
  var main = document.querySelector("main");
  if (main === null || document.getElementById("storageNotice") !== null) {
    return;
  }

  var notice = document.createElement("div");
  notice.id = "storageNotice";
  notice.className = "storage-notice";
  notice.setAttribute("role", "note");
  notice.textContent = "This browser is blocking sites from saving data, so the sign-in, cart, saved " +
    "recipes and new reviews reset when you change pages. Allow site data for this page, " +
    "or open it in a different browser, to see them carry over.";
  main.insertBefore(notice, main.firstChild);
}

/* Every page shows who is signed in, the shopper's links and cart count as soon as it loads, and the
   storage notice when saving is blocked. */
document.addEventListener("DOMContentLoaded", function () {
  setUpMenu();
  updateAccountArea();
  updateShopLinks();
  updateRoleLinks();
  updateCartChip();
  if (storageWorks() === false) {
    showStorageNotice();
  }
});

/* ---------- the picker: what to cook ----------
   Used by the Build dialog on My kitchen and the Add recipes dialog on a trip page: the plans the cook owns
   (each goes on as a whole) and the recipes they saved, each with the people to cook for. With withDays,
   each recipe also gets a day and meal, for putting it on a week. */
function pickerPlansHtml(user) {
  return ownedProductsFor(user).map(function (o) {
    return "<label class='radio'><input type='checkbox' class='pick-plan' value='" + o.product.id + "'> " +
      escapeHtml(o.productTitle) + " <span class='meta'>(" + productCounts(o) + ")</span></label>";
  }).join("") || "<p class='meta'>You have not bought a plan yet.</p>";
}

function pickerRecipesHtml(user, options) {
  var dayOptions = DAY_NAMES.map(function (day, i) { return "<option value='" + i + "'>" + day + "</option>"; }).join("");
  var slotOptions = SLOT_ORDER.map(function (slot) {
    return "<option value='" + slot + "'" + (slot === "Dinner" ? " selected" : "") + ">" + slot + "</option>";
  }).join("");
  return savesFor(user.id).map(function (save) {
    var recipe = rowById("recipes", save.recipeId);
    return "<div class='placement'><label><input type='checkbox' class='pick-recipe' value='" + recipe.id + "'" +
      (recipe.id === options.preRecipeId ? " checked" : "") + "> " + escapeHtml(recipe.title) + "</label>" +
      "<span class='pick-people'>for <input type='number' class='pick-servings' min='1' max='20' value='" + recipe.servings +
        "' aria-label='People for " + escapeHtml(recipe.title) + "'> people</span>" +
      (options.withDays ? "<span class='pick-when'><select aria-label='Day for " + escapeHtml(recipe.title) + "' class='pick-day'>" + dayOptions +
        "</select> <select aria-label='Meal for " + escapeHtml(recipe.title) + "' class='pick-slot'>" + slotOptions + "</select></span>" : "") +
      "</div>";
  }).join("") || "<p class='meta'>Save a recipe first, and it appears here.</p>";
}

/* What was ticked: the plan ids, and the recipes with people (and day and meal when asked). */
function readPicker(root) {
  var productIds = [];
  var plans = root.querySelectorAll(".pick-plan:checked");
  for (var i = 0; i < plans.length; i = i + 1) { productIds.push(Number(plans[i].value)); }
  var items = [];
  var rows = root.querySelectorAll(".placement");
  for (var k = 0; k < rows.length; k = k + 1) {
    var box = rows[k].querySelector(".pick-recipe");
    if (!box.checked) { continue; }
    var people = Number(rows[k].querySelector(".pick-servings").value);
    var day = rows[k].querySelector(".pick-day");
    items.push({ recipeId: Number(box.value), servings: people > 0 ? people : 0,
      dayOffset: day ? Number(day.value) : null, slot: day ? rows[k].querySelector(".pick-slot").value : null });
  }
  return { productIds: productIds, items: items };
}
