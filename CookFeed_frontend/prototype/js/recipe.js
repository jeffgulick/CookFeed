/* Cookfeed prototype - recipe pages.
   The recipes themselves live in data.js. Each page names its recipe with a
   data-recipe-id attribute on <body>, and this file draws it. */

var currentRecipe = null;
var currentServings = 0;

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
    var amount = item.quantity * people / currentRecipe.servings;
    var note = item.preparation === null ? "" : ", " + item.preparation;

    html = html + "<li><strong>" + formatQuantity(amount) + " " + item.unit + "</strong> ";
    html = html + item.name + note + "</li>";
  }

  document.getElementById("ingredientList").innerHTML = html;
  document.getElementById("servingsLabel").textContent = people;
}

/* Ask the cook how many people are eating, then rescale. */
function askRecipeServings() {
  var answer = prompt("How many people are you cooking this for?", String(currentServings));

  if (answer === null) {
    return;
  }

  var people = Number(answer);

  if (answer.trim() === "" || isNaN(people) || people < LIMITS.servingsMin || people > LIMITS.servingsMax) {
    showToast("Please enter a number of people between " + LIMITS.servingsMin + " and " +
              LIMITS.servingsMax + ".", "error");
    return;
  }

  currentServings = Math.round(people);
  renderIngredients(currentServings);
}

/* Move the video to the moment a step happens and highlight that step. */
function jumpToStep(seconds, stepNumber) {
  var percent = (seconds / currentRecipe.videoSeconds) * 100;

  document.getElementById("videoTime").textContent =
    formatTime(seconds) + " / " + formatTime(currentRecipe.videoSeconds);
  document.getElementById("videoProgress").style.width = percent + "%";
  document.getElementById("videoLabel").textContent = "Step " + stepNumber + " of " + currentRecipe.steps.length;

  for (var i = 1; i <= currentRecipe.steps.length; i = i + 1) {
    document.getElementById("step" + i).className = i === stepNumber ? "step playing" : "step";
  }
}

/* Draw the numbered steps, each one able to move the video. */
function renderSteps() {
  var html = "";

  for (var i = 0; i < currentRecipe.steps.length; i = i + 1) {
    var step = currentRecipe.steps[i];

    html = html + "<li class='step' id='step" + step.stepNumber + "'>";
    html = html + "<div>" + step.instruction + "</div>";
    html = html + "<button class='btn-small' data-seconds='" + step.videoTimestampSeconds +
                  "' data-step='" + step.stepNumber + "'>";
    html = html + "Watch at " + formatTime(step.videoTimestampSeconds) + "</button>";
    html = html + "</li>";
  }

  document.getElementById("stepList").innerHTML = html;
}

/* One listener for every "Watch at" button. */
function onStepClicked(event) {
  var button = event.target.closest("button[data-step]");
  if (button !== null) {
    jumpToStep(Number(button.getAttribute("data-seconds")), Number(button.getAttribute("data-step")));
  }
}

/* Make the save button and counter match whether this recipe is saved. */
function renderSaveState() {
  var saved = isSaved(currentRecipe.id);
  var button = document.getElementById("saveButton");

  document.getElementById("saveCount").textContent = currentSaveCount(currentRecipe);
  button.textContent = saved ? "Saved ✓" : "Save recipe";
  button.className = saved ? "btn-secondary" : "btn-primary";
}

/* Save or unsave this recipe. The product page reads the same saved list. */
function saveThisRecipe() {
  var nowSaved = toggleSave(currentRecipe.id);
  renderSaveState();
  showToast(nowSaved ? "Saved. Its ingredients will be added to your shopping list."
                     : "Removed from your saved recipes.");
}

document.addEventListener("DOMContentLoaded", function () {
  currentRecipe = RECIPES[Number(document.body.getAttribute("data-recipe-id"))];
  currentServings = currentRecipe.servings;

  document.getElementById("videoTime").textContent = "0:00 / " + formatTime(currentRecipe.videoSeconds);
  document.getElementById("totalTime").textContent = currentRecipe.prepMinutes + currentRecipe.cookMinutes;

  renderSaveState();
  renderIngredients(currentServings);
  renderSteps();

  document.getElementById("saveButton").addEventListener("click", saveThisRecipe);
  document.getElementById("servingsButton").addEventListener("click", askRecipeServings);
  document.getElementById("stepList").addEventListener("click", onStepClicked);
});
