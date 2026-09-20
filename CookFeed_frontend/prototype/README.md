# Cookfeed prototype (Homework 1)

**Temporary folder.** This is the Homework 1 HTML/JavaScript prototype. It will be deleted
when the Angular application is built in Assignment 4:

```
rm -rf CookFeed_frontend/prototype
```

## Running it

There is nothing to install and nothing to build. Open `index.html` in any modern browser.

From Windows: double-click `index.html`.
From WSL: `explorer.exe index.html`

The pages are plain HTML, CSS, and JavaScript, so they work straight from the file system
with no web server.

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
  js/common.js        functions used by more than one page
  js/product.js       product page behavior
  js/reviews.js       reviews page behavior
  js/creator.js       creator page behavior
  js/cart.js          cart and checkout behavior
  js/recipe.js        all three recipes and the recipe page behavior
  images/             illustrations (SVG)
  NOTES.md            material for the written submission
```

## Notes

- Nothing is saved. Reviews added through the form live only until the page is reloaded,
  and the cart resets when you navigate away. Because of that, the cart page starts with
  the meal plan already in it instead of receiving it from the product page. Persistence
  arrives with the database work.
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
