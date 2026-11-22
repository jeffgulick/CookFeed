# Cookfeed app (Angular)

The Cookfeed web app: Angular 22, built against the API in [`CookFeed_api`](../../CookFeed_api/README.md). It is
being converted page by page from the finished prototype in [`../prototype`](../prototype/README.md), which stays
in place until the last page is done. A page that is not converted yet says so.

## What you need

| Tool | Version | Notes |
|---|---|---|
| Node.js | 22.22.3 or later (developed on 26) | Angular 22's requirement |
| npm | comes with Node | |
| The Cookfeed API | running on `http://localhost:5032` | see [`CookFeed_api/README.md`](../../CookFeed_api/README.md) |

## Run it

Start the API first (from `CookFeed_api`: `docker compose up -d --wait`, then `dotnet run --project src/Cookfeed.Api`).
Then, from this folder:

```bash
npm ci        # once: installs the exact versions in package-lock.json
npm start     # serves the app at http://localhost:4200
```

Open `http://localhost:4200`. The app calls `/api/...` on its own address, and the development server passes those
calls on to the API (`proxy.conf.json`), so the browser sees one site and there is nothing to configure.

**Signing in.** There are no passwords yet. Open **Sign in** and pick one of the store's accounts: a home cook, a
creator or the admin. The app then tells the API who is calling with the `X-User-Id` header. The account list comes
from `GET /api/accounts`, which the API serves in Development only.

## Test it

```bash
npm run test:ci     # the unit tests, once (npm test watches for changes instead)
npm run build       # a production build; strict TypeScript and strict templates, so a type error fails it
```

**Browser smoke tests** (`e2e/`, Playwright in Chromium) drive the real app against the real API and the seeded
database:

```bash
npx playwright install chromium   # once, and again after Playwright's version changes
npm run test:smoke
```

They start the API and the app themselves when neither is already running; the database container has to be up
(`docker compose up -d --wait` in `CookFeed_api`). To test an app that is already running at another address,
set `COOKFEED_APP_URL` (for example `COOKFEED_APP_URL=http://localhost:4201 npm run test:smoke`); the tests
then start nothing. What they check:

| File | What it checks |
|---|---|
| `pages.spec.ts` | every page, as each kind of account: no page or console error, one main heading, a title, every image loaded |
| `navigation.spec.ts` | the links each account is offered; the top bar on a wide screen; the tabs and the More sheet on a phone; no page wider than a 320px or 375px screen |
| `keyboard.spec.ts` | the skip link, a visible focus ring, where focus goes after moving to another page, the account menu by keyboard |
| `sign-in.spec.ts` | the picker lists the database's accounts; choosing one changes the navigation, survives a reload, and is sent to the API |
| `discover.spec.ts` | what a first-time visitor is told; the plans for sale, the trending recipes and the creators, from the database; a signed-in cook is greeted by name and shown what they own |
| `plans-browse.spec.ts` | the Plans page: everything for sale, narrowed to meal plans or collections, sorted by date, price or rating; what a signed-in cook owns |
| `recipes-browse.spec.ts` | the Recipes page: every free recipe, sorted two ways; Find matches a title or a creator; a premium recipe is never listed |
| `help.spec.ts` | the Help page: the common questions, each answered, with links on to the pages the answers name |
| `creator.spec.ts` | a creator's storefront: who they are, their recipes sorted two ways, what is for sale, and a buy area that changes with who is looking; signing in to buy comes back to the page; a handle nobody has says so |
| `plan.spec.ts` | a plan's page for someone deciding (price, pitch, recipes locked), a buyer (recipes opened, the list to buy), its creator, the admin, a retired plan, and an address that names no plan |
| `recipe.spec.ts` | a recipe: ingredients that rescale for the people cooked for, steps that jump the video, the way back to a plan; a premium recipe names its plan to someone who has not bought it; a draft stays private |
| `reviews.spec.ts` | a plan's reviews: the rating, the star, recommendation and sort controls, and what each kind of account is told about reviewing |
| `accessibility.spec.ts` | axe finds no WCAG 2.1 A or AA violation (color contrast included) on any page, on either screen size |

A page being converted is added to `BUILT_PAGES` in `e2e/support.ts`, which puts it under every one of those checks.
Every test fails on any error the page or the browser console raises. A test that causes one on purpose (the
browser logs each 404 it receives) names it with `test.use({ expectedErrors: [...] })`; it must then happen.

**Screenshots.** With the API and the app both running:

```bash
npm run screenshots
```

retakes the screenshots in `docs/screenshots` on a laptop-sized and a phone-sized screen, and runs the same
accessibility check on each page it opens.

**CI.** The unit tests and the build (`.github/workflows/app-tests.yml`) run on every pull request, every push to
one, and every push to main that touches this folder. The smoke tests are slower and have their own workflow
(`.github/workflows/app-smoke-tests.yml`): they run once, when a pull request is opened, against a PostgreSQL the
job starts for itself. Later pushes to the same pull request do not run them again; to run them on a branch by
hand, open Actions, choose **App smoke tests**, and press **Run workflow**.

## How it is laid out

```
src/
  styles.css            the one shared stylesheet: Tailwind, and Cookfeed's colors, fonts and shapes as a theme
  app/
    app.ts, app.html    the shell: navigation for a wide screen (top bar) and a phone (bottom tabs and More)
    app.routes.ts       one route per page; each page's code loads the first time it is opened
    app.config.ts       router, HTTP client, and reading the accounts before the first page is drawn
    core/
      session.ts              who is signed in, and what that account may be offered (the prototype's rules.js)
      caller.interceptor.ts   adds X-User-Id to every call to the API
      api.ts, api-types.ts    one method per API endpoint, and the shapes the API sends
      load.ts                 reads something for a page: loading, ready, missing (404), refused (403) or failed
      buy-state.ts            what a plan's buy area shows a viewer (the prototype's buyState)
      people.ts               how many people a recipe may be cooked for (the prototype's peopleProblem)
    ui/                 pieces pages share: icons, the recipe card, the plan tile, the creator tile, the buy
                        area, the loading and failed message, and how counts, prices and dates are worded
    pages/              one folder per page
public/images/          the pictures the API's data names (images/recipes/5.svg)
e2e/                    browser smoke tests (Playwright): support.ts, and one spec per concern
tools/screenshots.mjs   screenshots and the accessibility check
docs/screenshots/       the screenshots, kept for the project write-up
```

## Design rules

- **One palette, named once.** Every color, font and radius is a theme variable at the top of `src/styles.css`.
  Each text color is 4.5:1 or better on the page and on a card (WCAG 2.1 AA).
- **Built for a phone first.** A phone gets tabs along the bottom, full-width buttons and two recipes across. A wide
  screen gets the top bar and three across. No page is wider than a 375px screen.
- **Native elements.** Real links, buttons, headings in order, lists, and a native `<dialog>` for the More sheet, so
  the browser handles focus and Escape. Main actions are at least 44px tall.
- **Keyboard first.** A skip link is the first stop on every page, focus is always visible, and after moving to
  another page focus goes to that page's content.
- **The rules live in services, not templates.** A template asks `Session` what to show; it does not work it out.
  The API enforces the same rules on every request.
