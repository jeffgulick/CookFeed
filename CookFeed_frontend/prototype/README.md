# Cookfeed prototype (Homework 1, extended in Homework 3 and Project Deliverable 2)

**Temporary folder.** This is the HTML/JavaScript prototype from Homework 1, extended with
event-driven JavaScript in Homework 3, and refined against the project database in Project
Deliverable 2. It will be deleted
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

**Seeing an older version?** If you opened an earlier version of the prototype in the same
browser, it may show you its saved copy of the old pages. Press **Ctrl+Shift+R** (Cmd+Shift+R
on a Mac) on each page to load the current files. The current home page is **Discover**, with
plans for sale, trending recipes and creators.

The pages are plain HTML, CSS, and JavaScript, so they run straight from the file system
with no web server and no internet connection.

### Serving it over HTTP while you work on it

To serve the pages instead, run this from this folder and open `http://localhost:8000`.
It is Python's built-in web server, with one header added that tells the browser not to keep
a stored copy of the pages. Without that header, the browser can keep showing an old version
after the files change. Press Ctrl+C to stop it.

```bash
python3 - <<'EOF'
import http.server as h
class H(h.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()
h.ThreadingHTTPServer(("", 8000), H).serve_forever()
EOF
```

If the browser still shows an old page the first time, clear its stored copy once: open
DevTools (F12), then right-click the reload button and choose **Empty cache and hard reload**.

## Pages

Every page has the same navigation: Discover, My kitchen, Your orders, Help, the signed-in account,
and the cart. Product, recipe, creator and review pages are templates: the address names what they show.

| File | Purpose |
|---|---|
| `index.html` | Discover: the plans and collections for sale, trending recipes, and the creators |
| `product.html?id=3` | A meal plan or collection: what it includes, its buy button, and one shopping list |
| `recipe.html?id=5` | A recipe: video steps, scalable ingredients, Save. `&product=3` shows the plan and day |
| `creator.html?handle=kenji-kitchen` | A creator's storefront: Public recipes and products for sale |
| `reviews.html?product=3` | A product's reviews and, for buyers, the review form |
| `cart.html` | The cart and a simulated checkout |
| `orders.html` | Your orders, newest first, cancelled ones included |
| `kitchen.html` | My kitchen: saved recipes and one shopping list for all of them |
| `help.html` | A short FAQ |
| `signin.html` | Sign in as one of the seeded accounts, browse signed out, or reset the data |

## Folder layout

```
prototype/
  index.html          Discover (home page)
  product.html        product template (meal plans and collections)
  recipe.html         recipe template
  creator.html        creator storefront template
  reviews.html        reviews template
  cart.html           cart and checkout
  orders.html         Your orders
  kitchen.html        My kitchen: saved recipes and their shopping list
  help.html           FAQ
  signin.html         sign in as a seeded account
  css/styles.css      one stylesheet for every page
  js/seed-data.js     every seeded table, exported from the database (generated, do not edit)
  js/db.js            the seed plus the browser's copy of the tables people change; the stand-in for the API
  js/rules.js         the marketplace rules of DesignDocument section 3, in one place
  js/common.js        functions used by more than one page (sign-in, cards, buy area, shopping list, toast)
  js/discover.js      Discover
  js/product.js       product page
  js/recipe.js        recipe page
  js/creator.js       creator page
  js/reviews.js       reviews page
  js/cart.js          cart and checkout
  js/orders.js        Your orders
  js/kitchen.js       My kitchen
  js/signin.js        sign-in page
  images/             illustrations (SVG) in recipes/, creators/ and products/, the paths the seed stores
```

The export that writes `js/seed-data.js` lives next to this folder, in `CookFeed_frontend/tools/`, and
the unit and smoke tests in `CookFeed_frontend/tests/` (see Testing).

## Homework 3 additions

All event handlers are attached with `addEventListener`; there are no inline `onclick` or
`onload` attributes.

**Product page (now `product.html`)**
- Servings stepper: type a number or use the minus and plus buttons, and the shopping list
  rescales as you go. Numbers outside 1-20 get a message under the box.
- Recipe card preview: point at a recipe (`mouseenter` / `mouseleave`) to see prep and cook
  time, ingredient and step counts, and the first step.
- "Have it" checklist: tick what is already in the kitchen. A progress bar counts what is left,
  and printing leaves the ticked lines off the paper.
- Add to cart and Save are remembered across pages and reloads.
- "What your $12.99 gets you" spells out what the purchase includes beyond the free recipe text.
  It is now written from the product's own data.

**Reviews page (`reviews.html`)**
- The form checks itself as you type: inline messages, a live character counter, and a Post
  button that stays disabled until the review is complete.
- Star picker: hovering previews a rating, leaving restores the chosen one, clicking sets it.
  Arrow keys work too.
- Rating breakdown bars; click one to show only reviews with that many stars.
- Sort by newest, highest or lowest, and a "Recommends only" filter.
- Posted reviews survive a reload and can be removed by their author.

**Cart page (`cart.html`)**
- Empty cart removes everything after a confirmation.
- Homework 3 also had copies and gift codes. Project Deliverable 2 removed them: the database
  stores one row per product per cart, because a digital plan is owned once.

**My kitchen (`kitchen.html`)**
- Lists every recipe the shopper saved, newest first, and builds one shopping list from all of
  them with the same function the product page uses. Removing a recipe shrinks the list at once.

**Recipe page (now `recipe.html`)**
- The servings pop-up is replaced by the same minus / plus box as the product page.

**Wording for first-time visitors**
- "saved by 7 cooks" instead of "7 saves", "Coming soon" instead of "Planned", "Already have"
  instead of "Have it", and tooltips explaining saving and verified creators.

## Project Deliverable 2: data from the database

The prototype now shows exactly what the PostgreSQL database holds, so it and the Angular
application describe the same store.

- **`js/seed-data.js` is generated, not typed.** `CookFeed_frontend/tools/export-seed-data.sh` runs
  `tools/export-seed-data.sql` against the seeded database and writes every table as JSON, with
  camelCase keys (`price_cents` becomes `priceCents`). Passwords and email addresses are left out.
  Save counts are the database's own, so recipes read "saved by 7 cooks", not invented numbers.
- **The API tests check it.** `PrototypeDataTests` runs the same SQL on a freshly seeded database and
  fails if `seed-data.js` no longer matches, so a seed change cannot leave the prototype behind.
- **Sign in.** `signin.html` lists the seeded accounts by role: home cooks, creators (who can also
  shop) and the admin. The chosen account is kept in `localStorage` as `cookfeed.userId`, the
  prototype's stand-in for the API's `X-User-Id` header, and every page's nav shows who is signed in.
- **Images are local files.** The seed stores app-relative paths (`images/recipes/{id}.svg`,
  `images/creators/{handle}.svg`, `images/products/{id}.svg`), and the files are in `images/`, so the
  pictures work from the file system and Angular can serve the same paths from its assets.
- **Followers are gone.** The database has no followers table, so the follower count and Follow
  button were removed from the creator page.

To regenerate `seed-data.js` after changing the seed:

1. Reset and seed the database (see `CookFeed_api/DOCKER.md`), then start the API once in Development
   so it seeds the empty database.
2. From `CookFeed_frontend/tools`, run `./export-seed-data.sh`. It uses `psql` if installed, otherwise
   the Postgres container from `CookFeed_api/docker-compose.yml`.

## Project Deliverable 2: the whole store, and the rules

The pages are now templates over every product, recipe and creator in the seed, and they show the
marketplace rules of `CookFeed_api/docs/DesignDocument.md` section 3 for whoever is signed in.

- **Each account starts from the database.** `js/db.js` copies the tables people change (saves,
  carts, orders, order lines, the order's recipe snapshot, reviews) from the seed into one
  `localStorage` key, `cookfeed.db`. Signing in as Alex shows his saves, orders and review, and Priya's cart has The Bread Box in it;
  what you do is kept per account on top. Reset prototype data, on the sign-in page, puts the seed
  back, and so does regenerating `seed-data.js`.
- **The rules are in one file.** `js/rules.js` answers who may shop, buy, open, save and review.
  Each page asks it and shows or hides its controls from the answer:
  - creators cannot buy or review their own plans, but buy other creators' like anyone else;
  - the admin account sees no cart, Save or review controls;
  - every recipe in a plan is ProductOnly, so nothing you pay for is also free to save; it shows
    without a link, and stays off the shopping list, until you buy the plan it is in; after that it
    reads "Yours through" the plan. Before you own any of a plan, its list says what buying adds
    instead of showing an empty table;
  - only buyers review, once per plan, under their account name;
  - the cart holds one copy of each plan, and a storefront lists only Public recipes.
- **Checkout writes what the API will write:** a Paid order, one line per plan with the title, price
  and seller, and a snapshot of the plan's recipes with their days and slots.
- **Counts follow the database.** Save counts are counted from the save rows, and a meal plan that
  repeats a recipe reads "5 recipes, 6 meals", with the repeated recipe bought for twice.
- **Tests.** Unit tests for `db.js` and `rules.js`, and browser smoke tests for every page: see
  "Testing" below.

## Project Deliverable 2: layout and accessibility

- **One palette.** Every color in `css/styles.css` is a named variable at the top of the file.
- **Phones.** Below 760px the nav folds into a Menu button (Escape closes it), and the shopping
  tables move the aisle under each ingredient, so no page is wider than a 375px screen.
- **Cookfeed's own confirmation dialog.** Removing from the cart, emptying it, placing an order,
  posting or removing a review, and resetting the data ask in a styled `<dialog>`
  (`confirmDialog` in `js/common.js`) instead of the browser's `confirm()` box. Escape or Cancel
  backs out, and focus returns to the button that asked.
- **Keyboard and screen readers.** A "Skip to content" link on every page; one visible focus ring
  (3px, at least 3:1 against the page); the review form's Yes/No question is a fieldset with a
  legend; after checkout, focus moves to "Order confirmed".
- **Print.** Printing a plan or My kitchen prints only the title and the shopping list.
- **Servings.** A plan's servings box starts empty, meaning "as published", because its recipes do
  not all serve the same number; the first minus or plus starts at 2.
- **Creator header.** The avatar and the name sit side by side on laptop-width screens.
- **Contrast.** An axe scan of every page (WCAG 2.1 AA) found three places where small text fell
  below 4.5:1: the "Coming soon" tags, the faded cancelled order, and the green "Paid" tag. The tags now
  use darker text, a cancelled order is marked by a dashed border instead of fading, and `--good` is one
  shade darker. A repeat scan found nothing. The committed axe suite starts with the Angular app.

## Testing

Both suites run from `CookFeed_frontend/` and in CI on every change to it
(`.github/workflows/prototype-tests.yml`).

```bash
cd CookFeed_frontend
npm ci                                 # the exact versions in package-lock.json
npx playwright install chromium        # once, if Playwright's browser is not installed yet
npm run test:unit                      # db.js and rules.js, with Node's built-in runner
npm run test:smoke                     # every page in Chromium, opened from the file system
```

- **Unit tests** (`tests/*.test.js`) load the same scripts the pages load. One checks the
  recipe-access rule against `queries.sql` Q14 for every account and every ProductOnly recipe.
- **Smoke tests** (`tests/smoke/`) start each test from the database's seed, signed in as a seeded
  account, and fail on any page or console error:

  | Spec | What it checks |
  |---|---|
  | `pages.spec.js` | every page address as a guest, Alex, Kenji, the admin and Sam: no errors, no broken images; addresses that name nothing say so |
  | `rules.spec.js` | the section 3 rules on screen, account by account |
  | `purchase.spec.js` | Sam buys a plan, opens what it unlocks, reviews it, and Reset prototype data restores the seed |
  | `layout.spec.js` | every page fits a 375px phone, the phone nav, the servings default, and print |
  | `keyboard.spec.js` | the phone menu, the skip link, the focus ring's size and contrast, the dialog's focus handling, the review form's fieldset |

## Planned for the Angular production build

These came out of a first-time-customer review of the prototype. They are deferred to the Angular
application (Assignment 4), where they can be built against the real API and database.

- **Shop in real units.** Large scaled amounts read oddly ("15 tbsp soy sauce"). Show them in cups
  or millilitres, the way the database design already converts units for the shopping list.
- **Review trust labels.** Mark reviews from buyers as "Verified purchase", and label reviews written
  by other Cookfeed creators, using the orders and creator profile data.
- **Send to Instacart and Send to Favor.** Connect the delivery partners that are marked Coming soon.
  Planned in `CookFeed_api/docs/BuildLog.md`, "Later phases" L2: Instacart first; Favor and DoorDash
  only with a partnership.
- **Semantic, ADA-compliant templates.** Every Angular template meets WCAG 2.1 AA, built on native
  elements; the full rule is in `CookFeed_api/docs/BuildLog.md` under Frontend.

## Notes

- Nothing is sent to a server. The cart, saved recipes, posted reviews and placed orders are
  kept in the browser's `localStorage`, as rows shaped exactly like the database's. Reset
  prototype data on the sign-in page, or clearing site data in the browser, starts over.
- Send to Instacart and Send to Favor are marked Planned. They explain what the handover
  would do; no partner is connected. Print list is real and uses the browser's print
  dialog, with a print stylesheet that strips everything except the list.
- The video players on the recipe pages are mocks. There is no video file; clicking a
  step moves the progress bar and the clock to show how the steps and the video line up.
- Checkout does not take payment. Placing an order shows the confirmation a real checkout
  would produce, numbered after the seeded orders (CF-00007 is the first one placed here).
- The content is the semester project's seed data, exported from the database into
  `js/seed-data.js`: every product, recipe, ingredient quantity, creator, account, order and review.
