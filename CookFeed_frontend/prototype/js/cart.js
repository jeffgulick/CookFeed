/* Cookfeed prototype - cart and checkout page

   The cart is read from the browser's storage (see common.js), so whatever the
   shopper added on the product page is here, even after a reload.

   Interactions on this page:
     - minus / plus buttons and a number box change each line's quantity
     - Remove takes one line out; Empty cart takes everything out
     - Place order turns the cart into a stored order and shows a receipt */

/* Look up a product by id. The prototype sells one plan; the real application
   will read the products table instead. */
function findProduct(productId) {
  return productId === PRODUCT.id ? PRODUCT : null;
}

/* The cart rows joined to their products, skipping anything no longer sold.
   Each line is { product, quantity }. */
function cartLines() {
  var cart = getCart();
  var lines = [];

  for (var i = 0; i < cart.length; i = i + 1) {
    var product = findProduct(cart[i].productId);
    if (product !== null && product.isActive === true) {
      lines.push({ product: product, quantity: cartQuantity(cart[i]) });
    }
  }

  return lines;
}

/* Price of one line: unit price in cents times quantity. Whole cents in,
   whole cents out, so there is no floating point rounding. */
function lineTotal(line) {
  return line.product.priceCents * line.quantity;
}

function cartTotal(lines) {
  var total = 0;
  for (var i = 0; i < lines.length; i = i + 1) {
    total = total + lineTotal(lines[i]);
  }
  return total;
}

function unitCount(lines) {
  var units = 0;
  for (var i = 0; i < lines.length; i = i + 1) {
    units = units + lines[i].quantity;
  }
  return units;
}

/* Redraw the cart: the line items, the totals, and whichever message
   belongs with an empty or a filled cart. */
function renderCart() {
  var lines = cartLines();
  var html = "";

  for (var i = 0; i < lines.length; i = i + 1) {
    var product = lines[i].product;
    var quantity = lines[i].quantity;
    var typeLabel = product.type === "MealPlan" ? "Meal plan" : "Recipe collection";

    html = html + "<div class='line-item' data-product-id='" + product.id + "'>";
    html = html + "<img src='" + product.coverImageUrl + "' alt='" + escapeHtml(product.title) + "'>";
    html = html + "<div class='line-body'>";
    html = html + "<span class='pill'>" + typeLabel + "</span>";
    html = html + "<div class='recipe-title'>" + product.title + "</div>";
    html = html + "<div class='meta'>by " + CREATOR.handle + " &middot; " + product.recipes.length +
                  " recipes, " + product.recipes.length + " videos, 1 shopping list</div>";
    html = html + "<div class='line-actions'>";
    html = html + "<span class='meta copies-label'>Copies</span>";
    html = html + "<div class='stepper'>";
    html = html + "<button type='button' class='qty-down' aria-label='One fewer'" +
                  (quantity <= 1 ? " disabled" : "") + ">&minus;</button>";
    html = html + "<input type='number' class='qty-input' min='1' max='" + CART_MAX_QUANTITY + "' value='" +
                  quantity + "' aria-label='Quantity of " + escapeHtml(product.title) + "'>";
    html = html + "<button type='button' class='qty-up' aria-label='One more'" +
                  (quantity >= CART_MAX_QUANTITY ? " disabled" : "") + ">+</button>";
    html = html + "</div>";
    html = html + "<button class='btn-small remove-item'>Remove</button>";
    html = html + "</div>";
    html = html + "<div class='meta gift-note'>" + giftNote(quantity) + "</div>";
    html = html + "</div>";
    html = html + "<div class='line-price'>" + formatPrice(lineTotal(lines[i]));
    if (quantity > 1) {
      html = html + "<div class='meta each'>" + formatPrice(product.priceCents) + " each</div>";
    }
    html = html + "</div>";
    html = html + "</div>";
  }

  var total = cartTotal(lines);
  var units = unitCount(lines);

  document.getElementById("cartLines").innerHTML = html;
  document.getElementById("itemCount").textContent = units;
  document.getElementById("itemWord").textContent = units === 1 ? "item" : "items";
  document.getElementById("subtotal").textContent = formatPrice(total);
  document.getElementById("orderTotal").textContent = formatPrice(total);

  var isEmpty = lines.length === 0;
  document.getElementById("emptyNote").innerHTML = isEmpty
    ? "Your cart is empty. <a href='index.html'>Back to the meal plan</a>."
    : "";
  document.getElementById("checkoutButton").disabled = isEmpty;
  document.getElementById("emptyCartButton").hidden = isEmpty;
}

/* Explain what the copies are for. A plan is owned once, so the first copy is
   the shopper's and every extra copy is a gift with its own code. */
function giftNote(quantity) {
  if (quantity <= 1) {
    return "Buying for a friend too? Add a copy and we will send a gift code with your receipt.";
  }
  var gifts = quantity - 1;
  return "1 copy for you and " + gifts + " to give away. Each gift comes with its own code on your receipt.";
}

/* Make a gift code like GIFT-7K2QX. The prototype makes them up; the real
   checkout would create them on the server. */
function makeGiftCode() {
  var letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var code = "GIFT-";
  for (var i = 0; i < 5; i = i + 1) {
    code = code + letters.charAt(Math.floor(Math.random() * letters.length));
  }
  return code;
}

/* Which product a click or a typed number belongs to. */
function productIdFor(element) {
  return Number(element.closest(".line-item").getAttribute("data-product-id"));
}

/* Store a new quantity and redraw. Tells the shopper when a number had to be
   pulled back inside the 1 to CART_MAX_QUANTITY range. */
function changeQuantity(productId, wanted) {
  var stored = setCartQuantity(productId, wanted);
  renderCart();

  if (stored !== wanted) {
    showToast("Choose between 1 and " + CART_MAX_QUANTITY + " copies.", "error");
  }
}

/* Clicks inside the cart lines: minus, plus and Remove. One listener handles
   every line, including lines drawn later (event delegation). */
function onCartClicked(event) {
  var target = event.target;
  var button = target.closest("button");
  if (button === null) {
    return;
  }

  var productId = productIdFor(button);
  var input = button.closest(".line-item").querySelector(".qty-input");

  if (button.classList.contains("qty-down")) {
    changeQuantity(productId, Number(input.value) - 1);
    return;
  }

  if (button.classList.contains("qty-up")) {
    changeQuantity(productId, Number(input.value) + 1);
    return;
  }

  if (button.classList.contains("remove-item")) {
    var product = findProduct(productId);
    if (confirm("Remove " + product.title + " from your cart?") === false) {
      return;
    }
    removeProductFromCart(productId);
    renderCart();
    showToast(product.title + " was removed.");
  }
}

/* The shopper typed a number and left the box (or pressed Enter). */
function onQuantityTyped(event) {
  if (!event.target.classList.contains("qty-input")) {
    return;
  }

  var typed = Number(event.target.value);

  if (event.target.value.trim() === "" || isNaN(typed)) {
    showToast("Quantity must be a number.", "error");
    renderCart();
    return;
  }

  changeQuantity(productIdFor(event.target), typed);
}

/* Take everything out of the cart at once, after checking that is what was meant. */
function emptyCart() {
  var units = unitCount(cartLines());
  if (units === 0) {
    return;
  }

  var word = units === 1 ? "item" : "items";
  if (confirm("Remove all " + units + " " + word + " from your cart?") === false) {
    return;
  }

  clearCart();
  renderCart();
  showToast("Your cart is empty.");
}

/* Place the order. It is saved shaped like an orders row with order_items
   snapshots: the title and price are copied, so the receipt still shows what
   was paid even if the creator changes the product later. The quantity on each
   item is prototype-only, like the quantity in the cart. */
function checkout() {
  var lines = cartLines();

  if (lines.length === 0) {
    showToast("There is nothing in your cart yet.", "error");
    return;
  }

  var total = cartTotal(lines);
  var units = unitCount(lines);

  if (confirm("Place this order for " + formatPrice(total) + "?") === false) {
    return;
  }

  var orders = loadJson(STORAGE_KEYS.orders, []);
  var now = new Date().toISOString();
  var order = {
    id: orders.length + 1,
    status: "Paid",
    placedAt: now,
    paidAt: now,
    totalCents: total,
    currency: "USD",
    paymentReference: null,       // no payment provider in the prototype
    items: lines.map(function (line) {
      return {
        productId: line.product.id,
        creatorId: line.product.creatorId,
        productTitle: line.product.title,
        unitPriceCents: line.product.priceCents,
        quantity: line.quantity
      };
    })
  };

  orders.push(order);
  saveJson(STORAGE_KEYS.orders, orders);
  clearCart();

  var giftCodes = [];
  for (var g = 0; g < lines.length; g = g + 1) {
    for (var c = 1; c < lines[g].quantity; c = c + 1) {
      giftCodes.push({ title: lines[g].product.title, code: makeGiftCode() });
    }
  }
  order.giftCodes = giftCodes;
  saveJson(STORAGE_KEYS.orders, orders);

  var orderNumber = "CF-" + String(order.id).padStart(5, "0");
  var word = units === 1 ? "plan" : "plans";

  var html = "";
  html = html + "<div class='receipt'>";
  html = html + "<div class='receipt-check'>✓</div>";
  html = html + "<h2 style='margin:6px 0'>Order confirmed</h2>";
  html = html + "<p class='meta'>Order " + orderNumber + "</p>";
  html = html + "<p>You paid <strong>" + formatPrice(total) + "</strong> for " + units + " " + word + ".</p>";
  html = html + "<p>Every recipe in it is yours to keep, and its shopping list is ready whenever you are.</p>";
  if (giftCodes.length > 0) {
    html = html + "<div class='gift-codes'><p><strong>Your gift codes</strong> &middot; send one to each friend:</p><ul>";
    for (var k = 0; k < giftCodes.length; k = k + 1) {
      html = html + "<li><code>" + giftCodes[k].code + "</code> &middot; " + giftCodes[k].title + "</li>";
    }
    html = html + "</ul></div>";
  }
  html = html + "<p><a href='index.html'>Back to the meal plan</a> &middot; ";
  html = html + "<a href='reviews.html'>Leave a review</a></p>";
  html = html + "</div>";

  document.getElementById("cartArea").innerHTML = html;
  document.getElementById("itemCount").textContent = "0";
  document.getElementById("itemWord").textContent = "items";
  showToast("Thank you. Your order number is " + orderNumber + ".");
}

document.addEventListener("DOMContentLoaded", function () {
  renderCart();

  var linesArea = document.getElementById("cartLines");
  linesArea.addEventListener("click", onCartClicked);
  linesArea.addEventListener("change", onQuantityTyped);

  document.getElementById("checkoutButton").addEventListener("click", checkout);
  document.getElementById("emptyCartButton").addEventListener("click", emptyCart);
});
