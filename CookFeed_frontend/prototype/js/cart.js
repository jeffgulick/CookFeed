/* Cookfeed prototype - cart and checkout page */

/* What the shopper is buying. A real cart is filled by the Add to cart button
   on the product page and stored against the shopper's account; nothing is
   stored yet, so the page starts with the plan already in it. */
var cartItems = [
  {
    title: "Three Weeknights in Japan",
    creator: "kenji-kitchen",
    type: "Meal plan",
    detail: "3 recipes, 3 videos, 1 shopping list",
    priceCents: 1299,
    image: "images/plan-hero.svg"
  }
];

var orderPlaced = false;

/* Add up what is in the cart. Digital plans are bought once each,
   so there is no quantity to multiply by. */
function cartTotal() {
  var total = 0;
  for (var i = 0; i < cartItems.length; i = i + 1) {
    total = total + cartItems[i].priceCents;
  }
  return total;
}

/* Redraw the cart: the line items, the totals, and whichever message
   belongs with an empty or a filled cart. */
function renderCart() {
  var html = "";

  for (var i = 0; i < cartItems.length; i = i + 1) {
    var item = cartItems[i];
    html = html + "<div class='line-item'>";
    html = html + "<img src='" + item.image + "' alt='" + item.title + "'>";
    html = html + "<div class='line-body'>";
    html = html + "<span class='pill'>" + item.type + "</span>";
    html = html + "<div class='recipe-title'>" + item.title + "</div>";
    html = html + "<div class='meta'>by " + item.creator + " &middot; " + item.detail + "</div>";
    html = html + "<button class='btn-small' onclick='removeItem(" + i + ")'>Remove</button>";
    html = html + "</div>";
    html = html + "<div class='line-price'>" + formatPrice(item.priceCents) + "</div>";
    html = html + "</div>";
  }

  document.getElementById("cartLines").innerHTML = html;
  document.getElementById("cartCount").innerHTML = cartItems.length;
  document.getElementById("itemCount").innerHTML = cartItems.length;
  document.getElementById("subtotal").innerHTML = formatPrice(cartTotal());
  document.getElementById("orderTotal").innerHTML = formatPrice(cartTotal());

  if (cartItems.length === 0) {
    document.getElementById("emptyNote").innerHTML =
      "Your cart is empty. <a href='index.html'>Back to the meal plan</a>.";
    document.getElementById("checkoutButton").disabled = true;
  } else {
    document.getElementById("emptyNote").innerHTML = "";
    document.getElementById("checkoutButton").disabled = false;
  }
}

/* Take one plan back out of the cart, after checking that is what was meant. */
function removeItem(index) {
  var item = cartItems[index];
  var sure = confirm("Remove " + item.title + " from your cart?");

  if (sure === false) {
    return;
  }

  cartItems.splice(index, 1);
  renderCart();
  alert(item.title + " was removed.");
}

/* Make up an order number the way a receipt would show one. */
function buildOrderNumber(total) {
  var stamp = String(Date.now());
  var tail = stamp.substring(stamp.length - 5, stamp.length);
  return "CF-" + total + "-" + tail;
}

/* Place the order and swap the cart for a receipt. */
function checkout() {
  if (cartItems.length === 0) {
    alert("There is nothing in your cart yet.");
    return;
  }

  var total = cartTotal();
  var goAhead = confirm("Place this order for " + formatPrice(total) + "?");

  if (goAhead === false) {
    return;
  }

  var orderNumber = buildOrderNumber(total);
  var bought = cartItems.length;

  var html = "";
  html = html + "<div class='receipt'>";
  html = html + "<div class='receipt-check'>✓</div>";
  html = html + "<h2 style='margin:6px 0'>Order confirmed</h2>";
  html = html + "<p class='meta'>Order " + orderNumber + "</p>";
  html = html + "<p>You paid <strong>" + formatPrice(total) + "</strong> for " + bought + " plan.</p>";
  html = html + "<p>Every recipe in it is yours to keep, and its shopping list is ready whenever you are.</p>";
  html = html + "<p><a href='index.html'>Back to the meal plan</a> &middot; ";
  html = html + "<a href='reviews.html'>Leave a review</a></p>";
  html = html + "</div>";

  document.getElementById("cartArea").innerHTML = html;
  document.getElementById("cartCount").innerHTML = "0";

  orderPlaced = true;
  cartItems = [];

  alert("Thank you. Your order number is " + orderNumber + ".");
}

/* Draw the page in its starting state. */
function startCartPage() {
  renderCart();
}
