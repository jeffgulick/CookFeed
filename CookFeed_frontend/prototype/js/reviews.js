/* Cookfeed prototype - reviews and feedback page (reviews.html?product=)

   Homework 3 interactions on this page:
     1. Review form      - input, blur and submit events check the form as you type
     2. Star picker      - mouseover / mouseleave preview a rating, click sets it
     3. Rating bars      - click a bar to show only reviews with that many stars
     4. Sort and filter  - change events re-order and filter the list
     5. Posted reviews are remembered after a reload and can be removed by their author

   Only a buyer may review, once per product, and never their own product (design section 3.5): the form
   appears only when rules.js reviewState says canReview, and the review is posted under the signed-in
   account's name. */

var RATING_WORDS = ["", "Poor", "Disappointing", "Fine", "Good", "Excellent"];

var selectedRating = 0;        // 0 means no star chosen yet
var starFilter = 0;            // 0 means every rating is shown
var touched = {};              // fields the shopper has already visited
var freshReviewId = null;      // the review just posted, highlighted once
var product = null;

/* Why the form is not shown, for every reviewState except canReview. */
var REVIEW_GATES = {
  noShop: "Admin accounts do not write reviews. You can hide a review below, or restore one you hid; hidden reviews show only to admins.",
  yourOwn: "This is your own %noun%. Creators cannot review their own.",
  alreadyReviewed: "You have reviewed this %noun%. Thank you! You can remove your review above and write a new one.",
  mustBuy: "Only cooks who bought this %noun% can review it, so every review comes from someone who cooked it."
};

function isMine(review) {
  var user = currentUser();
  return user !== null && review.userId === user.id;
}

/* Show the form, or say why there is none. */
function renderFormGate() {
  var state = reviewState(currentUser(), product.id);
  var gate = document.getElementById("reviewGate");

  document.getElementById("reviewForm").hidden = state !== "canReview";
  gate.hidden = state === "canReview";
  if (state === "signIn") {
    gate.innerHTML = signInLink("write a review") + ". Only cooks who bought this " + productNoun(product) + " can review it.";
  } else if (state !== "canReview") {
    gate.textContent = REVIEW_GATES[state].replace("%noun%", productNoun(product));
  } else {
    document.getElementById("postingAs").textContent = currentUser().displayName;
  }
}

/* ---------- the list ---------- */

/* Apply the star filter, the "recommends only" box and the sort order. */
function visibleReviews(all) {
  var recommendOnly = document.getElementById("recommendOnly").checked;
  var sortBy = document.getElementById("sortReviews").value;

  var shown = all.filter(function (review) {
    if (starFilter !== 0 && review.rating !== starFilter) {
      return false;
    }
    if (recommendOnly && review.recommends === false) {
      return false;
    }
    return true;
  });

  shown.sort(function (a, b) {
    if (sortBy === "highest" && a.rating !== b.rating) {
      return b.rating - a.rating;
    }
    if (sortBy === "lowest" && a.rating !== b.rating) {
      return a.rating - b.rating;
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  return shown;
}

/* Redraw the list of reviews. Text a shopper typed goes through escapeHtml. */
function renderReviews() {
  // The admin also sees the reviews it hid, marked, with a button to restore them (3.8). An author always
  // sees their own review, even one that no longer counts, so they can remove it.
  var all = reviewsFor(product.id, isAdmin(currentUser()));
  var user = currentUser();
  var mine = user === null ? null : reviewBy(user.id, product.id);
  if (mine !== null && !all.some(function (r) { return r.id === mine.id; })) { all.unshift(mine); }
  var shown = visibleReviews(all);
  var html = "";

  for (var i = 0; i < shown.length; i = i + 1) {
    var review = shown[i];
    var tag;

    if (review.recommends === true) {
      tag = "<span class='tag tag-yes'>Recommends</span>";
    } else {
      tag = "<span class='tag tag-no'>Does not recommend</span>";
    }

    var hidden = review.hiddenAt !== null;
    var extraClass = (review.id === freshReviewId ? " fresh" : "") + (hidden ? " hidden-review" : "");

    html = html + "<div class='review" + extraClass + "'>";
    html = html + "<div class='review-head'>";
    html = html + "<span class='reviewer'>" + escapeHtml(review.reviewerName) + "</span>";
    html = html + "<span class='stars' aria-label='" + review.rating + " out of 5 stars'>" +
                  buildStars(review.rating) + "</span>";
    html = html + tag;
    if (hidden) { html = html + "<span class='tag tag-muted'>Hidden by Cookfeed</span>"; }
    else if (!reviewCounts(review)) { html = html + "<span class='tag tag-muted'>Not counted: order refunded</span>"; }
    html = html + "<span class='review-date'>" + formatDate(review.createdAt) + "</span>";
    html = html + "</div>";
    html = html + "<p>" + escapeHtml(review.body) + "</p>";
    if (isMine(review)) {
      html = html + "<button type='button' class='link-button remove-review' data-id='" +
                    review.id + "'>Remove my review</button>";
    }
    if (isAdmin(currentUser())) {
      html = html + "<button type='button' class='link-button moderate-review' data-id='" + review.id +
                    "' data-hide='" + (hidden ? "false" : "true") + "'>" + (hidden ? "Restore review" : "Hide review") + "</button>";
    }
    html = html + "</div>";
  }

  if (shown.length === 0) {
    html = "<div class='review empty-reviews'>No reviews match these filters.</div>";
  }

  document.getElementById("reviewList").innerHTML = html;

  var filtered = shown.length !== all.length;
  var notCounted = all.filter(function (r) { return !reviewCounts(r); }).length;
  document.getElementById("showingText").textContent =
    (filtered ? "Showing " + shown.length + " of " + all.length + " reviews" : "Showing all " + all.length + " reviews") +
    (notCounted ? " (" + notCounted + " not counted in the rating)" : "");
  document.getElementById("clearFilters").hidden = !filtered;
}

/* ---------- the summary: average, percent recommending, rating bars ---------- */

function updateSummary() {
  var all = reviewsFor(product.id);
  var total = 0;
  var recommendCount = 0;
  var perStar = [0, 0, 0, 0, 0, 0];

  for (var i = 0; i < all.length; i = i + 1) {
    total = total + all[i].rating;
    perStar[all[i].rating] = perStar[all[i].rating] + 1;
    if (all[i].recommends === true) {
      recommendCount = recommendCount + 1;
    }
  }

  var hasReviews = all.length > 0;
  var average = hasReviews ? total / all.length : 0;
  var percent = hasReviews ? Math.round((recommendCount / all.length) * 100) : 0;

  document.getElementById("averageNumber").textContent = average.toFixed(1);
  document.getElementById("averageStars").textContent = buildStars(Math.round(average));
  document.getElementById("reviewCount").textContent = all.length;
  document.getElementById("recommendPercent").textContent = percent + "%";

  var html = "";
  for (var star = 5; star >= 1; star = star - 1) {
    var width = hasReviews ? Math.round((perStar[star] / all.length) * 100) : 0;
    var active = starFilter === star ? " active" : "";
    html = html + "<button type='button' class='bar-row" + active + "' data-star='" + star + "'" +
                  " aria-pressed='" + (starFilter === star) + "'" +
                  " title='Show only " + star + "-star reviews'>";
    html = html + "<span>" + star + " \u2605</span>";
    html = html + "<span class='bar-track'><span class='bar-fill' style='display:block;width:" + width + "%'></span></span>";
    html = html + "<span class='bar-count'>" + perStar[star] + "</span>";
    html = html + "</button>";
  }
  document.getElementById("ratingBars").innerHTML = html;
}

function refreshPage() {
  updateSummary();
  renderReviews();
}

/* Clicking a bar shows only that rating; clicking it again shows every rating. */
function onBarClicked(event) {
  var bar = event.target.closest(".bar-row");
  if (bar === null) {
    return;
  }
  var star = Number(bar.getAttribute("data-star"));
  starFilter = starFilter === star ? 0 : star;
  refreshPage();
}

function clearFilters() {
  starFilter = 0;
  document.getElementById("recommendOnly").checked = false;
  document.getElementById("sortReviews").value = "newest";
  refreshPage();
}

/* The admin hides a review from everyone but admins, or restores one (3.8). */
function onModerateClicked(button) {
  var id = Number(button.getAttribute("data-id"));
  var hide = button.getAttribute("data-hide") === "true";
  confirmDialog(hide ? "Hide this review from every cook? Only admins will see it, and you can restore it."
                     : "Show this review to every cook again?", hide ? "Hide review" : "Restore review").then(function (ok) {
    if (!ok) { return; }
    setReviewHidden(currentUser().id, id, hide);
    refreshPage();
    showToast(hide ? "The review is hidden. The rating and count no longer include it." : "The review is shown again.");
    document.getElementById("main").focus({ preventScroll: true });
  });
}

/* Remove a review this shopper posted, after checking that is what they meant. */
function onReviewListClicked(event) {
  var moderate = event.target.closest(".moderate-review");
  if (moderate !== null) {
    onModerateClicked(moderate);
    return;
  }
  var button = event.target.closest(".remove-review");
  if (button === null) {
    return;
  }

  var id = Number(button.getAttribute("data-id"));
  confirmDialog("Remove your review? This cannot be undone.", "Remove review").then(function (ok) {
    if (!ok) {
      return;
    }
    removeReview(currentUser().id, id);
    refreshPage();
    renderFormGate();
    showToast("Your review was removed.");
    document.getElementById("main").focus({ preventScroll: true });
  });
}

/* ---------- star picker ---------- */

/* Light up the first `count` stars and write the matching word beside them.
   `previewing` is true while the pointer hovers, before anything is chosen. */
function paintStars(count, previewing) {
  var stars = document.querySelectorAll("#starPicker .star");

  for (var i = 0; i < stars.length; i = i + 1) {
    var value = i + 1;
    stars[i].classList.toggle("lit", value <= count);
    stars[i].setAttribute("aria-checked", String(value === selectedRating));
    stars[i].tabIndex = (value === selectedRating || (selectedRating === 0 && value === 1)) ? 0 : -1;
  }

  var label = document.getElementById("starLabel");
  label.textContent = count === 0 ? "Choose a rating" : count + " - " + RATING_WORDS[count];
  label.classList.toggle("preview-label", previewing === true);
}

/* Mouse over a star: preview that rating without choosing it. */
function onStarOver(event) {
  var star = event.target.closest(".star");
  if (star !== null) {
    paintStars(Number(star.getAttribute("data-value")), true);
  }
}

/* Mouse leaves the stars: go back to what was actually chosen. */
function onStarsLeave() {
  paintStars(selectedRating, false);
}

function chooseRating(value) {
  selectedRating = value;
  touched.rating = true;
  paintStars(selectedRating, false);
  validateForm();
}

function onStarClicked(event) {
  var star = event.target.closest(".star");
  if (star !== null) {
    chooseRating(Number(star.getAttribute("data-value")));
  }
}

/* Arrow keys move the rating, like any other group of radio buttons. */
function onStarKey(event) {
  var change = 0;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") {
    change = 1;
  } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
    change = -1;
  } else {
    return;
  }

  event.preventDefault();
  var next = Math.min(5, Math.max(1, (selectedRating === 0 ? 0 : selectedRating) + change));
  chooseRating(next);
  document.querySelector("#starPicker .star[data-value='" + next + "']").focus();
}

/* ---------- the form ---------- */

/* Check every field. Returns true when the review can be posted. Messages only
   appear under a field once the shopper has visited it, so an untouched form is
   not covered in red. */
function validateForm() {
  var comment = document.getElementById("reviewComment").value.trim();

  var ratingProblem = selectedRating === 0 ? "Choose from 1 to 5 stars." : "";

  var commentProblem = "";
  if (comment === "") {
    commentProblem = "Please write a few words about the plan.";
  } else if (comment.length < LIMITS.reviewBodyMin) {
    commentProblem = "Tell us a little more: " + (LIMITS.reviewBodyMin - comment.length) +
                     " more characters so other cooks can judge it.";
  }

  showFieldProblem(null, "ratingError", ratingProblem, touched.rating === true);
  showFieldProblem("reviewComment", "commentError", commentProblem, touched.comment === true);

  /* Live counter under the text box. */
  var count = document.getElementById("reviewComment").value.length;
  document.getElementById("commentCount").textContent = count + " / " + LIMITS.reviewBodyMax;
  var hint = document.getElementById("commentHint");
  if (comment.length >= LIMITS.reviewBodyMin) {
    hint.innerHTML = "<span class='ok'>\u2713 Long enough</span>";
  } else {
    hint.textContent = "At least " + LIMITS.reviewBodyMin + " characters";
  }

  var isValid = ratingProblem === "" && commentProblem === "";

  document.getElementById("postButton").disabled = !isValid;
  document.getElementById("formStatus").textContent = isValid
    ? "Ready to post."
    : "Add a rating and a few words to post.";

  return isValid;
}

function showFieldProblem(inputId, errorId, problem, visible) {
  var message = visible ? problem : "";
  document.getElementById(errorId).textContent = message;
  if (inputId !== null) {
    document.getElementById(inputId).classList.toggle("invalid", message !== "");
  }
}

/* The form's submit event. preventDefault stops the browser from reloading the
   page, which is what a form does by default. */
function onFormSubmitted(event) {
  event.preventDefault();

  touched = { rating: true, comment: true };
  if (validateForm() === false) {
    showToast("Please fix the highlighted fields.", "error");
    return;
  }

  var user = currentUser();

  confirmDialog("Post this review publicly as " + user.displayName + "?", "Post review").then(function (ok) {
    if (ok) {
      postReview(user);
    }
  });
}

/* Post the review. The form then gives way to "You have reviewed", so focus moves to the page rather
   than staying on a Post button that is no longer shown. */
function postReview(user) {
  var review = addReview(user.id, product.id, selectedRating,
    document.getElementById("recommendYes").checked,
    document.getElementById("reviewComment").value.trim());

  freshReviewId = review.id;
  clearFilters();
  resetForm();
  renderFormGate();
  showToast("Thanks, " + user.displayName + ". Your review is at the top of the list.");
  document.getElementById("main").focus({ preventScroll: true });
  document.getElementById("reviewList").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetForm() {
  document.getElementById("reviewForm").reset();
  selectedRating = 0;
  touched = {};
  paintStars(0, false);
  validateForm();
}

/* ---------- start ---------- */

/* The header: which product these reviews are for. */
function renderHeader() {
  var noun = productNoun(product);
  document.title = "Reviews of " + product.title + " | Cookfeed";
  document.getElementById("productTitle").textContent = product.title;
  document.getElementById("productByline").innerHTML = creatorByline(creatorFor(product.creatorId)) +
    " &middot; <a href='" + productUrl(product.id) + "'>back to the " + noun + "</a>";
  document.getElementById("recommendNoun").textContent = noun;
  document.getElementById("recommendQuestion").textContent =
    "Would you recommend this " + noun + " to another home cook?";
  document.getElementById("footLink").href = productUrl(product.id);
  document.getElementById("footLink").innerHTML = "&larr; Back to " + escapeHtml(product.title);
}

document.addEventListener("DOMContentLoaded", function () {
  var id = queryNumber("product");
  product = id === null ? null : productWithRecipes(id);
  if (product === null) {
    showMissing("Reviews not found", "There is no meal plan or collection at this address.");
    return;
  }

  renderHeader();
  refreshPage();
  renderFormGate();
  paintStars(0, false);
  validateForm();

  var commentBox = document.getElementById("reviewComment");

  /* input fires on every keystroke; blur fires when the shopper leaves the box. */
  commentBox.addEventListener("input", validateForm);
  commentBox.addEventListener("blur", function () { touched.comment = true; validateForm(); });

  var picker = document.getElementById("starPicker");
  picker.addEventListener("mouseover", onStarOver);
  picker.addEventListener("mouseleave", onStarsLeave);
  picker.addEventListener("click", onStarClicked);
  picker.addEventListener("keydown", onStarKey);

  document.getElementById("reviewForm").addEventListener("submit", onFormSubmitted);

  document.getElementById("ratingBars").addEventListener("click", onBarClicked);
  document.getElementById("sortReviews").addEventListener("change", renderReviews);
  document.getElementById("recommendOnly").addEventListener("change", renderReviews);
  document.getElementById("clearFilters").addEventListener("click", clearFilters);
  document.getElementById("reviewList").addEventListener("click", onReviewListClicked);
});
