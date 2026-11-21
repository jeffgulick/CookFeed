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

With the API and the app both running:

```bash
npm run screenshots
```

retakes the screenshots in `docs/screenshots` on a laptop-sized and a phone-sized screen, and runs an accessibility
check (axe, WCAG 2.1 A and AA, color contrast included) on every page it opens. It exits with an error if it finds
a violation. It needs Playwright's Chromium once: `npx playwright install chromium`.

GitHub Actions runs the unit tests and the build on every pull request that touches this folder
(`.github/workflows/app-tests.yml`).

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
    ui/                 pieces pages share: icons, the recipe card
    pages/              one folder per page
public/images/          the pictures the API's data names (images/recipes/5.svg)
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
