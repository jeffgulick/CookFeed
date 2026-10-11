# Cookfeed API — Build Log

Where the API build stands, how we work, and what comes next. Read this at the start of a working
session; update **Where we are** and **Next steps** at the end of each step, in the same commit as the work.

---

## Where we are

*Last updated 2026-10-11.*

The **database layer** and **all four core queries** are built. Three are merged into `main`:
- the recipe feed (`GET /api/feed`)
- the creator storefront (`GET /api/creators/{handle}`)
- order history (`GET /api/me/orders`)

These came in PRs #6, #7 and #8. The **shopping list** (`GET /api/me/shopping-list`) is on the
`shopping-list` branch. Each query is controller → service → repository → Contracts DTOs, and each has
its generated SQL verified in `docs/Queries.md`.

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

---

## Toolchain

| What | Version | Pinned in |
|---|---|---|
| .NET SDK | 10.0.112 (Ubuntu: `sudo apt install dotnet-sdk-10.0`) | `global.json` |
| `dotnet-ef` | 10.0.11 | `dotnet-tools.json` |
| PostgreSQL | 16.15 | `docker-compose.yml` |
| NuGet packages | see file | `Directory.Packages.props` + `packages.lock.json` |

In a claude.ai cloud session (a fresh Ubuntu 24.04 container each time), the same versions install with
`apt-get install dotnet-sdk-10.0=10.0.112-0ubuntu1~24.04.1`, then `dotnet tool restore`; PostgreSQL 16.15 is
already there and starts with `pg_ctlcluster 16 main start`.

Commands to migrate, run and test: [`README.md`](../README.md#getting-started) and
[`DOCKER.md`](../DOCKER.md).

---

## Next steps

Deliverable 2 (due **Oct 17**) is complete once the `shopping-list` branch is merged. After that:

1. **Comment the existing database-layer code** to the commenting rule above. Mainly the 19
   configurations, `CookfeedDbContext.cs` and `Program.cs`. Comments only: the build and the tests must be
   unchanged.
2. **Assignment 4:** the Angular app against these endpoints, and login (JWT) replacing the `X-User-Id`
   header (`DesignDocument.md` §9). Then the write features (saves, cart, checkout, reviews) and the
   business rules below.

## Business rules the API still has to enforce

The Assignment 2 feedback (Abraham) is answered in `DesignDocument.md` §3, and every rule the **database**
enforces is already proven by the integration tests. The rules below are the ones §3 assigns to the
**API**: they are not built yet. Each one is built, test-first, with the feature it belongs to — a service
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

- **Old branch:** the auto-named branch ending in `relaxed-newton-gutkwp` is still on GitHub and can be
  deleted (its work is in `main`). This environment cannot delete branches; do it under **Branches** on
  GitHub.
