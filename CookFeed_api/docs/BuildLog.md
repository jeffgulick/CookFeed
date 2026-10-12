# Cookfeed API — Build Log

Where the API build stands, how we work, and what comes next. Read this at the start of a working
session; update **Where we are** and **Next steps** at the end of each step, in the same commit as the work.

---

## Where we are

*Last updated 2026-10-11.*

**Deliverable 2 is complete and merged into `main`.** It contains the database layer and all four core
queries:

| Query | Endpoint | PR |
|---|---|---|
| Recipe feed | `GET /api/feed` | #7 |
| Creator storefront | `GET /api/creators/{handle}` | #6 |
| Order history | `GET /api/me/orders` | #8 |
| Shopping list | `GET /api/me/shopping-list` | #9 |

CI followed in #10, with its docs in #11. Each query is controller → service → repository → Contracts
DTOs, and each has its generated SQL verified in `docs/Queries.md`. The deliverable is mapped item by item
in the [README](../README.md#deliverable-2).

| Done | Where |
|---|---|
| Solution: 5 `src` projects + 3 test projects, Clean Architecture, versions pinned | `Cookfeed.slnx`, `global.json`, `Directory.*.props`, `dotnet-tools.json` |
| 19 entities and 5 enums, one per table in `schema.sql`; no EF Core reference | `src/Cookfeed.Domain/` |
| `CookfeedDbContext` and 19 table mappings, written to match `schema.sql` | `src/Cookfeed.Infrastructure/Persistence/` |
| `InitialCreate` migration, with the four triggers copied from `schema.sql` | `Persistence/Migrations/` |
| `DbSeeder`: the same rows and ids as `seed.sql`; runs at startup in Development | `Persistence/Seed/` |
| 45 integration tests against real PostgreSQL, all passing | `tests/Cookfeed.IntegrationTests/` |
| Docs updated to match | `README.md`, `DOCKER.md`, `docs/DesignDocument.md` §1 |
| Feed: `FeedController` → `FeedService` → `RecipeRepository.GetFeedAsync`, DTOs in `Contracts/Feed/` | `src/*/Feed/`, `Persistence/Repositories/`, `Api/Controllers/` |
| Feed tests: 7 service tests with NSubstitute, 14 HTTP tests with `WebApplicationFactory` (66 tests in all) | `tests/Cookfeed.Application.Tests/Feed/`, `tests/Cookfeed.IntegrationTests/Api/` |
| Feed SQL captured from the EF Core log, with `EXPLAIN ANALYZE`, and marked verified | `docs/Queries.md` §1 |
| Storefront: `CreatorsController` → `StorefrontService` → `CreatorRepository.GetStorefrontAsync`, DTOs in `Contracts/Storefront/` | `src/*/Storefront/`, `Persistence/Repositories/`, `Api/Controllers/` |
| Storefront tests: 4 service tests, 20 HTTP tests (90 tests in all); SQL verified, split query chosen after review | `tests/*/Storefront*`, `docs/Queries.md` §2 |
| Order history: `MyOrdersController` → `OrderHistoryService` → `OrderRepository.GetOrderHistoryAsync`, DTOs in `Contracts/Orders/` | `src/*/Orders/`, `Persistence/Repositories/`, `Api/Controllers/` |
| Order history tests: 2 service tests, 12 HTTP tests (104 tests in all), incl. the snapshot and order-total checks; SQL verified | `tests/*/Order*`, `docs/Queries.md` §4 |
| Shopping list: `MyShoppingListController` → `ShoppingListService` → `ShoppingListRepository` (SQL half) + `ShoppingListAggregator` in Domain (C# half) | `src/*/ShoppingList/`, `Persistence/Repositories/`, `Api/Controllers/` |
| Shopping-list tests: 14 Domain tests for the aggregator, 3 service tests, 9 HTTP tests checked against `queries.sql` Q8 (130 tests in all); SQL verified and rewritten after review | `tests/*/ShoppingList*`, `docs/Queries.md` §3 |
| Review fixes: the shopping list counts only recipes the caller may open (Q14 rule, also in Q8); strict `X-User-Id` parsing on every route; ASCII-only handles; ProblemDetails for every error; HTTPS redirection outside Development only; ISO-only `weekStart`; tests for the `lines`/`unmerged` split and sort (188 tests in all) | `docs/Queries.md` §3, `DesignDocument.md` §9 |
| CI: `.github/workflows/api-tests.yml` runs a locked restore, the build and all tests against a `postgres:16.15` service on every PR and push to `main` that touches `CookFeed_api/` | `.github/workflows/` |
| Roadmap item 1, CORS: the `Angular` policy allows the origins in `Cors:AllowedOrigins` (the Angular dev server in Development, none by default), the caller and token headers, and `GET`/`POST`/`PUT`/`DELETE`; error responses carry it too. 5 tests | `Program.cs`, `appsettings*.json`, `tests/*/Api/CorsTests.cs` |
| Roadmap item 2, OpenAPI: `/openapi/v1.json` describes every endpoint where `OpenApi:Enabled` is set (Development); `CallerHeaderTransformer` marks `X-User-Id` required under `/api/me` and optional elsewhere. 9 tests (203 in all) | `Program.cs`, `Api/OpenApi/`, `tests/*/Api/OpenApiTests.cs` |

Every Deliverable 2 item is in place: ER diagram and 3NF schema, seed data, the four core queries in LINQ
with reviewed SQL and justified indexes, the design document, and the API with tests.

---

## Frontend

**Today: an HTML/JavaScript prototype** in `CookFeed_frontend/prototype/` (Homework 1, extended in
Homework 3 and Project Deliverable 2). Ten pages run straight from the file system with no server:
- Discover, Your orders, My kitchen, Help, the cart, and sign-in;
- templates for every product, recipe, creator and review list (`product.html?id=`, `recipe.html?id=`,
  `creator.html?handle=`, `reviews.html?product=`).

Its data is the seeded database, exported to `js/seed-data.js` and checked against it by
`PrototypeDataTests`. Each seeded account starts from its own rows, and changes are kept in the browser's
`localStorage`. The marketplace rules of design doc §3 are in `js/rules.js`, with Node tests in
`CookFeed_frontend/tests/`. Playwright smoke tests (`CookFeed_frontend/tests/smoke/`) open every page from
the file system as each seeded account and check the rules on screen, the purchase flow, phone layout,
keyboard use and print. CI runs both (`prototype-tests.yml`). How to run it and what each page does:
`CookFeed_frontend/prototype/README.md`.

**Next: the Angular application (Assignment 4)**, built against this API once the endpoints it needs
exist. It replaces the prototype, and the prototype folder is deleted then. The features deferred to it
are listed under "Planned for the Angular production build" in the prototype README: real shopping units,
review trust labels, and the Instacart and Favor handoffs. Design doc §3.7 lists what the business rules
change on screen, as the prototype now shows them.

**Rule for every Angular template: semantic HTML that meets the ADA.** The ADA's web standard is WCAG 2.1
level AA, so that is the bar for every component, not a pass at the end:
- **Native elements first:** real `<button>`, `<a href>`, `<nav>`, `<main>`, headings in order, lists, and
  `<table>` with `<th>` for tabular data. A clickable `<div>` or `<span>` is a bug.
- **Every control is labelled:** a `<label for>` on each field, `<fieldset>` and `<legend>` around a
  group of radios or checkboxes, and alt text on every meaningful image (empty `alt` on decoration).
- **Keyboard first:** everything works with Tab, Enter, Space and Escape, focus is always visible (the
  3:1 ring from the prototype's `--focus`), and focus moves on purpose after a change: to the result of a
  checkout, back to the opener when a dialog closes, and to the page when a route changes.
- **Contrast and announcements:** text at 4.5:1 (3:1 for large text and focus rings), `aria-live` for
  messages such as the toast, and ARIA only where no native element does the job.
- **Checked, not assumed:** an automated accessibility check (axe) in the component and end-to-end
  tests, plus a keyboard-only and screen-reader pass on each new page.

The prototype already follows these (PR 5 added the skip link, the phone menu's states, the review
form's fieldset, the focus ring and the dialog's focus handling), so the Angular pages start from it.

**Responsive from the first component.** Every page works from a phone up to a laptop, designed for the
phone first:
- the phone menu from the prototype (the brand, the cart and a Menu button below 760px);
- layouts that stack on narrow screens, with no page wider than a 375px screen;
- tables that fold their less important columns into the row, as the prototype's shopping lists do;
- touch targets at least 24px (WCAG 2.2's AA minimum), and 44px for the main actions.

**Later: a mobile app alongside the web app.** Not planned yet, but the web app is built so that a mobile
app can reuse what it needs:
- every piece of data and every rule comes from the API, so a second client needs nothing the web
  app does not already get;
- the rules a screen reads (what `rules.js` answers in the prototype) live in Angular services, not in
  templates;
- sign-in uses tokens (roadmap item 12, JWT), which a mobile app can hold as well as a browser can.

**No tech stack is chosen for the mobile app yet. Whatever it is, it uses this API**, so the API stays the
one place for data and rules, and nothing the app needs may live only in the Angular code.

---

## Working rules

- **Ask before every commit and push.** Show what changed and the proposed commit message first; commit
  only after Jeff says so. Pull requests only when he asks.
- **Commits are Jeff's.** Author and committer: Jeff Gulick, `59627625+jeffgulick@users.noreply.github.com`.
  No AI-assistant or tool names or attribution anywhere — code, comments, docs, commit messages, pull
  requests — and no `Co-Authored-By` lines.
- **Branches are named for the work**, e.g. `feed-endpoint`, `comment-database-layer`. Never auto-generated
  names.
- **Test-first.** Write the failing tests, run them and confirm each fails for the expected reason, then
  write the code until they pass.
- **Small steps, reviewed.** Stop after each step for Jeff's review. He steps through the feature work, so
  explain new .NET, EF Core and xUnit concepts as they come up.
- **Comment enough to communicate, not more.**
  - Every class: a one- or two-line `/// <summary>` saying what it is for.
  - Before each logical block: a short `//` saying *why*, or which design rule it implements.
  - Point to the source of truth: `schema.sql`, a `DesignDocument.md` §, a `queries.sql` Q-number.
  - Explain a .NET concept briefly the first time it appears in a file.
  - No line-by-line narration of what the code obviously does.
- **Before showing work:** `dotnet build Cookfeed.slnx` with zero warnings (warnings are errors), and
  `dotnet test --solution Cookfeed.slnx` passing, or failing only where the step says it should.
- **Before merging:** the pull request's "API tests" check (GitHub Actions) is green. It runs the same
  restore, build and tests on a clean machine, so it also catches anything that only worked locally.

---

## Decisions so far

| Area | Decision | Why / where it is written down |
|---|---|---|
| API style | Controllers → services → repositories; not minimal APIs. One of each per area (feed, storefront, order history, shopping list), with a method per query | `DesignDocument.md` §1 |
| Layers | One project per layer; each references only the layers inside it | `DesignDocument.md` §1, `README.md` |
| Queries | LINQ lives only in repositories (`Infrastructure/Persistence/Repositories/`). Services hold the rules and see only repository interfaces | Lets Application tests use fakes; Application does not reference EF Core |
| Repositories | One per area with specific methods; no generic `Repository<T>`. Reads project into Contracts DTOs | `DesignDocument.md` §1 |
| EF Core model | Code-first. Entities and configurations written by hand; migrations generated with `dotnet ef migrations add`; triggers added to the migration by hand | Configurations are the source of truth from now on |
| Connection | Configured at registration (`AddInfrastructure`, `UseCookfeedDatabase`), not in `OnConfiguring` | Configuration and tests supply the connection string |
| Enums | Stored as their names in varchar columns | `CookfeedDbContext.ConfigureConventions`, `DesignDocument.md` §5 |
| Caller identity | `X-User-Id` header until login (Assignment 4). A user's own data is under `/api/me/…`, where the header is required (400 if missing); no route takes a user id. One strict parser for every route (`Api/Binding/CallerIdModelBinder.cs`): plain digits, 1 or more, otherwise 400. No custom authentication handler: JWT replaces the header then | `DesignDocument.md` §9 |
| Errors | Every error response is a ProblemDetails body: validation errors, unknown routes (404), and unexpected failures (500, with no exception text) | `Program.cs` |
| CORS | One named policy. Origins come from configuration (`Cors:AllowedOrigins`), so each deployment names its own front end and the default allows none. No `AllowCredentials`, because the API uses no cookies; revisit only if login keeps the refresh token in a cookie | `Program.cs`, `DOCKER.md` |
| OpenAPI | Built-in `Microsoft.AspNetCore.OpenApi`, served only where `OpenApi:Enabled` is true (Development): a tool for building the Angular client, not a public map of the API. With login, the caller header gives way to a bearer security scheme | `Program.cs`, `Api/OpenApi/CallerHeaderTransformer.cs` |
| Tests | xUnit v3 on Microsoft.Testing.Platform (run with `dotnet test --solution`); NSubstitute for fakes; integration tests create and drop throwaway databases and roll back their changes | `DesignDocument.md` §1 "Tests" |
| CI | GitHub Actions on every PR and push to `main` that touches `CookFeed_api/`: locked restore, build (warnings are errors), all tests against a `postgres:16.15` service. A PR is ready to merge only when its "API tests" check is green | `.github/workflows/api-tests.yml`, `DesignDocument.md` §1 "Continuous integration" |

---

## Toolchain

| What | Version | Pinned in |
|---|---|---|
| .NET SDK | 10.0.112 (Ubuntu: `sudo apt install dotnet-sdk-10.0`) | `global.json` |
| `dotnet-ef` | 10.0.11 | `dotnet-tools.json` |
| PostgreSQL | 16.15 | `docker-compose.yml` |
| CI runner | GitHub-hosted `ubuntu-24.04`, `actions/checkout@v4`, `actions/setup-dotnet@v4` (SDK from `global.json`), `postgres:16.15` service | `.github/workflows/api-tests.yml` |
| NuGet packages | see file | `Directory.Packages.props` + `packages.lock.json` |

In a claude.ai cloud session (a fresh Ubuntu 24.04 container each time), the same versions install with
`apt-get install dotnet-sdk-10.0=10.0.112-0ubuntu1~24.04.1`, then `dotnet tool restore`; PostgreSQL 16.15 is
already there and starts with `pg_ctlcluster 16 main start`.

Commands to migrate, run and test: [`README.md`](../README.md#getting-started) and
[`DOCKER.md`](../DOCKER.md).

---

## Next steps

Deliverable 2 (due **Oct 17**) is complete and merged. What comes next:

1. **Comment the existing database-layer code** to the commenting rule above. Mainly the 19
   configurations, `CookfeedDbContext.cs` and `Program.cs`. Comments only: the build and the tests must be
   unchanged.
2. **Assignment 4:** the Angular app against these endpoints, and the API work it needs, in the order of
   the **API roadmap** below.

## API roadmap (after Deliverable 2)

Every endpoint built so far only reads, so the API cannot yet change anything. The Angular app in
Assignment 4 needs the rest. These are listed in the order to build them, each test-first and in its own
PR, with the same pattern as the first four: controller → service → repository → Contracts DTOs.

Each item records:
- **its endpoints**, under `/api/me/…` for the caller's own data, per Decisions so far;
- **the rules from the next section that land with it**;
- **what its tests check.**

Tick items off here as they merge.

**A. Needed before Angular can call the API**

1. ✅ **CORS.** The Angular dev server (`http://localhost:4200`) is a different origin, so the browser blocks
   its calls until the API allows it. A named policy in `Program.cs`, with the allowed origins from
   configuration so production can differ. It must allow:
   - the `X-User-Id` header now, and `Authorization` once login lands (item 12);
   - the `PUT` and `DELETE` methods, alongside `GET` and `POST`.

   Custom headers and those methods make the browser send a preflight `OPTIONS` request first, and an
   origin-only policy would fail it.
   - *Test:* a preflight from `http://localhost:4200` asking for `PUT` with `X-User-Id` is allowed; the same
     preflight from another origin is not.
2. ✅ **OpenAPI description** (optional but useful). `Microsoft.AspNetCore.OpenApi`, built into .NET 10,
   serves `/openapi/v1.json` in Development: every endpoint and DTO, from which the Angular client types
   can be generated.
   - *Test:* the document is served and lists the endpoints.

**B. Reads still missing**

3. **Recipe detail**, `GET /api/recipes/{id}`: the recipe, its steps and its ingredient lines (Q4). The
   planned LINQ is in `docs/Queries.md` §1b.
   - *DTO fields beyond the feed card:*
     - `prepMinutes` and `cookMinutes` separately, not only the total;
     - `savedByViewer`;
     - each ingredient line's `displayText`, `preparation` and `isOptional`;
     - each step's `videoTimestampSeconds`;
     - `includedIn`: the products that contain it, with `productId`, `title`, `dayOffset`, `slot` and
       `ownedByViewer`. This drives the breadcrumb, the "one of three dinners" link, and the "Yours through
       *plan*" label (DesignDocument.md §3.7).
   - *Query:* `AsSplitQuery()`. Steps and ingredient lines are two sibling collections, and one joined
     statement would multiply them, as the storefront's did (`docs/Queries.md` §2).
   - *Rules:* a `ProductOnly` recipe opens only for a viewer whose Paid snapshot contains it (Q14),
     reading the snapshot, never the live bundle. Everyone else gets **404**, so its existence isn't
     revealed. Drafts are 404 too. The recipe's own creator always gets it, drafts included: Q14 covers
     buyers only, and the prototype's `rules.js` `canOpenRecipe` already lets the creator in
     (DesignDocument.md §3.7).
   - *Tests:* Q4's lines; Q14's access matrix, plus the creator opening their own `ProductOnly` recipe and
     draft.
4. **Plan page**, `GET /api/products/{id}`: the product page (`product.html?id=` in the prototype) has no endpoint
   yet.
   - *DTO:* type, title, description, cover image, price and currency; the creator's handle, display name
     and verified flag; and its recipes in order.
     - For a meal plan, each recipe carries its `dayOffset` and `slot`. A recipe may appear twice.
     - Each recipe carries the feed-card fields, `visibility`, ingredient and step counts, and the first
       step.
     - Also: the review summary (count, average, percent recommending); `ownedByViewer`, `viewerIsCreator`
       and `inCart`; and recipe and meal counts, as in the storefront.
   - *Rules:* a `ProductOnly` recipe a viewer doesn't own shows only its title and placement, with no link
     and no ingredients or steps (DesignDocument.md §3.3, §3.7). Retired products are 404.
   - **Plan shopping list**, `GET /api/products/{id}/shopping-list?servings=N`: the combined list for the
     whole plan, scaled to `N` people per meal, reusing `ShoppingListAggregator`. It lists only recipes the
     viewer may open, the same rule as `/api/me/shopping-list`, so a non-buyer sees the Public recipes'
     ingredients and a note that the rest come with the plan.
   - *Tests:* the recipe and meal counts equal Q5; the locked recipes reveal nothing to a non-buyer; the
     list equals the aggregator over the visible recipes.
5. **My purchases**, `GET /api/me/purchases`: the recipes the caller owns through Paid orders, grouped by
   the product they came with (Q11).
   - *DTO fields:* the product id and title as bought, and the order date; then, for each recipe: id,
     title, thumbnail, `dayOffset`, `slot` and `sortOrder` from the snapshot.
   - *Rules:* reads `order_item_recipes`, so a later bundle edit changes nothing (Q15's drift case).
   - *Tests:* equal to Q11.
6. **Reviews for a product**, `GET /api/products/{id}/reviews`: newest first (Q12), plus a summary (Q13).
   - *DTO fields:*
     - each review's `id`, rating, `recommends`, body and date;
     - the reviewer's display name, `isMine`, and `reviewerIsCreator` (the trust label);
     - a summary of count, average, percent recommending, and the count for each star from 1 to 5, for
       the rating bars;
     - `canReview` for the viewer: signed in, with a Paid order for the product, and no review yet.
   - *Note:* "Verified purchase" is true of every review, since only buyers may review (DesignDocument.md
     §3.5). The label says that once, in the summary, rather than on each review.
   - *Tests:* equal to Q12 and Q13.

**C. Writes**

7. **Saves.** `PUT /api/me/saves/{recipeId}` and `DELETE /api/me/saves/{recipeId}`, both idempotent, plus
   `GET /api/me/saves`. This is the first write feature, so it also brings item 13.
   - *List fields:* Q6 gives only title, handle and date. The My kitchen card also needs the recipe id,
     thumbnail, servings, total minutes, ingredient count and visibility.
   - *Rules:* a `ProductOnly` recipe can be saved only with the same access as opening it (404 otherwise).
   - *Tests:* the `save_count` trigger keeps the feed's count right (Q16 stays empty).
8. **Meal plans.** `GET /api/me/meal-plans/{weekStart}` (Q7), `PUT` to create the week's plan (one per
   user per week), `POST …/entries` to add a recipe on a day and slot with an optional servings override,
   and `DELETE …/entries/{id}`. Today the shopping list reads plans, but nothing can create one through
   the API.
   - *Rules:* an entry's date falls inside its week; the same recipe may appear on several days
     (DesignDocument.md §3.2); only a recipe the caller may open can be planned.
   - *Tests:* after adding entries, the shopping list changes the way Q8 says it should.
9. **Cart.** `GET /api/me/cart`, `PUT /api/me/cart/{productId}`, `DELETE /api/me/cart/{productId}`.
   - *DTO:* the lines (product id, type, title, cover, creator handle, recipe count, price) and the total.
     Also the item count, for the nav's cart badge.
   - *Rules:*
     - a creator cannot add their own product (**400**, a readable message before the trigger would
       refuse it);
     - only active products can be added;
     - a product the caller already owns through a Paid order is a **409**.
10. **Checkout**, `POST /api/me/checkout`, in one transaction (DesignDocument.md §6):
    - creates the `Paid` order (payment simulated, §9);
    - writes each item's title, price and seller snapshot;
    - copies every `product_recipes` row into `order_item_recipes`;
    - sets `total_cents` to the sum of the lines;
    - empties the cart.
    - *Response:* **201 Created**, with the new `OrderDto` (the shape `GET /api/me/orders` returns) and a
      `Location` header.
    - *Rules:* no self-purchase (**400**); an empty cart is a **400**; a product already owned is a
      **409**.
    - *Tests:* the new order appears in `GET /api/me/orders`; its recipes open through recipe detail; a
      failure part-way leaves nothing behind.
11. **Reviews**, `POST /api/products/{id}/reviews` and `DELETE /api/products/{id}/reviews/mine`.
    - *Rules:*
      - requires a Paid order item for that product by the caller (**403**);
      - one review per user per product (**409**);
      - rating 1–5, body 15–2000 characters (**400**);
      - the name shown is the account's display name, never typed in.
    - *Tests:* each refusal, through the API.

**D. Cross-cutting**

12. **Login (JWT), registration and roles.** Replaces the `X-User-Id` header (DesignDocument.md §9).
    - *Decision:* the API issues its own tokens to its own users. Every client (the Angular app, a later
      mobile app) logs in once, then sends `Authorization: Bearer <token>` on each request.
    - *Endpoints:*
      - `POST /api/auth/register`, which grants `HomeCook`;
      - `POST /api/auth/login`: checks the password and returns a short-lived **access token** (a JWT,
        about 15 minutes: the user id as `sub`, the roles, issuer, audience and expiry) and a long-lived
        **refresh token**;
      - `POST /api/auth/refresh`: trades a refresh token for a new access token;
      - `POST /api/auth/logout`: revokes the refresh token;
      - `GET /api/me`: id, display name, roles, and the creator handle if any.
    - *Passwords:* hashed with ASP.NET Core Identity's password hasher (into `users.password_hash`), with
      lockout after repeated failures and rate limiting on login. Never stored or logged in plain text.
    - *Refresh tokens:* stored hashed in the database, so logout, a password change or a stolen device
      can revoke them. An access token cannot be recalled, which is why it is kept short.
    - *Checking tokens:* `AddAuthentication().AddJwtBearer(...)` validates the signature, issuer, audience
      and expiry on every request. The signing key lives in a secret store (user secrets locally, a vault
      or environment secret when deployed), never in the repository.
    - *The caller:* `CallerIdModelBinder` reads the id from the verified token's `sub` claim instead of
      `X-User-Id`. A missing or bad token becomes **401** (today a missing header is 400). The routes,
      services and repositories stay as they are.
    - *Not covered:* callers with no user behind them (a scheduled job, a partner's server). They would
      get their own credentials (the OAuth client-credentials flow, or API keys) if they are ever needed.
    - *Rules:* saves, meal plans, cart, checkout and reviews require the `HomeCook` role. Every creator
      holds it and the admin does not, so the admin gets **403** on all of them with no special case.
    - *Client:* the Angular app hides the cart, save and shop controls by reading `roles` from
      `GET /api/me`. The server still enforces the 403, so hiding is only for the user's benefit.
    - *Tests:* each write endpoint, called as the admin, returns 403.
13. **Database refusals become readable 4xx responses**, built with the first write feature (item 7). The
    ProblemDetails plumbing is already in place (every error has a ProblemDetails body); what remains is
    mapping PostgreSQL's refusal codes to 400 or 409.
    A `check_violation` (`ck_…`), unique violation or trigger refusal that gets past a service becomes a
    400 or 409 ProblemDetails naming the rule, never a 500.
    - *Tests:* the trigger refusals that `TriggerTests` already provoke, sent through the API, come back
      as 4xx.

**Not planned:** followers and a Follow button (the prototype's follower count was removed). The database has no
followers table, so the Angular storefront leaves them out. Adding them later is a new table, a count on
`StorefrontDto`, and a `PUT`/`DELETE /api/me/follows/{handle}` pair. The storefront's recipe cards gain
`savedByViewer` with item 7.

Housekeeping alongside: step 1 above (comments on the database layer), and keeping `docs/Queries.md`
verified for every new query, with its logged SQL, plan and indexes.

## Business rules the API still has to enforce

The Assignment 2 feedback (Abraham) is answered in `DesignDocument.md` §3, and every rule the **database**
enforces is already proven by the integration tests. The rules below are the ones §3 assigns to the
**API**: they are not built yet. Each one lands with a roadmap item above and is built, test-first, with the feature it belongs to — a service
test with NSubstitute for the rule itself and an integration test over HTTP for the status code. Tick
them off here as they land. The status codes are proposals, to confirm when each feature is built.

| Rule | Design doc | Feature it lands with | Refused with |
|---|---|---|---|
| Saving, cart, checkout, meal plans and reviews require the `HomeCook` role. Every creator holds it; the admin does not, so the admin is shut out of all of them with no special case. | §3.1 | Each of those features, checked against the caller (Decisions so far, "Caller identity") | 403 |
| A creator cannot add their own product to the cart: the service refuses it with a clear message before the `cart_items_refuse_self_purchase` trigger would. | §3.1, `Queries.md` "Add to cart" | Cart | 400 |
| Checkout refuses a self-purchase the same way (the `order_items_refuse_self_purchase` trigger stays as the last line of defence). | §3.1 | Checkout | 400 |
| A database refusal (`check_violation` with a `ck_…` constraint name, or a unique violation) that slips past a service becomes a 4xx with a readable message, never a 500. | §5 | First write feature (saves or cart) | 400 / 409 |
| The feed, trending list, storefront and search show only published `Public` recipes. | §3.3 | Feed ✅ (`FeedEndpointTests`), storefront ✅ (`StorefrontEndpointTests`) | — |
| A `ProductOnly` recipe opens only for a viewer with a `Paid` order whose snapshot (`order_item_recipes`) contains it — the rule in `queries.sql` Q14 — or for the recipe's own creator. | §3.3 | Shopping list ✅ (counts only such recipes, `ShoppingListEndpointTests`), recipe detail | 404 (do not reveal it exists) |
| Saving a `ProductOnly` recipe requires the same access as opening it. | §3.3 | Saves | 404 |
| Checkout copies every `product_recipes` row of each product into `order_item_recipes`, writes the title, price and seller snapshots, sets `total_cents` to the sum of the lines, and empties the cart — all in one transaction. | §3.3, §6 | Checkout | — |
| Ownership and entitlement questions read the snapshot, never the live `product_recipes` (Q11, Q14). | §3.3 | Storefront ✅ (owned = a Paid order item), shopping list ✅, recipe detail, My kitchen / purchases | — |
| A review requires a `Paid` order item for that product by the same user; one review per user per product. | §3.5 | Reviews | 403 / 409 |

## Open items

- **Merged branches to delete:** their work is all in `main`. This environment cannot delete branches;
  do it under **Branches** on GitHub.
  - `feed-endpoint`, `creator-storefront`, `order-history`, `shopping-list`
  - `ci-workflow`, `ci-docs`, `deliverable-2-docs` (the last once its PR is merged)
  - the auto-named branch ending in `relaxed-newton-gutkwp`
