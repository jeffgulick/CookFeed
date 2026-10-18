/* Cookfeed prototype - the Admin console (admin.html), for the admin account (design section 3.8).

   The admin moderates reviews, manages creators and the catalog, looks up orders and accounts, and
   refunds or cancels orders. Each change goes through the db.js admin functions, which write the
   admin_actions row the database requires and refuse anyone who is not an admin; the page offers the
   controls only to an admin (rules.js isAdmin). The admin never creates content and never shops. */

var admin = null;

function orderNumber(order) {
  return "CF-" + String(order.id).padStart(5, "0");
}

function creatorName(creatorId) {
  var creator = creatorFor(creatorId);
  return creator === null ? "?" : creator.handle;
}

function creatorLink(creatorId) {
  var creator = creatorFor(creatorId);
  return "<a href='creator.html?handle=" + encodeURIComponent(creator.handle) + "'>" + escapeHtml(creator.displayName) +
    "</a><span class='cell-note'>@" + escapeHtml(creator.handle) + "</span>";
}

/* ---------- the header ---------- */

function renderStats() {
  var reviews = db().reviews;
  var hidden = reviews.filter(function (r) { return r.hiddenAt !== null; }).length;
  var creators = rowsWhere("creatorProfiles", function () { return true; });
  var suspended = creators.filter(function (c) { return c.suspendedAt !== null; }).length;
  var forSale = rowsWhere("products", isForSale).length;
  var orders = db().orders;
  var paid = orders.filter(function (o) { return o.status === "Paid"; }).length;

  document.getElementById("adminStats").innerHTML =
    "<div class='stat'><b id='statReviews'>" + (reviews.length - hidden) + "</b><span>reviews shown" + (hidden ? ", " + hidden + " hidden" : "") + "</span></div>" +
    "<div class='stat'><b id='statCreators'>" + creators.length + "</b><span>creators" + (suspended ? ", " + suspended + " suspended" : "") + "</span></div>" +
    "<div class='stat'><b id='statProducts'>" + forSale + "</b><span>plans for sale</span></div>" +
    "<div class='stat'><b id='statOrders'>" + paid + "</b><span>paid orders of " + orders.length + "</span></div>" +
    "<div class='stat'><b>" + SEED.users.length + "</b><span>accounts</span></div>" +
    "<div class='stat'><b id='statActions'>" + db().adminActions.length + "</b><span>admin actions logged</span></div>";
}

/* ---------- reviews ---------- */

function renderReviews() {
  document.getElementById("reviewRows").innerHTML = allReviews().map(function (review) {
    var hidden = review.hiddenAt !== null;
    return "<tr data-id='" + review.id + "' class='" + (hidden ? "row-muted" : "") + "'>" +
      "<td>" + formatDate(review.createdAt) + "</td>" +
      "<td><a href='reviews.html?product=" + review.productId + "'>" + escapeHtml(review.productTitle) + "</a></td>" +
      "<td>" + escapeHtml(review.reviewerName) + "</td>" +
      "<td><span class='stars' aria-label='" + review.rating + " out of 5 stars'>" + buildStars(review.rating) + "</span></td>" +
      "<td><span class='tag " + (hidden ? "tag-muted" : "tag-yes") + "'>" + (hidden ? "Hidden" : "Shown") + "</span></td>" +
      "<td class='actions'><button type='button' class='btn-small' data-action='review' data-hide='" + !hidden + "'>" +
        (hidden ? "Restore" : "Hide") + "</button></td></tr>";
  }).join("") || "<tr><td colspan='6' class='meta'>No reviews.</td></tr>";
}

/* ---------- creators ---------- */

function renderCreators() {
  document.getElementById("creatorRows").innerHTML = rowsWhere("creatorProfiles", function () { return true; }).map(function (profile) {
    var creator = creatorFor(profile.userId);
    var suspended = creator.suspendedAt !== null;
    var recipes = rowsWhere("recipes", function (r) { return r.creatorId === creator.userId; }).length;
    var products = rowsWhere("products", function (p) { return p.creatorId === creator.userId; }).length;
    return "<tr data-id='" + creator.userId + "'>" +
      "<td>" + creatorLink(creator.userId) + "</td>" +
      "<td>" + (creator.isVerified ? "<span class='tag tag-yes'>&#10003; Verified</span>" : "<span class='tag tag-muted'>Not verified</span>") + "</td>" +
      "<td><span class='tag " + (suspended ? "tag-no" : "tag-yes") + "'>" + (suspended ? "Suspended" : "Active") + "</span></td>" +
      "<td>" + recipes + "</td><td>" + products + "</td>" +
      "<td class='actions'>" +
      "<button type='button' class='btn-small' data-action='verify' data-verify='" + !creator.isVerified + "'>" + (creator.isVerified ? "Remove verification" : "Verify") + "</button> " +
      "<button type='button' class='btn-small' data-action='suspend' data-suspend='" + !suspended + "'>" + (suspended ? "Restore" : "Suspend") + "</button>" +
      "</td></tr>";
  }).join("");
}

/* ---------- catalog ---------- */

function soldCount(productId) {
  var paidOrderIds = db().orders.filter(function (o) { return o.status === "Paid"; }).map(function (o) { return o.id; });
  return db().orderItems.filter(function (oi) { return oi.productId === productId && paidOrderIds.indexOf(oi.orderId) !== -1; }).length;
}

function renderCatalog() {
  document.getElementById("productRows").innerHTML = rowsWhere("products", function () { return true; })
    .sort(function (a, b) { return a.id - b.id; }).map(function (product) {
      var creator = creatorFor(product.creatorId);
      var status = !product.isActive ? "<span class='tag tag-muted'>Retired</span>"
        : creator && creator.suspendedAt !== null ? "<span class='tag tag-no'>Creator suspended</span>"
        : !isForSale(product) ? "<span class='tag tag-no'>Not for sale: a recipe was taken down</span>"
        : "<span class='tag tag-yes'>For sale</span>";
      return "<tr data-id='" + product.id + "'>" +
        "<td><a href='" + productUrl(product.id) + "'>" + escapeHtml(product.title) + "</a></td>" +
        "<td>" + escapeHtml(creatorName(product.creatorId)) + "</td>" +
        "<td>" + productTypeLabel(product) + "</td><td>" + formatPrice(product.priceCents) + "</td>" +
        "<td>" + status + "</td><td>" + soldCount(product.id) + "</td>" +
        "<td class='actions'><button type='button' class='btn-small' data-action='product' data-active='" + !product.isActive + "'>" +
          (product.isActive ? "Retire" : "Restore") + "</button></td></tr>";
    }).join("");

  document.getElementById("recipeRows").innerHTML = rowsWhere("recipes", function () { return true; })
    .sort(function (a, b) { return a.id - b.id; }).map(function (recipe) {
      var inPlans = [];
      rowsWhere("productRecipes", function (pr) { return pr.recipeId === recipe.id; }).forEach(function (pr) {
        var title = rowById("products", pr.productId).title;
        if (inPlans.indexOf(title) === -1) { inPlans.push(title); }
      });
      return "<tr data-id='" + recipe.id + "'>" +
        "<td><a href='recipe.html?id=" + recipe.id + "'>" + escapeHtml(recipe.title) + "</a></td>" +
        "<td>" + escapeHtml(creatorName(recipe.creatorId)) + "</td>" +
        "<td><span class='tag " + (recipe.isPublished ? "tag-yes" : "tag-muted") + "'>" + (recipe.isPublished ? "Published" : "Draft") + "</span></td>" +
        "<td><span class='tag " + (recipe.visibility === "Public" ? "tag-muted" : "tag-premium") + "'>" + (recipe.visibility === "Public" ? "Free" : "Premium") + "</span></td>" +
        "<td>" + (inPlans.length ? escapeHtml(inPlans.join(", ")) : "<span class='meta'>none</span>") + "</td>" +
        "<td class='actions'>" + (recipe.isPublished
          ? "<button type='button' class='btn-small' data-action='recipe' data-publish='false'>Take down</button>"
          : adminTookDown("recipes", recipe.id)
            ? "<button type='button' class='btn-small' data-action='recipe' data-publish='true'>Put back</button>"
            : "<span class='meta'>Creator's draft</span>") + "</td></tr>";
    }).join("");
}

/* ---------- orders ---------- */

function renderOrders() {
  var query = document.getElementById("orderSearch").value.trim().toLowerCase();
  var orders = allOrders();
  var shown = orders.filter(function (order) {
    return query === "" || order.buyerName.toLowerCase().indexOf(query) !== -1 ||
      orderNumber(order).toLowerCase().indexOf(query) !== -1;
  });
  document.getElementById("orderShowing").textContent = "Showing " + shown.length + " of " + orders.length + " orders";
  document.getElementById("orderRows").innerHTML = shown.map(function (order) {
    var paid = order.status === "Paid";
    var action = paid ? "<button type='button' class='btn-small' data-action='order' data-status='Refunded'>Refund</button>"
      : order.status === "Pending" ? "<button type='button' class='btn-small' data-action='order' data-status='Cancelled'>Cancel</button>"
      : "<span class='meta'>&mdash;</span>";
    return "<tr data-id='" + order.id + "'>" +
      "<td>" + orderNumber(order) + "</td><td>" + formatDate(order.placedAt) + "</td>" +
      "<td>" + escapeHtml(order.buyerName) + "</td>" +
      "<td>" + order.items.map(function (i) { return escapeHtml(i.productTitle); }).join(", ") + "</td>" +
      "<td>" + formatPrice(order.totalCents) + "</td>" +
      "<td><span class='tag " + (paid ? "tag-yes" : "tag-no") + "'>" + order.status + "</span></td>" +
      "<td class='actions'>" + action + "</td></tr>";
  }).join("") || "<tr><td colspan='7' class='meta'>No orders match.</td></tr>";
}

/* ---------- users ---------- */

function renderUsers() {
  document.getElementById("userRows").innerHTML = SEED.users.map(function (row) {
    var user = userById(row.id);
    var orders = db().orders.filter(function (o) { return o.userId === row.id; }).length;
    var saves = savesFor(row.id).length;
    var reviews = db().reviews.filter(function (r) { return r.userId === row.id; }).length;
    return "<tr><td>" + escapeHtml(user.displayName) + (user.handle ? "<span class='cell-note'>@" + escapeHtml(user.handle) + "</span>" : "") + "</td>" +
      "<td>" + user.roles.map(function (r) { return ROLE_LABELS[r] || r; }).join(" + ") + "</td>" +
      "<td>" + formatDate(row.createdAt) + "</td>" +
      "<td>" + orders + "</td><td>" + saves + "</td><td>" + reviews + "</td></tr>";
  }).join("");
}

/* ---------- the log ---------- */

function targetLabel(action) {
  var id = action.targetId;
  if (action.targetTable === "reviews") {
    var review = db().reviews.filter(function (r) { return r.id === id; })[0];
    return review ? "review by " + rowById("users", review.userId).displayName + " on " + rowById("products", review.productId).title : "review #" + id;
  }
  if (action.targetTable === "creator_profiles") { return "creator @" + creatorName(id); }
  if (action.targetTable === "products") { var p = rowById("products", id); return p ? p.title : "product #" + id; }
  if (action.targetTable === "recipes") { var r = rowById("recipes", id); return r ? r.title : "recipe #" + id; }
  if (action.targetTable === "orders") { return "order " + orderNumber({ id: id }); }
  return action.targetTable + " #" + id;
}

function renderLog() {
  document.getElementById("logRows").innerHTML = adminActions().map(function (action) {
    return "<tr><td>" + formatDate(action.createdAt) + "</td><td>" + escapeHtml(action.adminName) + "</td>" +
      "<td><code>" + escapeHtml(action.action) + "</code></td>" +
      "<td>" + escapeHtml(targetLabel(action)) + "<span class='cell-note'>" + escapeHtml(action.targetTable) + " #" + action.targetId + "</span></td>" +
      "<td>" + escapeHtml(action.note || "") + "</td></tr>";
  }).join("") || "<tr><td colspan='5' class='meta'>Nothing yet. Every change made above appears here.</td></tr>";
}

function refreshAll() {
  renderStats();
  renderReviews();
  renderCreators();
  renderCatalog();
  renderOrders();
  renderUsers();
  renderLog();
}

/* ---------- one click handler for every table ---------- */

function onConsoleClicked(event) {
  var button = event.target.closest("button[data-action]");
  if (button === null) { return; }
  var id = Number(button.closest("tr").getAttribute("data-id"));
  var action = button.getAttribute("data-action");
  var message, label, apply;

  if (action === "review") {
    var hide = button.getAttribute("data-hide") === "true";
    message = hide ? "Hide this review from every cook? It leaves the plan's rating and count; you can restore it."
                   : "Show this review to every cook again?";
    label = hide ? "Hide review" : "Restore review";
    apply = function () { setReviewHidden(admin.id, id, hide); return hide ? "The review is hidden." : "The review is shown again."; };
  } else if (action === "verify") {
    var verify = button.getAttribute("data-verify") === "true";
    message = verify ? "Mark @" + creatorName(id) + " as verified?" : "Remove the verified mark from @" + creatorName(id) + "?";
    label = verify ? "Verify" : "Remove";
    apply = function () { setCreatorVerified(admin.id, id, verify); return "@" + creatorName(id) + (verify ? " is verified." : " is no longer marked verified."); };
  } else if (action === "suspend") {
    var suspend = button.getAttribute("data-suspend") === "true";
    message = suspend ? "Suspend @" + creatorName(id) + "? Their plans leave the store; cooks who bought one keep it."
                      : "Restore @" + creatorName(id) + "? Their plans go back on sale.";
    label = suspend ? "Suspend" : "Restore";
    apply = function () { setCreatorSuspended(admin.id, id, suspend); return "@" + creatorName(id) + (suspend ? " is suspended." : " is restored."); };
  } else if (action === "product") {
    var active = button.getAttribute("data-active") === "true";
    var product = rowById("products", id);
    message = active ? "Put \"" + product.title + "\" back on sale?" : "Retire \"" + product.title + "\"? It leaves the store; buyers keep it.";
    label = active ? "Restore" : "Retire";
    apply = function () {
      var problem = adminSetProductActive(admin.id, id, active);
      return problem ? { problem: problem } : "\"" + product.title + "\"" + (active ? " is for sale again." : " is retired.");
    };
  } else if (action === "recipe") {
    var publish = button.getAttribute("data-publish") === "true";
    var recipe = rowById("recipes", id);
    var buyers = recipeBuyers(id);
    message = publish ? "Put \"" + recipe.title + "\" back for everyone?"
                      : "Take \"" + recipe.title + "\" down? Only its creator will see it" +
                        (buyers ? ", and the " + plural(buyers, "cook who bought it loses", "cooks who bought it lose") + " it too" : "") +
                        ". Any plan it is in stops selling. Its creator cannot put it back.";
    label = publish ? "Put back" : "Take down";
    apply = function () {
      var problem = adminSetRecipePublished(admin.id, id, publish);
      return problem ? { problem: problem } : "\"" + recipe.title + "\"" + (publish ? " is back." : " is taken down.");
    };
  } else if (action === "order") {
    var status = button.getAttribute("data-status");
    var number = orderNumber({ id: id });
    message = status === "Refunded" ? "Refund order " + number + "? The buyer gets the money back and no longer owns what was in it."
                                    : "Cancel order " + number + "?";
    label = status === "Refunded" ? "Refund" : "Cancel order";
    apply = function () { setOrderStatus(admin.id, id, status, status === "Refunded" ? "Refunded from the Admin console" : null);
      return "Order " + number + " is " + status.toLowerCase() + "."; };
  } else {
    return;
  }

  confirmDialog(message, label).then(function (ok) {
    if (!ok) { return; }
    var toast = apply();
    refreshAll();
    if (toast && toast.problem) { showToast(toast.problem, "error"); }
    else { showToast(toast + " Logged."); }
    document.getElementById("main").focus({ preventScroll: true });
  });
}

/* ---------- start ---------- */

document.addEventListener("DOMContentLoaded", function () {
  var user = currentUser();
  if (!isAdmin(user)) {
    document.getElementById("adminArea").innerHTML = "<div class='card notice-card'><p>" +
      (user === null ? signInLink("open the Admin console") + ". It is for the Cookfeed Admin account only."
                     : "Only the admin account can open the Admin console. Sign in as Cookfeed Admin to see it.") + "</p></div>";
    return;
  }
  admin = user;
  refreshAll();
  document.getElementById("adminArea").addEventListener("click", onConsoleClicked);
  document.getElementById("orderSearch").addEventListener("input", renderOrders);
});
