/* Cookfeed prototype - reviews and feedback page */

/* Reviews already on the page when a shopper arrives. New ones are added to
   the front of this list. Nothing is written to a server yet, so refreshing
   the page brings back just these three. */
var reviews = [
  {
    name: "Alex Rivera",
    rating: 5,
    recommends: true,
    date: "August 12, 2026",
    text: "I bought this on a Sunday and had all three dinners on the table by Wednesday. " +
          "The shopping list is the whole reason it worked. One trip, nothing left over."
  },
  {
    name: "Priya Shah",
    rating: 4,
    recommends: true,
    date: "August 9, 2026",
    text: "Teriyaki alone was worth the price. I scaled the plan to six for my family and " +
          "the quantities came out right. Taking one star off because I wanted a fourth night."
  },
  {
    name: "Dan Okafor",
    rating: 3,
    recommends: false,
    date: "August 2, 2026",
    text: "Good recipes, but I already cook Japanese food most weeks so there was not much " +
          "here I did not know. Better suited to someone just starting out."
  }
];

/* Redraw the list of reviews from the array. */
function renderReviews() {
  var html = "";

  for (var i = 0; i < reviews.length; i = i + 1) {
    var review = reviews[i];
    var tag;

    if (review.recommends === true) {
      tag = "<span class='tag tag-yes'>Recommends</span>";
    } else {
      tag = "<span class='tag tag-no'>Does not recommend</span>";
    }

    html = html + "<div class='review'>";
    html = html + "<div class='review-head'>";
    html = html + "<span class='reviewer'>" + review.name + "</span>";
    html = html + "<span class='stars'>" + buildStars(review.rating) + "</span>";
    html = html + tag;
    html = html + "<span class='review-date'>" + review.date + "</span>";
    html = html + "</div>";
    html = html + "<p>" + review.text + "</p>";
    html = html + "</div>";
  }

  document.getElementById("reviewList").innerHTML = html;
}

/* Work out the average rating and how many shoppers would recommend the plan,
   then write both numbers into the summary bar. */
function updateSummary() {
  var total = 0;
  var recommendCount = 0;

  for (var i = 0; i < reviews.length; i = i + 1) {
    total = total + reviews[i].rating;
    if (reviews[i].recommends === true) {
      recommendCount = recommendCount + 1;
    }
  }

  var average = total / reviews.length;
  var percent = Math.round((recommendCount / reviews.length) * 100);

  document.getElementById("averageNumber").innerHTML = average.toFixed(1);
  document.getElementById("averageStars").innerHTML = buildStars(Math.round(average));
  document.getElementById("reviewCount").innerHTML = reviews.length;
  document.getElementById("recommendPercent").innerHTML = percent + "%";
}

/* Read the form, check it, and add the shopper's review to the top of the list. */
function addReview() {
  var name = document.getElementById("reviewerName").value;
  var rating = Number(document.getElementById("reviewRating").value);
  var comment = document.getElementById("reviewComment").value;
  var recommends = document.getElementById("recommendYes").checked;

  if (name === "" || comment === "") {
    alert("Please add your name and a few words about the plan before posting.");
    return;
  }

  if (comment.length < 15) {
    alert("Tell us a little more - at least 15 characters so other cooks can judge it.");
    return;
  }

  var confirmed = confirm("Post this review publicly as " + name + "?");

  if (confirmed === false) {
    return;
  }

  var newReview = {
    name: name,
    rating: rating,
    recommends: recommends,
    date: "Today",
    text: comment
  };

  reviews.unshift(newReview);

  renderReviews();
  updateSummary();

  document.getElementById("reviewerName").value = "";
  document.getElementById("reviewComment").value = "";
  document.getElementById("reviewRating").value = "5";
  document.getElementById("recommendYes").checked = true;

  alert("Thanks. Your review is at the top of the list.");
}

/* Draw the page in its starting state. */
function startReviewsPage() {
  renderReviews();
  updateSummary();
}
