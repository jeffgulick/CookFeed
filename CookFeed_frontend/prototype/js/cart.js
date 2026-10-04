/* Cookfeed prototype - cart and checkout page

   The cart is read from the browser's storage (see common.js), so whatever the
   shopper added on the product page is here, even after a reload. */

/* Look up a product by id. The prototype sells one plan; the real application
   will read the products table instead. */
function findProduct(productId) {
  return productId === PRODUCT.id ? PRODUCT : null;
}

/* The cart rows joined to their products, skipping anything no longer sold. */
function cartProducts() {
  var cart = getCart();
  var products = [];

  for (var i = 0; i < cart.length; i = i + 1) {
    var product = findProduct(cart[i].productId);
    if (product !== null && product.isActive === true) {
      products.push(product);
    }
  }

  return products;
}

/* Add up what is in the cart. Digital plans are bought once each,
   so there is no quantity to multiply by. */
function cartTotal(products) {
  var total = 0;
  for (var i = 0; i < products.length; i = i + 1) {
    total = total + products[i].priceCents;
  }
  return total;
}

/* Redraw the cart: the line items, the totals, and whichever message
   belongs with an empty or a filled cart. */
function renderCart() {
  var products = cartProducts();
  var html = "";

  for (var i = 0; i < products.length; i = i + 1) {
    var product = products[i];
    var typeLabel = product.type === "MealPlan" ? "Meal plan" : "Recipe collection";

    html = html + "<div class='line-item'>";
    html = html + "<img src='" + product.coverImageUrl + "' alt='" + escapeHtml(product.title) + "'>";
    html = html + "<div class='line-body'>";
    html = html + "<span class='pill'>" + typeLabel + "</span>";
    html = html + "<div class='recipe-title'>" + product.title + "</div>";
    html = html + "<div class='meta'>by " + CREATOR.handle + " &middot; " + product.recipes.length +
                  " recipes, " + product.recipes.length + " videos, 1 shopping list</div>";
    html = html + "<button class='btn-small remove-item' data-product-id='" + product.id + "'>Remove</button>";
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
    ? "Your cart is empty. <a href='index.html'>Back to the meal plan</a>."
    : "";
  document.getElementById("checkoutButton").disabled = isEmpty;
}

/* Take one plan back out of the cart, after checking that is what was meant. */
function onCartClicked(event) {
  var button = event.target.closest(".remove-item");
  if (button === null) {
    return;
  }

  var product = findProduct(Number(button.getAttribute("data-product-id")));
  if (confirm("Remove " + product.title + " from your cart?") === false) {
    return;
  }

  removeProductFromCart(product.id);
  renderCart();
  showToast(product.title + " was removed.");
}

/* Place the order. It is saved shaped like an orders row with order_items
   snapshots: the title and price are copied, so the receipt still shows what
   was paid even if the creator changes the product later. */
function checkout() {
  var products = cartProducts();

  if (products.length === 0) {
    showToast("There is nothing in your cart yet.", "error");
    return;
  }

  var total = cartTotal(products);

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
    items: products.map(function (product) {
      return {
        productId: product.id,
        creatorId: product.creatorId,
        productTitle: product.title,
        unitPriceCents: product.priceCents
      };
    })
  };

  orders.push(order);
  saveJson(STORAGE_KEYS.orders, orders);
  clearCart();

  var orderNumber = "CF-" + String(order.id).padStart(5, "0");
  var word = products.length === 1 ? "plan" : "plans";

  var html = "";
  html = html + "<div class='receipt'>";
  html = html + "<div class='receipt-check'>✓</div>";
  html = html + "<h2 style='margin:6px 0'>Order confirmed</h2>";
  html = html + "<p class='meta'>Order " + orderNumber + "</p>";
  html = html + "<p>You paid <strong>" + formatPrice(total) + "</strong> for " + products.length + " " + word + ".</p>";
  html = html + "<p>Every recipe in it is yours to keep, and its shopping list is ready whenever you are.</p>";
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
  document.getElementById("cartLines").addEventListener("click", onCartClicked);
  document.getElementById("checkoutButton").addEventListener("click", checkout);
});
