/* Cookfeed prototype - product page (Three Weeknights in Japan) */

var PRODUCT_TITLE = "Three Weeknights in Japan";
var PRODUCT_CENTS = 1299;

var cartCount = 0;

/* Every ingredient in the plan, exactly as each recipe is written.
   baseServings is how many people that recipe feeds as published, and it is
   NOT the same for all three: the teriyaki and the stir-fry serve 2, the
   onigiri serves 4. Each line therefore has to be scaled against its own
   recipe, not against one number for the whole plan. */
var shoppingRows = [
  { name: "boneless chicken thigh", qty: 500, unit: "g",     aisle: "Meat",    baseServings: 2 },
  { name: "chicken breast",         qty: 300, unit: "g",     aisle: "Meat",    baseServings: 2 },
  { name: "soy sauce",              qty: 3,   unit: "tbsp",  aisle: "Pantry",  baseServings: 2 },
  { name: "soy sauce",              qty: 2,   unit: "tbsp",  aisle: "Pantry",  baseServings: 2 },
  { name: "mirin",                  qty: 3,   unit: "tbsp",  aisle: "Pantry",  baseServings: 2 },
  { name: "sake",                   qty: 2,   unit: "tbsp",  aisle: "Pantry",  baseServings: 2 },
  { name: "granulated sugar",       qty: 1,   unit: "tbsp",  aisle: "Pantry",  baseServings: 2 },
  { name: "vegetable oil",          qty: 1,   unit: "tbsp",  aisle: "Pantry",  baseServings: 2 },
  { name: "vegetable oil",          qty: 2,   unit: "tbsp",  aisle: "Pantry",  baseServings: 2 },
  { name: "cornstarch",             qty: 1,   unit: "tbsp",  aisle: "Pantry",  baseServings: 2 },
  { name: "rice vinegar",           qty: 1,   unit: "tbsp",  aisle: "Pantry",  baseServings: 2 },
  { name: "sesame oil",             qty: 1,   unit: "tsp",   aisle: "Pantry",  baseServings: 2 },
  { name: "sesame oil",             qty: 1,   unit: "tsp",   aisle: "Pantry",  baseServings: 4 },
  { name: "short-grain rice",       qty: 2,   unit: "c",     aisle: "Pantry",  baseServings: 4 },
  { name: "kosher salt",            qty: 1,   unit: "tsp",   aisle: "Spices",  baseServings: 4 },
  { name: "scallion",               qty: 1,   unit: "bunch", aisle: "Produce", baseServings: 2 },
  { name: "broccoli",               qty: 1,   unit: "ea",    aisle: "Produce", baseServings: 2 },
  { name: "bell pepper",            qty: 1,   unit: "ea",    aisle: "Produce", baseServings: 2 },
  { name: "garlic",                 qty: 3,   unit: "clove", aisle: "Produce", baseServings: 2 },
  { name: "fresh ginger",           qty: 15,  unit: "g",     aisle: "Produce", baseServings: 2 }
];

/* Rebuild the shopping list.
   Pass a number of people to scale the plan, or pass 0 to show it the way
   the creator published it. Two ingredients only merge into one line when
   they share a name AND a unit, which is why the two soy sauce entries
   become one row but the rice and the ginger never combine. */
function changeServings(people) {
  var totals = {};
  var order = [];
  var i;

  for (i = 0; i < shoppingRows.length; i = i + 1) {
    var row = shoppingRows[i];
    var scale = 1;

    if (people > 0) {
      scale = people / row.baseServings;
    }

    var key = row.name + "|" + row.unit;

    if (totals[key] === undefined) {
      totals[key] = { name: row.name, unit: row.unit, aisle: row.aisle, amount: 0 };
      order.push(key);
    }
    totals[key].amount = totals[key].amount + row.qty * scale;
  }

  var html = "";
  for (i = 0; i < order.length; i = i + 1) {
    var line = totals[order[i]];
    html = html + "<tr>";
    html = html + "<td class='qty'>" + formatQuantity(line.amount) + " " + line.unit + "</td>";
    html = html + "<td>" + line.name + "</td>";
    html = html + "<td class='aisle'>" + line.aisle + "</td>";
    html = html + "</tr>";
  }

  document.getElementById("shoppingRows").innerHTML = html;

  if (people > 0) {
    document.getElementById("listHeading").innerHTML = "Shopping list for " + people + " people";
    document.getElementById("listNote").innerHTML =
      "Scaled from the published servings. Every night is now cooked for " + people + ".";
  } else {
    document.getElementById("listHeading").innerHTML = "Shopping list &mdash; as published";
    document.getElementById("listNote").innerHTML =
      "Teriyaki and stir-fry serve 2, onigiri serves 4. One list, one grocery trip.";
  }
}

/* Ask the shopper how many people they are cooking for, check the answer,
   and rescale the list. Anything that is not a sensible number is rejected
   and the list is left alone. */
function askServings() {
  var answer = prompt("How many people are you cooking for?", "4");

  if (answer === null) {
    return;
  }

  var people = Number(answer);

  if (answer === "" || isNaN(people) || people < 1 || people > 20) {
    alert("Please enter a number of people between 1 and 20.");
    return;
  }

  changeServings(Math.round(people));
}

/* Add the plan to the cart after confirming the price with the shopper. */
function addToCart(title, cents) {
  var button = document.getElementById("buyButton");

  if (cartCount > 0) {
    alert(title + " is already in your cart. These are digital plans, so you only need one.");
    return;
  }

  var wantsIt = confirm("Add " + title + " to your cart for " + formatPrice(cents) + "?");

  if (wantsIt === false) {
    return;
  }

  cartCount = cartCount + 1;
  document.getElementById("cartCount").innerHTML = cartCount;
  button.innerHTML = "In cart ✓";
  button.className = "btn-primary done";
  alert("Added. Your shopping list is waiting in the cart.");
}

/* Where the finished shopping list could be sent.
   "ready" marks the ones this prototype can really do. The delivery partners
   are on the roadmap: the list is already in the right shape to hand over,
   but no account has been connected to a partner yet. */
var sendTargets = {
  instacart: {
    name: "Instacart",
    ready: false,
    detail: "Every line below would be matched to a store item and dropped into an " +
            "Instacart order for a nearby store, ready for you to review before checkout."
  },
  favor: {
    name: "Favor",
    ready: false,
    detail: "The list would be handed to a Favor runner as a shopping request, " +
            "with the quantities already scaled for your household."
  }
};

/* Hand the shopping list to a delivery partner.
   The partners are not connected yet, so this explains what the button will do
   rather than pretending the order went through. */
function sendList(target) {
  var partner = sendTargets[target];
  var lineCount = document.getElementById("shoppingRows").getElementsByTagName("tr").length;

  if (partner.ready === false) {
    alert("Send to " + partner.name + " - planned feature.\n\n" +
          partner.detail + "\n\n" +
          "Your list of " + lineCount + " items is ready to hand over. " +
          "The connection to " + partner.name + " is not built yet.");
    return;
  }

  alert("Your list of " + lineCount + " items was sent to " + partner.name + ".");
}

/* Print the shopping list. This one is real: it opens the browser's print
   dialog, which is how a cook takes the list to the store today. */
function printList() {
  var heading = document.getElementById("listHeading").innerHTML;
  var lineCount = document.getElementById("shoppingRows").getElementsByTagName("tr").length;
  var goAhead = confirm("Print your " + lineCount + " item shopping list?");

  if (goAhead === false) {
    return;
  }

  window.print();
}

/* Save or unsave a single recipe and move its save counter,
   the same way the counter on a real recipe card behaves. */
function saveRecipe(id) {
  var button = document.getElementById("save" + id);
  var counter = document.getElementById("saves" + id);
  var count = Number(counter.innerHTML);

  if (button.innerHTML === "Save") {
    button.innerHTML = "Saved ✓";
    button.className = "btn-small saved";
    counter.innerHTML = count + 1;
  } else {
    button.innerHTML = "Save";
    button.className = "btn-small";
    counter.innerHTML = count - 1;
  }
}

/* Draw the page in its starting state. */
function startProductPage() {
  document.getElementById("priceTag").innerHTML = formatPrice(PRODUCT_CENTS);
  document.getElementById("buyButton").innerHTML = "Add to cart — " + formatPrice(PRODUCT_CENTS);
  changeServings(0);
}
