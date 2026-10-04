# Cookfeed prototype (Homework 1, extended in Homework 3)

**Temporary folder.** This is the HTML/JavaScript prototype from Homework 1, extended with
event-driven JavaScript in Homework 3. It will be deleted
when the Angular application is built in Assignment 4:

```
rm -rf CookFeed_frontend/prototype
```

## Running it

There is nothing to install and nothing to build.

**If you received this as a zip, extract it first.** Right-click the archive and choose
Extract All, then open `index.html` from the extracted folder. Opening the page directly
from inside the zip viewer will show the text without its stylesheet or scripts, because
the viewer hands the browser only the one file it clicked.

Once extracted, double-click `index.html`, or drag it onto a browser window. Any modern
browser works.

**Seeing the Homework 1 version?** If you opened the Homework 1 prototype before in the same
browser, it may show you its saved copy of the old pages. Press **Ctrl+Shift+R** (Cmd+Shift+R
on a Mac) on each page to load the current files. The current product page has a "Cooking
every night for" box with minus and plus buttons above the shopping list.

The pages are plain HTML, CSS, and JavaScript, so they run straight from the file system
with no web server and no internet connection. To serve them over HTTP instead, run
`python3 -m http.server 8000` in this folder and open `http://localhost:8000`.

## Pages

| File | Purpose |
|---|---|
| `index.html` | Product page - the "Three Weeknights in Japan" meal plan, $12.99 |
| `reviews.html` | Customer reviews and the feedback form |
| `creator.html` | Creator storefront for kenji-kitchen |
| `cart.html` | Cart, totals and a simulated checkout |
| `recipe-teriyaki.html` | Recipe: Chicken Teriyaki, the Real Way |
| `recipe-stirfry.html` | Recipe: 10-Minute Ginger Garlic Stir-Fry |
| `recipe-onigiri.html` | Recipe: Onigiri Three Ways |

## Folder layout

```
prototype/
  index.html          product page
  reviews.html        reviews and feedback page
  creator.html        creator storefront page
  cart.html           cart and checkout page
  recipe-*.html       the three recipes in the plan
  css/styles.css      one stylesheet for all seven pages
  js/data.js          the store's data, shaped like the database rows
  js/common.js        functions used by more than one page (cart, saves, storage, toast)
  js/product.js       product page behavior
  js/reviews.js       reviews page behavior
  js/creator.js       creator page behavior
  js/cart.js          cart and checkout behavior
  js/recipe.js        all three recipes and the recipe page behavior
  images/             illustrations (SVG)
  NOTES.md            material for the written submission
```

## Homework 3 additions

All event handlers are attached with `addEventListener`; there are no inline `onclick` or
`onload` attributes.

**Product page (`index.html`)**
- Servings stepper: type a number or use the minus and plus buttons, and the shopping list
  rescales as you go. Numbers outside 1-20 get a message under the box.
- Recipe card preview: point at a recipe (`mouseenter` / `mouseleave`) to see prep and cook
  time, ingredient and step counts, and the first step.
- "Have it" checklist: tick what is already in the kitchen. A progress bar counts what is left,
  and printing leaves the ticked lines off the paper.
- Add to cart and Save are remembered across pages and reloads.

**Reviews page (`reviews.html`)**
- The form checks itself as you type: inline messages, a live character counter, and a Post
  button that stays disabled until the review is complete.
- Star picker: hovering previews a rating, leaving restores the chosen one, clicking sets it.
  Arrow keys work too.
- Rating breakdown bars; click one to show only reviews with that many stars.
- Sort by newest, highest or lowest, and a "Recommends only" filter.
- Posted reviews survive a reload and can be removed by their author.

**Cart page (`cart.html`)**
- Minus and plus buttons, or typing a number, change how many copies of a plan are in the
  cart (1-10). Line prices, totals and the cart chip update as the number changes.
- Empty cart removes everything after a confirmation.
- Quantity is a prototype-only feature. The database stores one row per product per cart,
  because a digital plan is owned once.

## Notes

- Nothing is sent to a server. The cart, saved recipes, posted reviews and placed orders are
  kept in the browser's `localStorage`, shaped like the matching database rows. Clearing site
  data in the browser resets the prototype.
- Send to Instacart and Send to Favor are marked Planned. They explain what the handover
  would do; no partner is connected. Print list is real and uses the browser's print
  dialog, with a print stylesheet that strips everything except the list.
- The video players on the recipe pages are mocks. There is no video file; clicking a
  step moves the progress bar and the clock to show how the steps and the video line up.
- Checkout does not take payment. Placing an order shows the confirmation a real checkout
  would produce, with a generated order number.
- The content is the same data the semester project is built on: the meal plan, its three
  recipes, the ingredient quantities, and the creator are all taken from the project's
  seed data, so the prototype and the finished application describe the same store.
