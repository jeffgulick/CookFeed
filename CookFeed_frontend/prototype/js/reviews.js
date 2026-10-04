/* Cookfeed prototype - reviews and feedback page

   Homework 3 interactions on this page:
     1. Review form      - input, blur and submit events check the form as you type
     2. Star picker      - mouseover / mouseleave preview a rating, click sets it
     3. Rating bars      - click a bar to show only reviews with that many stars
     4. Sort and filter  - change events re-order and filter the list
     5. Posted reviews are remembered after a reload and can be removed */

var RATING_WORDS = ["", "Poor", "Disappointing", "Fine", "Good", "Excellent"];

var selectedRating = 0;        // 0 means no star chosen yet
var starFilter = 0;            // 0 means every rating is shown
var touched = {};              // fields the shopper has already visited
var freshReviewId = null;      // the review just posted, highlighted once

/* ---------- reading and saving reviews ---------- */

/* Posted reviews are stored in the browser, newest first. */
function savePostedReviews(list) {
  saveJson(STORAGE_KEYS.reviews, list);
}

function isPostedHere(review) {
  return review.userId === null;
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
  var all = getAllReviews(PRODUCT.id);
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

    var extraClass = review.id === freshReviewId ? " fresh" : "";

    html = html + "<div class='review" + extraClass + "'>";
    html = html + "<div class='review-head'>";
    html = html + "<span class='reviewer'>" + escapeHtml(review.reviewerName) + "</span>";
    html = html + "<span class='stars' aria-label='" + review.rating + " out of 5 stars'>" +
                  buildStars(review.rating) + "</span>";
    html = html + tag;
    html = html + "<span class='review-date'>" + formatDate(review.createdAt) + "</span>";
    html = html + "</div>";
    html = html + "<p>" + escapeHtml(review.body) + "</p>";
    if (isPostedHere(review)) {
      html = html + "<button type='button' class='link-button remove-review' data-id='" +
                    review.id + "'>Remove my review</button>";
    }
    html = html + "</div>";
  }

  if (shown.length === 0) {
    html = "<div class='review empty-reviews'>No reviews match these filters.</div>";
  }

  document.getElementById("reviewList").innerHTML = html;

  var filtered = shown.length !== all.length;
  document.getElementById("showingText").textContent =
    filtered ? "Showing " + shown.length + " of " + all.length + " reviews" : "Showing all " + all.length + " reviews";
  document.getElementById("clearFilters").hidden = !filtered;
}

/* ---------- the summary: average, percent recommending, rating bars ---------- */

function updateSummary() {
  var all = getAllReviews(PRODUCT.id);
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
    html = html + "<span>" + star + " ★</span>";
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

/* Remove a review this shopper posted, after checking that is what they meant. */
function onReviewListClicked(event) {
  var button = event.target.closest(".remove-review");
  if (button === null) {
    return;
  }

  var id = Number(button.getAttribute("data-id"));
  if (confirm("Remove your review? This cannot be undone.") === false) {
    return;
  }

  savePostedReviews(getPostedReviews().filter(function (review) { return review.id !== id; }));
  refreshPage();
  showToast("Your review was removed.");
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
  var name = document.getElementById("reviewerName").value.trim();
  var comment = document.getElementById("reviewComment").value.trim();

  var nameProblem = "";
  if (name === "") {
    nameProblem = "Please add your name.";
  } else if (name.length < 2) {
    nameProblem = "Your name needs at least 2 characters.";
  }

  var ratingProblem = selectedRating === 0 ? "Choose from 1 to 5 stars." : "";

  var commentProblem = "";
  if (comment === "") {
    commentProblem = "Please write a few words about the plan.";
  } else if (comment.length < LIMITS.reviewBodyMin) {
    commentProblem = "Tell us a little more: " + (LIMITS.reviewBodyMin - comment.length) +
                     " more characters so other cooks can judge it.";
  }

  showFieldProblem("reviewerName", "nameError", nameProblem, touched.name === true);
  showFieldProblem(null, "ratingError", ratingProblem, touched.rating === true);
  showFieldProblem("reviewComment", "commentError", commentProblem, touched.comment === true);

  /* Live counter under the text box. */
  var count = document.getElementById("reviewComment").value.length;
  document.getElementById("commentCount").textContent = count + " / " + LIMITS.reviewBodyMax;
  var hint = document.getElementById("commentHint");
  if (comment.length >= LIMITS.reviewBodyMin) {
    hint.innerHTML = "<span class='ok'>✓ Long enough</span>";
  } else {
    hint.textContent = "At least " + LIMITS.reviewBodyMin + " characters";
  }

  var isValid = nameProblem === "" && ratingProblem === "" && commentProblem === "";

  document.getElementById("postButton").disabled = !isValid;
  document.getElementById("formStatus").textContent = isValid
    ? "Ready to post as " + name + "."
    : "Add your name, a rating and a few words to post.";

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

  touched = { name: true, rating: true, comment: true };
  if (validateForm() === false) {
    showToast("Please fix the highlighted fields.", "error");
    return;
  }

  var name = document.getElementById("reviewerName").value.trim();

  if (confirm("Post this review publicly as " + name + "?") === false) {
    return;
  }

  var review = {
    id: Date.now(),
    productId: PRODUCT.id,
    userId: null,                // no sign-in yet; the database will store the user's id
    reviewerName: name,
    rating: selectedRating,
    recommends: document.getElementById("recommendYes").checked,
    body: document.getElementById("reviewComment").value.trim(),
    createdAt: new Date().toISOString()
  };

  var posted = getPostedReviews();
  posted.unshift(review);
  savePostedReviews(posted);

  freshReviewId = review.id;
  clearFilters();
  resetForm();
  showToast("Thanks, " + name + ". Your review is at the top of the list.");
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

document.addEventListener("DOMContentLoaded", function () {
  refreshPage();
  paintStars(0, false);
  validateForm();

  var nameBox = document.getElementById("reviewerName");
  var commentBox = document.getElementById("reviewComment");

  /* input fires on every keystroke; blur fires when the shopper leaves the box. */
  nameBox.addEventListener("input", validateForm);
  nameBox.addEventListener("blur", function () { touched.name = true; validateForm(); });
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
