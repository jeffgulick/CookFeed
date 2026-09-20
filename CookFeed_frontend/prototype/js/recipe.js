/* Cookfeed prototype - recipe pages.
   All three recipes live in one object so the three pages can share this file.
   Each page calls startRecipePage() with its own recipe id. */

var recipeData = {
  5: {
    title: "Chicken Teriyaki, the Real Way",
    servings: 2,
    prep: 5,
    cook: 15,
    saves: 733,
    seconds: 32,
    image: "images/recipe-teriyaki.svg",
    summary: "Four ingredients in the sauce. Skin-on thighs. That is the whole secret.",
    ingredients: [
      { qty: 500, unit: "g",     name: "boneless chicken thigh", note: "skin on" },
      { qty: 3,   unit: "tbsp",  name: "soy sauce",              note: "" },
      { qty: 3,   unit: "tbsp",  name: "mirin",                  note: "" },
      { qty: 2,   unit: "tbsp",  name: "sake",                   note: "" },
      { qty: 1,   unit: "tbsp",  name: "granulated sugar",       note: "" },
      { qty: 1,   unit: "tbsp",  name: "vegetable oil",          note: "" },
      { qty: 1,   unit: "bunch", name: "scallion",               note: "thinly sliced" }
    ],
    steps: [
      { at: 8,  text: "Sear the thighs skin-side down in oil until deeply browned, about 6 minutes." },
      { at: 16, text: "Flip, add soy, mirin, sake, and sugar, and simmer until the sauce reduces to a glaze." },
      { at: 24, text: "Slice and spoon the glaze over. Garnish with scallions." }
    ]
  },
  6: {
    title: "Onigiri Three Ways",
    servings: 4,
    prep: 20,
    cook: 20,
    saves: 504,
    seconds: 32,
    image: "images/recipe-onigiri.svg",
    summary: "Salmon, umeboshi, and tuna-mayo. Rice, salt, and a wet hand.",
    ingredients: [
      { qty: 2, unit: "c",   name: "short-grain rice", note: "rinsed until the water runs clear" },
      { qty: 1, unit: "tsp", name: "kosher salt",      note: "for your hands" },
      { qty: 1, unit: "tsp", name: "sesame oil",       note: "" }
    ],
    steps: [
      { at: 8,  text: "Cook the rice and let it cool until you can handle it." },
      { at: 16, text: "Wet and salt your hands, scoop a handful of rice, press in a filling, and shape into a triangle." },
      { at: 24, text: "Wrap with nori just before eating so it stays crisp." }
    ]
  },
  7: {
    title: "10-Minute Ginger Garlic Stir-Fry",
    servings: 2,
    prep: 5,
    cook: 8,
    saves: 387,
    seconds: 32,
    image: "images/recipe-stirfry.svg",
    summary: "The one-pan dinner I make when I have nothing planned.",
    ingredients: [
      { qty: 300, unit: "g",     name: "chicken breast", note: "sliced thin" },
      { qty: 1,   unit: "ea",    name: "broccoli",       note: "cut into florets" },
      { qty: 1,   unit: "ea",    name: "bell pepper",    note: "sliced" },
      { qty: 3,   unit: "clove", name: "garlic",         note: "minced" },
      { qty: 15,  unit: "g",     name: "fresh ginger",   note: "minced" },
      { qty: 2,   unit: "tbsp",  name: "soy sauce",      note: "" },
      { qty: 1,   unit: "tbsp",  name: "cornstarch",     note: "" },
      { qty: 2,   unit: "tbsp",  name: "vegetable oil",  note: "" },
      { qty: 1,   unit: "tbsp",  name: "rice vinegar",   note: "" },
      { qty: 1,   unit: "tsp",   name: "sesame oil",     note: "" }
    ]
    ,
    steps: [
      { at: 8,  text: "Toss the chicken with cornstarch and 1 tbsp soy sauce." },
      { at: 16, text: "Stir-fry the chicken in vegetable oil over high heat until just cooked, then remove." },
      { at: 24, text: "Stir-fry the vegetables, garlic, and ginger for 3 minutes, return the chicken, add the remaining soy, vinegar, and sesame oil, and toss." }
    ]
  }
};

var currentRecipe = null;
var currentServings = 0;
var recipeSaved = false;

/* Turn a number of seconds into the clock format a video player shows. */
function formatTime(seconds) {
  var minutes = Math.floor(seconds / 60);
  var rest = seconds % 60;
  if (rest < 10) {
    return minutes + ":0" + rest;
  }
  return minutes + ":" + rest;
}

/* Draw the ingredient list for however many people the cook is feeding. */
function renderIngredients(people) {
  var html = "";

  for (var i = 0; i < currentRecipe.ingredients.length; i = i + 1) {
    var item = currentRecipe.ingredients[i];
    var amount = item.qty * people / currentRecipe.servings;
    var note = "";

    if (item.note !== "") {
      note = ", " + item.note;
    }

    html = html + "<li><strong>" + formatQuantity(amount) + " " + item.unit + "</strong> ";
    html = html + item.name + note + "</li>";
  }

  document.getElementById("ingredientList").innerHTML = html;
  document.getElementById("servingsLabel").innerHTML = people;
}

/* Cook this recipe for a different number of people. */
function scaleRecipe(people) {
  if (people < 1) {
    alert("You need to cook for at least one person.");
    return;
  }

  currentServings = people;
  renderIngredients(people);
}

/* Ask the cook how many people are eating, then rescale. */
function askRecipeServings() {
  var answer = prompt("How many people are you cooking this for?", String(currentServings));

  if (answer === null) {
    return;
  }

  var people = Number(answer);

  if (answer === "" || isNaN(people) || people < 1 || people > 20) {
    alert("Please enter a number of people between 1 and 20.");
    return;
  }

  scaleRecipe(Math.round(people));
}

/* Move the video to the moment a step happens and highlight that step. */
function jumpToStep(seconds, stepNumber) {
  var percent = (seconds / currentRecipe.seconds) * 100;

  document.getElementById("videoTime").innerHTML =
    formatTime(seconds) + " / " + formatTime(currentRecipe.seconds);
  document.getElementById("videoProgress").style.width = percent + "%";
  document.getElementById("videoLabel").innerHTML = "Step " + stepNumber + " of " + currentRecipe.steps.length;

  for (var i = 1; i <= currentRecipe.steps.length; i = i + 1) {
    document.getElementById("step" + i).className = i === stepNumber ? "step playing" : "step";
  }
}

/* Draw the numbered steps, each one able to move the video. */
function renderSteps() {
  var html = "";

  for (var i = 0; i < currentRecipe.steps.length; i = i + 1) {
    var step = currentRecipe.steps[i];
    var number = i + 1;

    html = html + "<li class='step' id='step" + number + "'>";
    html = html + "<div>" + step.text + "</div>";
    html = html + "<button class='btn-small' onclick='jumpToStep(" + step.at + ", " + number + ")'>";
    html = html + "Watch at " + formatTime(step.at) + "</button>";
    html = html + "</li>";
  }

  document.getElementById("stepList").innerHTML = html;
}

/* Save or unsave this recipe and move its counter. */
function saveThisRecipe() {
  var button = document.getElementById("saveButton");
  var counter = document.getElementById("saveCount");
  var count = Number(counter.innerHTML);

  if (recipeSaved === false) {
    recipeSaved = true;
    counter.innerHTML = count + 1;
    button.innerHTML = "Saved ✓";
    button.className = "btn-secondary";
    alert("Saved. Its ingredients will be added to your shopping list.");
  } else {
    recipeSaved = false;
    counter.innerHTML = count - 1;
    button.innerHTML = "Save recipe";
    button.className = "btn-primary";
  }
}

/* Draw a recipe page in its starting state. */
function startRecipePage(id) {
  currentRecipe = recipeData[id];
  currentServings = currentRecipe.servings;

  document.getElementById("saveCount").innerHTML = currentRecipe.saves;
  document.getElementById("videoTime").innerHTML = "0:00 / " + formatTime(currentRecipe.seconds);
  document.getElementById("totalTime").innerHTML = currentRecipe.prep + currentRecipe.cook;

  renderIngredients(currentServings);
  renderSteps();
}
