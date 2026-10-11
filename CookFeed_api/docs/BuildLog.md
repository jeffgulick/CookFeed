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
| CI: `.github/workflows/api-tests.yml` runs a locked restore, the build and all tests against a `postgres:16.15` service on every PR and push to `main` that touches `CookFeed_api/` | `.github/workflows/` |

Every Deliverable 2 item is in place: ER diagram and 3NF schema, seed data, the four core queries in LINQ
with reviewed SQL and justified indexes, the design document, and the API with tests.

---

## Frontend

**Today: an HTML/JavaScript prototype** in `CookFeed_frontend/prototype/` (Homework 1, extended in
Homework 3). Eight pages — product, reviews, creator storefront, cart and checkout, My kitchen, and three
recipe pages — run straight from the file system with no server. The cart, saves, reviews and orders are
kept in the browser's `localStorage`, shaped like the database rows, and the content is the same seed data
as `seed.sql`. How to run it and what each page does: `CookFeed_frontend/prototype/README.md`.

**Next: the Angular application (Assignment 4)**, built against this API once the endpoints it needs
exist. It replaces the prototype, and the prototype folder is deleted then. The features deferred to it
are listed under "Planned for the Angular production build" in the prototype README: real shopping units,
review trust labels, the creator header layout, order history, the Instacart and Favor handoffs, and
custom confirmation dialogs. Design doc §3.7 lists what the business rules change on screen (no "Add to
cart" on a creator's own product, ProductOnly recipes, no shop controls for the admin).

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
| Caller identity | `X-User-Id` header until login (Assignment 4). A user's own data is under `/api/me/…`, where the header is required (400 if missing); no route takes a user id. No custom authentication handler: JWT replaces the header then | `DesignDocument.md` §9 |
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

1. **CORS.** The Angular dev server (`http://localhost:4200`) is a different origin, so the browser blocks
   its calls until the API allows it. A named policy in `Program.cs`, with the allowed origins from
   configuration so production can differ.
   - *Test:* a request with `Origin: http://localhost:4200` gets `Access-Control-Allow-Origin` back, and
     another origin does not.
2. **OpenAPI description** (optional but useful). `Microsoft.AspNetCore.OpenApi`, built into .NET 10,
   serves `/openapi/v1.json` in Development: every endpoint and DTO, from which the Angular client types
   can be generated.
   - *Test:* the document is served and lists the endpoints.

**B. Reads still missing**

3. **Recipe detail**, `GET /api/recipes/{id}`: the recipe, its steps and its ingredient lines (Q4). The
   planned LINQ is in `docs/Queries.md` §1b.
   - *Rules:* a `ProductOnly` recipe opens only for a viewer whose Paid snapshot contains it (Q14),
     reading the snapshot, never the live bundle. Everyone else gets **404**, so its existence isn't
     revealed. Drafts are 404 too.
   - *Tests:* Q4's lines; Q14's access matrix.
4. **My purchases**, `GET /api/me/purchases`: the recipes the caller owns through Paid orders, grouped by
   the product they came with (Q11).
   - *Rules:* reads `order_item_recipes`, so a later bundle edit changes nothing (Q15's drift case).
   - *Tests:* equal to Q11.
5. **Reviews for a product**, `GET /api/products/{id}/reviews`: newest first, with the reviewer's name
   (Q12), plus a summary of count, average rating and percent recommending (Q13).
   - *Tests:* equal to Q12 and Q13.

**C. Writes**

6. **Saves.** `PUT /api/me/saves/{recipeId}` and `DELETE /api/me/saves/{recipeId}`, both idempotent, plus
   `GET /api/me/saves` (Q6). This is the first write feature, so it also brings item 12.
   - *Rules:* a `ProductOnly` recipe can be saved only with the same access as opening it (404 otherwise).
   - *Tests:* the `save_count` trigger keeps the feed's count right (Q16 stays empty).
7. **Meal plans.** `GET /api/me/meal-plans/{weekStart}` (Q7), `PUT` to create the week's plan (one per
   user per week), `POST …/entries` to add a recipe on a day and slot with an optional servings override,
   and `DELETE …/entries/{id}`. Today the shopping list reads plans, but nothing can create one through
   the API.
   - *Rules:* an entry's date falls inside its week; the same recipe may appear on several days
     (DesignDocument.md §3.2).
   - *Tests:* after adding entries, the shopping list changes the way Q8 says it should.
8. **Cart.** `GET /api/me/cart`, `PUT /api/me/cart/{productId}`, `DELETE /api/me/cart/{productId}`.
   - *Rules:* a creator cannot add their own product (**400**, a readable message before the trigger
     would refuse it); only active products can be added.
9. **Checkout**, `POST /api/me/checkout`, in one transaction (DesignDocument.md §6):
   - creates the `Paid` order (payment simulated, §9);
   - writes each item's title, price and seller snapshot;
   - copies every `product_recipes` row into `order_item_recipes`;
   - sets `total_cents` to the sum of the lines;
   - empties the cart.
   - *Rules:* no self-purchase (**400**), and an empty cart is a **400**.
   - *Tests:* the new order appears in `GET /api/me/orders`; its recipes open through recipe detail; a
     failure part-way leaves nothing behind.
10. **Reviews**, `POST /api/products/{id}/reviews`.
    - *Rules:* requires a Paid order item for that product by the caller (**403**); one review per user
      per product (**409**).

**D. Cross-cutting**

11. **Login (JWT) and roles.** Replaces the `X-User-Id` header (DesignDocument.md §9). Controllers read
    the caller from the token's user-id claim, and the routes, services and repositories stay as they
    are.
    - *Rules:* saves, meal plans, cart, checkout and reviews require the `HomeCook` role. Every creator
      holds it and the admin does not, so the admin gets **403** on all of them with no special case.
    - *Tests:* each write endpoint, called as the admin, returns 403.
12. **Database refusals become readable 4xx responses**, built with the first write feature (item 6).
    A `check_violation` (`ck_…`), unique violation or trigger refusal that gets past a service becomes a
    400 or 409 ProblemDetails naming the rule, never a 500.
    - *Tests:* the trigger refusals that `TriggerTests` already provoke, sent through the API, come back
      as 4xx.

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
| A `ProductOnly` recipe opens only for a viewer with a `Paid` order whose snapshot (`order_item_recipes`) contains it — the rule in `queries.sql` Q14. | §3.3 | Recipe detail | 404 (do not reveal it exists) |
| Saving a `ProductOnly` recipe requires the same access as opening it. | §3.3 | Saves | 404 |
| Checkout copies every `product_recipes` row of each product into `order_item_recipes`, writes the title, price and seller snapshots, sets `total_cents` to the sum of the lines, and empties the cart — all in one transaction. | §3.3, §6 | Checkout | — |
| Ownership and entitlement questions read the snapshot, never the live `product_recipes` (Q11, Q14). | §3.3 | Recipe detail, My kitchen / purchases | — |
| A review requires a `Paid` order item for that product by the same user; one review per user per product. | §3.5 | Reviews | 403 / 409 |

## Open items

- **Merged branches to delete:** their work is all in `main`. This environment cannot delete branches;
  do it under **Branches** on GitHub.
  - `feed-endpoint`, `creator-storefront`, `order-history`, `shopping-list`
  - `ci-workflow`, `ci-docs`, `deliverable-2-docs` (the last once its PR is merged)
  - the auto-named branch ending in `relaxed-newton-gutkwp`
