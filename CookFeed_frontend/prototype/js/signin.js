/* Sign-in page: lists the seeded accounts by role and stores the one chosen (see "who is signed in" in
   common.js). Accounts, roles and creator handles all come from seed-data.js. */

/* Which list an account belongs in: the admin first (it holds no other role), then creators, then home cooks. */
function groupFor(user) {
  if (user.roles.indexOf("Admin") !== -1) { return "admins"; }
  if (user.roles.indexOf("Creator") !== -1) { return "creators"; }
  return "homeCooks";
}

function accountCard(user, isCurrent) {
  var roleText = user.roles.map(function (role) { return ROLE_LABELS[role] || role; }).join(" + ");
  var handle = user.handle ? ' &middot; <span class="handle">@' + escapeHtml(user.handle) + '</span>' : "";
  return '<div class="card account-card' + (isCurrent ? ' current' : '') + '">' +
    '<p class="account-card-name"><strong>' + escapeHtml(user.displayName) + '</strong></p>' +
    '<p class="meta">' + escapeHtml(roleText) + handle + '</p>' +
    (isCurrent
      ? '<p class="meta"><strong>Signed in now</strong></p>'
      : '<button type="button" class="btn-small btn-secondary" data-user-id="' + user.id + '">Sign in as ' +
        escapeHtml(user.displayName) + '</button>') +
    '</div>';
}

function renderStatus() {
  var user = currentUser();
  var status = document.getElementById("signinStatus");
  status.innerHTML = user
    ? '<p>You are signed in as <strong>' + escapeHtml(user.displayName) + '</strong>. ' +
      '<a href="index.html">Continue to the meal plan &rarr;</a></p>' +
      '<button type="button" class="btn-small btn-secondary" id="browseSignedOut">Sign out and browse as a guest</button>'
    : '<p>You are browsing as a guest. Pick an account below to sign in.</p>';
  var browse = document.getElementById("browseSignedOut");
  if (browse) {
    browse.addEventListener("click", function () {
      signOut();
      refresh();
      showToast("Signed out. You are browsing as a guest.");
    });
  }
}

function renderAccounts() {
  var current = currentUser();
  var lists = { homeCooks: [], creators: [], admins: [] };
  window.COOKFEED_SEED.users.forEach(function (row) {
    var user = { id: row.id, displayName: row.displayName, roles: rolesFor(row.id), handle: null };
    var profile = window.COOKFEED_SEED.creatorProfiles.filter(function (p) { return p.userId === row.id; })[0];
    user.handle = profile ? profile.handle : null;
    lists[groupFor(user)].push(accountCard(user, current !== null && current.id === user.id));
  });
  Object.keys(lists).forEach(function (id) {
    document.getElementById(id).innerHTML = lists[id].join("");
  });
}

function refresh() {
  renderStatus();
  renderAccounts();
  updateAccountArea();
}

document.addEventListener("DOMContentLoaded", function () {
  refresh();

  // One listener for every "Sign in as" button, since the cards are redrawn after each change.
  document.querySelector("main").addEventListener("click", function (event) {
    var button = event.target.closest("button[data-user-id]");
    if (!button) {
      return;
    }
    signIn(Number(button.getAttribute("data-user-id")));
    refresh();
    showToast("Signed in as " + currentUser().displayName + ".");
  });

  // Signing out from the nav redraws this page too.
  document.addEventListener("cookfeed:accountchange", refresh);
});
