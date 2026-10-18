/* Cookfeed prototype - Plans (plans.html): every meal plan and collection for sale.

   The same tiles as Discover (productTileHtml in common.js), with a type filter and a sort. For sale
   means active and from a creator who is not suspended (rules.js isForSale); a plan the viewer owns
   says so on its tile. */

var typeFilter = "all";

function visiblePlans() {
  var sortBy = document.getElementById("planSort").value;
  var plans = rowsWhere("products", isForSale)
    .filter(function (p) { return typeFilter === "all" || p.type === typeFilter; })
    .map(function (p) { return productWithRecipes(p.id); });

  plans.sort(function (a, b) {
    if (sortBy === "price") { return a.priceCents - b.priceCents || a.id - b.id; }
    if (sortBy === "rating") {
      var ra = averageRating(a.id), rb = averageRating(b.id);
      return (rb === null ? -1 : rb.average) - (ra === null ? -1 : ra.average) || a.id - b.id;
    }
    return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : b.id - a.id;
  });
  return plans;
}

function renderPlans() {
  var plans = visiblePlans();
  var all = rowsWhere("products", isForSale).length;
  document.getElementById("allPlans").innerHTML = plans.map(productTileHtml).join("");
  document.getElementById("noPlans").hidden = plans.length > 0;
  document.getElementById("planShowing").textContent = plans.length === all
    ? "Showing all " + plural(all, "plan", "plans")
    : "Showing " + plans.length + " of " + all;

  var buttons = document.querySelectorAll("[data-type]");
  for (var i = 0; i < buttons.length; i = i + 1) {
    buttons[i].className = buttons[i].getAttribute("data-type") === typeFilter ? "btn-small saved" : "btn-small";
    buttons[i].setAttribute("aria-pressed", String(buttons[i].getAttribute("data-type") === typeFilter));
  }
}

document.addEventListener("DOMContentLoaded", function () {
  renderPlans();
  document.querySelector(".toolbar").addEventListener("click", function (event) {
    var button = event.target.closest("[data-type]");
    if (button === null) { return; }
    typeFilter = button.getAttribute("data-type");
    renderPlans();
  });
  document.getElementById("planSort").addEventListener("change", renderPlans);
});
