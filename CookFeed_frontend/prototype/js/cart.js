/* Cookfeed prototype - cart and checkout page

   The signed-in account's cart_items rows: one copy of each plan, because a digital plan is owned
   once. Checkout writes what the API will write (db.js placeOrder): the order, its lines, and the
   snapshot of each plan's recipes that the buyer keeps.

   Interactions on this page:
     - Remove takes one line out; Empty cart takes everything out
     - Place order turns the cart into a stored order and shows a receipt */

/* The cart rows joined to their products, skipping anything no longer sold. */
function cartProducts() {
  return buyableCartItems(currentUser()).map(function (item) { return productWithRecipes(item.productId); });
}

/* A plan that went off sale (retired, its creator suspended) or that the shopper now owns leaves the cart,
   and the shopper is told once, rather than seeing a count the cart page does not explain. */
function dropUnbuyable() {
  var user = currentUser();
  var keep = buyableCartItems(user).map(function (item) { return item.productId; });
  var gone = cartFor(user.id).filter(function (item) { return keep.indexOf(item.productId) === -1; });
  gone.forEach(function (item) { removeFromCart(user.id, item.productId); });
  return gone.map(function (item) { return rowById("products", item.productId).title; });
}

function cartTotal(products) {
  return products.reduce(function (sum, product) { return sum + product.priceCents; }, 0);
}

/* Redraw the cart: the lines, the totals, and whichever message belongs with an empty or a filled cart. */
function renderCart() {
  var products = cartProducts();
  var html = "";

  for (var i = 0; i < products.length; i = i + 1) {
    var product = products[i];
    var creator = creatorFor(product.creatorId);

    html = html + "<div class='line-item' data-product-id='" + product.id + "'>";
    html = html + "<img src='" + escapeHtml(product.coverImageUrl || "") + "' alt=''>";
    html = html + "<div class='line-body'>";
    html = html + "<span class='pill'>" + productTypeLabel(product) + "</span>";
    html = html + "<div class='recipe-title'><a href='" + productUrl(product.id) + "'>" + escapeHtml(product.title) + "</a></div>";
    html = html + "<div class='meta'>by " + escapeHtml(creator.handle) + " &middot; " + productCounts(product) + "</div>";
    html = html + "<div class='line-actions'><button class='btn-small remove-item'>Remove</button></div>";
    html = html + "</div>";
    html = html + "<div class='line-price'>" + formatPrice(product.priceCents) + "</div>";
    html = html + "</div>";
  }

  var total = cartTotal(products);

  document.getElementById("cartLines").innerHTML = html;
  document.getElementById("itemCount").textContent = products.length;
  document.getElementById("itemWord").textContent = products.length === 1 ? "item" : "items";
  document.getElementById("subtotal").textContent = formatPrice(total);
  document.getElementById("orderTotal").textContent = formatPrice(total);

  var isEmpty = products.length === 0;
  document.getElementById("emptyNote").innerHTML = isEmpty
    ? "Your cart is empty. <a href='plans.html'>See the meal plans and collections</a>."
    : "";
  // "Still deciding?" is for a cart with something in it; an empty cart already says where to look.
  var foot = document.getElementById("cartFoot");
  foot.hidden = isEmpty;
  foot.innerHTML = isEmpty ? "" : "<p><strong>Still deciding?</strong></p>" +
    "<p><a href='plans.html'>See more plans</a> &middot; <a href='orders.html'>Your orders</a></p>";
  document.getElementById("checkoutButton").disabled = isEmpty;
  document.getElementById("emptyCartButton").hidden = isEmpty;
  updateCartChip();
}

/* Remove clicks inside the cart lines. One listener handles every line (event delegation). */
function onCartClicked(event) {
  var button = event.target.closest(".remove-item");
  if (button === null) {
    return;
  }

  var product = rowById("products", Number(button.closest(".line-item").getAttribute("data-product-id")));
  confirmDialog("Remove " + product.title + " from your cart?", "Remove").then(function (ok) {
    if (!ok) {
      return;
    }
    removeFromCart(currentUser().id, product.id);
    renderCart();
    showToast(product.title + " was removed.");
    // The line and its button are gone: put focus somewhere that still exists.
    document.getElementById("main").focus({ preventScroll: true });
  });
}

/* Take everything out of the cart at once, after checking that is what was meant. */
function emptyCart() {
  var count = cartProducts().length;
  if (count === 0) {
    return;
  }

  confirmDialog("Remove all " + plural(count, "item", "items") + " from your cart?", "Empty cart").then(function (ok) {
    if (!ok) {
      return;
    }
    clearCartOf(currentUser().id);
    renderCart();
    showToast("Your cart is empty.");
    document.getElementById("main").focus({ preventScroll: true });
  });
}

function orderNumber(order) {
  return "CF-" + String(order.id).padStart(5, "0");
}

/* Place the order, then show the receipt in place of the cart. */
function checkout() {
  var products = cartProducts();

  if (products.length === 0) {
    showToast("There is nothing in your cart yet.", "error");
    return;
  }

  confirmDialog("Place this order for " + formatPrice(cartTotal(products)) + "?", "Place order").then(function (ok) {
    if (ok) {
      showReceipt(placeOrder(currentUser().id));
    }
  });
}

/* The receipt replaces the cart. Focus moves to its heading, so a screen reader announces the order
   and a keyboard user carries on from there rather than from a button that no longer exists. Each plan
   bought leads to its page and to the week; buying put nothing on a shopping list (3.9). */
function showReceipt(order) {
  var lines = order.items.map(function (item) {
    return "<li data-product-id='" + item.productId + "'><strong>" + escapeHtml(item.productTitle) + "</strong> " +
      "<a class='btn-small' href='" + productUrl(item.productId) + "'>Open your plan</a> " +
      "<button type='button' class='btn-small receipt-week'>Add to my week</button></li>";
  }).join("");

  var html = "";
  html = html + "<div class='receipt'>";
  html = html + "<div class='receipt-check'>&#10003;</div>";
  html = html + "<h2 style='margin:6px 0' id='receiptHeading' tabindex='-1'>Order confirmed</h2>";
  html = html + "<p class='meta'>Order " + orderNumber(order) + "</p>";
  html = html + "<p>You paid <strong>" + formatPrice(order.totalCents) + "</strong> for " +
                plural(order.items.length, "plan", "plans") + ":</p><ul class='receipt-items'>" + lines + "</ul>";
  html = html + "<p>Every recipe in " + (order.items.length === 1 ? "it" : "them") + " is yours to keep. " +
                "Put " + (order.items.length === 1 ? "it" : "them") + " on your week, or shop " +
                (order.items.length === 1 ? "it" : "them") + " from the plan's page.</p>";
  html = html + "<p><a href='orders.html'>See your orders</a></p>";
  html = html + "</div>";

  document.getElementById("cartArea").innerHTML = html;
  document.querySelector("main h1").textContent = "Thank you";
  document.getElementById("cartByline").hidden = true;
  document.getElementById("cartFoot").hidden = true;
  document.getElementById("cartFoot").innerHTML = "";
  updateCartChip();
  document.getElementById("cartArea").addEventListener("click", function (event) {
    var week = event.target.closest(".receipt-week");
    if (week !== null) {
      openPlanProductDialog(currentUser(), rowById("products", Number(week.closest("li").getAttribute("data-product-id"))));
    }
  });
  document.getElementById("receiptHeading").focus();
  showToast("Thank you. Your order number is " + orderNumber(order) + ".");
}

document.addEventListener("DOMContentLoaded", function () {
  var user = currentUser();
  if (user === null || !canShop(user)) {
    document.getElementById("cartByline").hidden = true;
    document.getElementById("cartArea").innerHTML = "<div class='card notice-card'><p>" +
      (user === null ? signInLink("see your cart") + "." : "Admin accounts do not shop, so there is no cart.") +
      "</p></div>";
    return;
  }

  var gone = dropUnbuyable();
  renderCart();
  if (gone.length) {
    showToast(gone.join(" and ") + (gone.length === 1 ? " is" : " are") + " no longer for sale, so we took " +
      (gone.length === 1 ? "it" : "them") + " out of your cart.");
  }
  document.getElementById("cartLines").addEventListener("click", onCartClicked);
  document.getElementById("checkoutButton").addEventListener("click", checkout);
  document.getElementById("emptyCartButton").addEventListener("click", emptyCart);
});
