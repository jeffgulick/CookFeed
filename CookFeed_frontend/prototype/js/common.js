/* Cookfeed prototype - functions shared by every page.
   Loaded after data.js and before the page-specific script on each page. */

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
      stars = stars + "★";
    } else {
      stars = stars + "☆";
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
   characters instead of changing the page. */
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* ---------- saving data in the browser ----------
   There is no server yet, so the cart, saved recipes and posted reviews are kept
   in the browser's localStorage. Each read and write is wrapped in try/catch
   because storage can be switched off (private windows, strict privacy settings);
   when it is, the page still works and simply forgets on reload. */

var STORAGE_KEYS = {
  cart: "cookfeed.cart",
  saves: "cookfeed.saves",
  reviews: "cookfeed.reviews",
  orders: "cookfeed.orders"
};

function loadJson(key, fallback) {
  try {
    var text = window.localStorage.getItem(key);
    if (text === null) {
      return fallback;
    }
    return JSON.parse(text);
  } catch (error) {
    return fallback;
  }
}

function saveJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    return false;
  }
}

/* ---------- cart ----------
   One entry per product, shaped like a cart_items row: { productId, addedAt },
   plus a quantity. The quantity is a prototype-only feature for practising
   number handling in JavaScript: the database design has no quantity column,
   because a digital plan is owned once. */

var CART_MAX_QUANTITY = 10;

function getCart() {
  return loadJson(STORAGE_KEYS.cart, []);
}

function isInCart(productId) {
  var cart = getCart();
  for (var i = 0; i < cart.length; i = i + 1) {
    if (cart[i].productId === productId) {
      return true;
    }
  }
  return false;
}

/* Returns false when the product was already there, true when it was added. */
function addProductToCart(productId) {
  if (isInCart(productId)) {
    return false;
  }
  var cart = getCart();
  cart.push({ productId: productId, addedAt: new Date().toISOString(), quantity: 1 });
  saveJson(STORAGE_KEYS.cart, cart);
  updateCartChip();
  return true;
}

function removeProductFromCart(productId) {
  var cart = getCart().filter(function (item) { return item.productId !== productId; });
  saveJson(STORAGE_KEYS.cart, cart);
  updateCartChip();
}

/* How many of one product are in the cart. Entries saved before quantities
   existed have no quantity, which counts as 1. */
function cartQuantity(item) {
  return typeof item.quantity === "number" && item.quantity >= 1 ? item.quantity : 1;
}

/* Set a product's quantity, kept between 1 and CART_MAX_QUANTITY.
   Returns the quantity actually stored. */
function setCartQuantity(productId, quantity) {
  var cart = getCart();
  var stored = Math.min(CART_MAX_QUANTITY, Math.max(1, Math.round(quantity)));

  for (var i = 0; i < cart.length; i = i + 1) {
    if (cart[i].productId === productId) {
      cart[i].quantity = stored;
    }
  }

  saveJson(STORAGE_KEYS.cart, cart);
  updateCartChip();
  return stored;
}

/* Total number of units in the cart, adding up every line's quantity. */
function cartUnitCount() {
  var cart = getCart();
  var units = 0;
  for (var i = 0; i < cart.length; i = i + 1) {
    units = units + cartQuantity(cart[i]);
  }
  return units;
}

function clearCart() {
  saveJson(STORAGE_KEYS.cart, []);
  updateCartChip();
}

/* Every page's nav has a cart chip. Show the real number of units in it. */
function updateCartChip() {
  var chip = document.getElementById("cartCount");
  if (chip !== null) {
    chip.textContent = cartUnitCount();
  }
}

/* ---------- saved recipes ----------
   Shaped like saved_recipes rows: { recipeId, savedAt }. Shared by the product
   page and the recipe pages, so saving on one shows as saved on the other. */

function getSaves() {
  return loadJson(STORAGE_KEYS.saves, []);
}

function isSaved(recipeId) {
  var saves = getSaves();
  for (var i = 0; i < saves.length; i = i + 1) {
    if (saves[i].recipeId === recipeId) {
      return true;
    }
  }
  return false;
}

/* Save the recipe if it is not saved, unsave it if it is.
   Returns the new state: true means it is now saved. */
function toggleSave(recipeId) {
  var saves = getSaves();
  var nowSaved = !isSaved(recipeId);

  if (nowSaved) {
    saves.push({ recipeId: recipeId, savedAt: new Date().toISOString() });
  } else {
    saves = saves.filter(function (item) { return item.recipeId !== recipeId; });
  }

  saveJson(STORAGE_KEYS.saves, saves);
  return nowSaved;
}

/* The published save count plus this shopper's own save, the way the
   denormalized recipes.save_count moves when someone saves a recipe. */
function currentSaveCount(recipe) {
  return recipe.saveCount + (isSaved(recipe.id) ? 1 : 0);
}

/* ---------- shopping list ----------
   Shared by the product page (the plan's three recipes) and My kitchen (the
   shopper's saved recipes). */

/* Tooltip on every Save button, so a first-time visitor knows what saving does. */
var SAVE_HINT = "Saving keeps this recipe in My kitchen and adds its ingredients to your shopping list there";

/* Every ingredient across the given recipes, each tagged with its own recipe's
   servings. Recipes do not all serve the same number (teriyaki and stir-fry
   serve 2, onigiri serves 4), so each line has to be scaled against its own recipe. */
function collectIngredients(recipeIds) {
  var rows = [];

  for (var i = 0; i < recipeIds.length; i = i + 1) {
    var recipe = RECIPES[recipeIds[i]];

    for (var j = 0; j < recipe.ingredients.length; j = j + 1) {
      var item = recipe.ingredients[j];
      rows.push({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        aisle: item.aisle,
        baseServings: recipe.servings,
        recipeTitle: recipe.title
      });
    }
  }

  return rows;
}

/* Add up the ingredients of the given recipes. Pass null for people to keep each
   recipe as published, or a number to cook every recipe for that many people.
   Two lines only merge when they share a name AND a unit, which is why the two
   soy sauce entries become one row but the rice and the ginger never combine.
   Each line remembers which recipes it came from. The result is sorted by aisle
   so the list follows a walk through the store. */
function buildShoppingList(recipeIds, people) {
  var rows = collectIngredients(recipeIds);
  var totals = {};
  var list = [];

  for (var i = 0; i < rows.length; i = i + 1) {
    var row = rows[i];
    var scale = 1;

    if (people !== null) {
      scale = people / row.baseServings;
    }

    var key = row.name + "|" + row.unit;

    if (totals[key] === undefined) {
      totals[key] = { key: key, name: row.name, unit: row.unit, aisle: row.aisle, amount: 0, recipes: [] };
      list.push(totals[key]);
    }
    totals[key].amount = totals[key].amount + row.quantity * scale;
    if (totals[key].recipes.indexOf(row.recipeTitle) === -1) {
      totals[key].recipes.push(row.recipeTitle);
    }
  }

  list.sort(function (a, b) {
    if (a.aisle !== b.aisle) {
      return a.aisle < b.aisle ? -1 : 1;
    }
    return a.name < b.name ? -1 : 1;
  });

  return list;
}

/* ---------- servings ----------
   Used by the servings boxes on the product page and the recipe pages. */

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

/* ---------- reviews ----------
   The seed reviews from data.js plus any the shopper posted, which are kept in
   localStorage. Shared so the product page can show the average rating too. */

function getPostedReviews() {
  return loadJson(STORAGE_KEYS.reviews, []);
}

function getAllReviews(productId) {
  return getPostedReviews().concat(SEED_REVIEWS).filter(function (review) {
    return review.productId === productId;
  });
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
  notice.textContent = "This browser is blocking sites from saving data, so the cart, saved " +
    "recipes and new reviews reset when you change pages. Allow site data for this page, " +
    "or open it in a different browser, to see them carry over.";
  main.insertBefore(notice, main.firstChild);
}

/* Every page shows the cart count as soon as it loads, and the storage
   notice when saving is blocked. */
document.addEventListener("DOMContentLoaded", function () {
  updateCartChip();
  if (storageWorks() === false) {
    showStorageNotice();
  }
});
