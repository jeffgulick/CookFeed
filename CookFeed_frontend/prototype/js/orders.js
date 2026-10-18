/* Cookfeed prototype - Your orders page

   The signed-in account's orders, newest first, cancelled ones included. Each line shows the title and
   price paid as they were at checkout (order_items keeps them), which may differ from the product today. */

function orderNumber(order) {
  return "CF-" + String(order.id).padStart(5, "0");
}

/* "5 recipes, 6 meals", counted from what this purchase holds, not from the product today. */
function snapshotCounts(item) {
  var distinct = {};
  item.recipes.forEach(function (r) { distinct[r.recipeId] = true; });
  var isMealPlan = rowById("products", item.productId).type === "MealPlan";
  return productCounts({ recipeCount: Object.keys(distinct).length, mealCount: isMealPlan ? item.recipes.length : null });
}

function renderOrders() {
  var orders = ordersFor(currentUser().id);

  document.getElementById("orderSummary").textContent = orders.length === 0
    ? "Plans you buy show up here."
    : plural(orders.length, "order", "orders") + ", newest first.";

  document.getElementById("orderList").innerHTML = orders.map(function (order) {
    var paid = order.status === "Paid";
    var items = order.items.map(function (item) {
      return "<li><a href='" + productUrl(item.productId) + "'>" + escapeHtml(item.productTitle) + "</a>" +
        "<span class='meta'> &middot; " + snapshotCounts(item) + "</span>" +
        "<span class='line-price'>" + formatPrice(item.unitPriceCents) + "</span></li>";
    }).join("");

    return "<div class='card order-card" + (paid ? "" : " cancelled") + "'>" +
      "<div class='order-head'><strong>Order " + orderNumber(order) + "</strong>" +
      "<span class='meta'>" + formatDate(order.placedAt) + "</span>" +
      "<span class='tag " + (paid ? "tag-yes" : "tag-no") + "'>" + order.status + "</span></div>" +
      "<ul class='order-items'>" + items + "</ul>" +
      "<div class='total-row grand'><span>Total</span><span>" + formatPrice(order.totalCents) + "</span></div>" +
      (paid ? "" : "<p class='meta'>This order was " + order.status.toLowerCase() + ", so nothing in it is yours.</p>") +
      "</div>";
  }).join("");

  document.getElementById("noOrders").hidden = orders.length > 0;
}

document.addEventListener("DOMContentLoaded", function () {
  var user = currentUser();
  if (user === null || !canShop(user)) {
    document.getElementById("orderArea").innerHTML = "<div class='card notice-card'><p>" +
      (user === null ? signInLink("see your orders") + "." : "Admin accounts do not place orders.") + "</p></div>";
    return;
  }
  renderOrders();
});
