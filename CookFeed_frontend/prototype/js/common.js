/* Cookfeed prototype - functions shared by every page.
   Loaded before the page-specific script on each page. */

/* Turn a whole number of cents into a price string.
   Prices are stored as integer cents so money math never picks up
   floating point rounding errors. */
function formatPrice(cents) {
  var dollars = cents / 100;
  return "$" + dollars.toFixed(2);
}

/* Build a five character star rating out of filled and empty stars. */
function buildStars(rating) {
  var stars = "";
  for (var i = 1; i <= 5; i = i + 1) {
    if (i <= rating) {
      stars = stars + "\u2605";
    } else {
      stars = stars + "\u2606";
    }
  }
  return stars;
}

/* Tidy a scaled quantity for display: 1500 stays 1500, 4.5 stays 4.5,
   and 2.00 becomes 2 instead of showing pointless decimal places. */
function formatQuantity(amount) {
  var rounded = Math.round(amount * 100) / 100;
  return String(rounded);
}
