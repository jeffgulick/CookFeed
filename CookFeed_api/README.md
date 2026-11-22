# Cookfeed API

[![API tests](https://github.com/jeffgulick/CookFeed/actions/workflows/api-tests.yml/badge.svg)](https://github.com/jeffgulick/CookFeed/actions/workflows/api-tests.yml)

The back end of Cookfeed, a short-video recipe marketplace: ASP.NET Core 10 with controllers, EF Core 10
and PostgreSQL 16, laid out as Clean Architecture. The design, and why it is built this way, is in
[`docs/DesignDocument.md`](docs/DesignDocument.md); where the build stands and what comes next is in
[`docs/BuildLog.md`](docs/BuildLog.md).

## Deliverable 2

Every item is in `main`, and the tests check it on every pull request that touches the API.

| Item | Where it lives |
|---|---|
| **1. ER diagram and 3NF schema** as EF Core entities and migrations: users and roles, recipes and steps, ingredients and recipe quantities, saves, meal plans, products, cart, orders and order items | Diagrams: [`docs/ERDiagram.svg`](docs/ERDiagram.svg), [`docs/EERDiagram.svg`](docs/EERDiagram.svg), [`docs/ThirdNormalForm.svg`](docs/ThirdNormalForm.svg). Reference DDL: [`docs/schema.sql`](docs/schema.sql). Entities: `src/Cookfeed.Domain/Entities/`. Mappings: `src/Cookfeed.Infrastructure/Persistence/Configurations/`. Migration, with the four triggers: `Persistence/Migrations/`. The table inventory is in DesignDocument.md §2 |
| **2. Seed data** that builds the database from scratch with realistic content | [`docs/sql/seed.sql`](docs/sql/seed.sql), and the same rows in C# in `Persistence/Seed/DbSeeder.cs`. In Development the API seeds an empty database at startup |
| **3. Core queries in LINQ**, with the generated SQL reviewed and the indexes chosen and justified | [`docs/Queries.md`](docs/Queries.md) gives, for each query, the LINQ, the SQL EF Core logged, the `EXPLAIN ANALYZE` plan and the reasoning for each index. Code: `Persistence/Repositories/`. Reference SQL: [`docs/sql/queries.sql`](docs/sql/queries.sql) |
| **4. Design document**: normalization, constraints and referential integrity, denormalization, and the ingredient and unit model | [`docs/DesignDocument.md`](docs/DesignDocument.md): §4 normalization, §5 constraints, §6 where I denormalized, §7 canonical ingredients, unit categories, density and the preferred shopping unit |
| **5. ASP.NET Core API with tests** over these queries, for the Angular work in Assignment 4 | Controllers: `src/Cookfeed.Api/Controllers/`. Endpoints and tests are listed below |

The four endpoints:

| Query | Endpoint | Queries.md |
|---|---|---|
| Feed | `GET /api/feed?sort=Newest\|Trending&page=&pageSize=&search=` | §1 |
| Creator storefront | `GET /api/creators/{handle}` | §2 |
| Order history | `GET /api/me/orders` | §4 |
| Shopping-list aggregation | `GET /api/me/shopping-list?weekStart=` | §3 |

Since Deliverable 2, from the API roadmap in `docs/BuildLog.md`: recipe detail, `GET /api/recipes/{id}`
(Queries.md §1b), the plan page and its shopping list, `GET /api/products/{id}` (§1c), my purchases and a
product's reviews (§1d), the plans for sale and the creators, `GET /api/products` and `GET /api/creators`
(§1e), the cart and checkout, the API's first writes (§5), saved recipes (§6), writing and deleting a review (§7), shopping lists (§8), CORS for the Angular dev server, and an OpenAPI
description at `/openapi/v1.json` in Development.

**How it is checked.** Each endpoint is tested over HTTP against what the reference queries in
`queries.sql` return on the same seeded database (Q1, Q2, Q3, Q5, Q8, Q9). For example, the shopping list
must equal Q8 line for line: 41 lines, with "2 cups flour" and "500 g flour" merged into flour 1,032.91 g.
GitHub Actions runs the build and all the tests on every pull request that touches the API.

**What reviewing the generated SQL changed** (each is written up in `docs/Queries.md`):
- **Storefront: split query.** In one statement, the recipe list and the product list multiplied each
  other's rows; `AsSplitQuery()` sends three small statements instead.
- **Shopping list: explicit joins.** Summing through navigation properties made EF Core run a correlated
  subquery per output line. Explicit `join`s give one plain `GROUP BY`.
- **Shopping list: rounding inside the `SUM`.** PostgreSQL's exact division for serving scale overflowed
  .NET's `decimal`, so each line is rounded to 6 places inside the `SUM`.
- **Order history: the seller at checkout.** The seller is the snapshot `creator_id` on `order_items`, not
  today's owner of the product.
- **Not every query needed changing.** The feed pages before it joins; order history is one statement,
  because a single collection multiplies no rows.

## Status

| Part | State |
|---|---|
| Database design: schema, seed data, queries (`docs/`) | Done |
| EF Core entities, mappings and migration | Done — builds the same database as `docs/schema.sql` |
| C# seeder | Done — loads the same rows as `docs/sql/seed.sql` |
| Tests | 794, all passing: Domain 107, Application 112, Integration 575 |
| Recipe feed, `GET /api/feed` | Done: controller, service, repository, DTOs; 21 tests; SQL verified in `docs/Queries.md` §1 |
| Creator storefront, `GET /api/creators/{handle}` | Done: 35 tests; SQL verified in `docs/Queries.md` §2, with the 2026-11-21 changes noted there |
| Order history, `GET /api/me/orders` | Done: 14 tests; SQL verified in `docs/Queries.md` §4 |
| Shopping list, `GET /api/me/shopping-list` | Done: 26 tests, incl. 14 Domain tests for `ShoppingListAggregator`; SQL verified in `docs/Queries.md` §3 |
| Recipe detail, `GET /api/recipes/{id}` | Done: the access rule in `Domain/Access/RecipeAccess` (15 Domain tests), 5 service tests, 26 HTTP tests against Q4 and Q14; a premium recipe the viewer has not bought is a 403 naming the plans selling it; SQL verified in `docs/Queries.md` §1b |
| Plan page, `GET /api/products/{id}` | Done: 13 service tests, 42 HTTP tests against Q5, Q13 and Q15; described in `docs/Queries.md` §1c |
| Plan shopping list, `GET /api/products/{id}/shopping-list` | Done: the amounts as each recipe writes them, as the prototype's plan page lists them (`Domain/ShoppingList/WrittenShoppingList`, 5 Domain tests); 6 service tests, 17 HTTP tests checked against the same sums in plain SQL |
| My purchases, `GET /api/me/purchases` | Done: 2 service tests, 15 HTTP tests against Q11 and Q15 |
| A product's reviews, `GET /api/products/{id}/reviews` | Done: the form rule in `Domain/Access/ReviewAccess` (11 Domain tests), 16 service tests, 24 HTTP tests against Q12 and Q13 |
| Plans for sale, `GET /api/products?type=&sort=` | Done: for sale by the same rule as the plan page, a type filter, three sorts, and what the viewer owns; 4 service tests, 16 HTTP tests; described in `docs/Queries.md` §1e |
| Creators, `GET /api/creators` | Done: every creator as a tile, in the order they joined; 3 HTTP tests |
| Cart, `GET /api/me/cart`, `PUT` and `DELETE /api/me/cart/{productId}`, `DELETE /api/me/cart` | Done: the buy rule in `Domain/Access/BuyAccess` (16 Domain tests), 15 service tests, 17 HTTP tests; each change answers with the cart; described in `docs/Queries.md` §5 |
| Checkout, `POST /api/me/checkout` | Done: one transaction writes the Paid order, its lines and their recipe snapshots and empties the cart; 5 service tests, 10 HTTP tests; described in `docs/Queries.md` §5 |
| Writing a review, `POST /api/products/{id}/reviews` and `DELETE /api/products/{id}/reviews/mine` | Done: allowed exactly when the reviews page shows the caller the form (`ReviewAccess`); 13 service tests, 18 HTTP tests; described in `docs/Queries.md` §7 |
| Shopping lists, `/api/me/trips` | Done: made by "Shop this recipe" or "Shop this plan"; a cook can keep several lists in use, adding to the one they name or starting a new one; lines computed with the shopping list's arithmetic; Have it, people, start, done, delete; Shop again from a finished list; the rules in `Domain/ShoppingList/TripRules` (30 Domain tests) and 29 HTTP tests; described in `docs/Queries.md` §8 |
| Saved recipes, `GET /api/me/saves`, `PUT` and `DELETE /api/me/saves/{recipeId}` | Done: who may save in `Domain/Access/RecipeAccess.CanSave` (7 Domain tests), 9 service tests, 17 HTTP tests against Q6 and Q16; the database's trigger keeps `save_count`; described in `docs/Queries.md` §6 |
| Creator studio, `GET /api/me/studio`, `POST /api/me/studio/recipes/{id}/publish` and `/unpublish`, `POST /api/me/studio/products/{id}/retire` and `/restore` | Done: what a creator publishes, sells and has earned, in one read; the rules in `Domain/Access/StudioRules`; a refusal is a 409 with the sentence to show, and each row carries that sentence beforehand; Domain and HTTP tests; described in `docs/Queries.md` §9. Not built: creating and editing a recipe or a plan |
| Reset to the seed, `POST /api/dev/reset` | Done: Development only, for demonstrations and the browser tests; 2 tests |
| Accounts for the sign-in picker, `GET /api/accounts` | Done: Development only (`Accounts:PickerEnabled`), no email or password data; 6 tests |
| CORS and OpenAPI | Done: the Angular dev server may call the API; `/openapi/v1.json` describes it in Development (5 and 9 tests) |
| Continuous integration | Done: GitHub Actions runs the build and all the tests on every pull request that touches the API (`.github/workflows/api-tests.yml`) |

## Layout

```
Cookfeed.slnx
src/
  Cookfeed.Domain/           entities, enums and the shopping-list aggregator; no framework references
  Cookfeed.Contracts/        request and response DTOs
  Cookfeed.Application/      services and repository interfaces
  Cookfeed.Infrastructure/   CookfeedDbContext, table mappings, migrations, DbSeeder, repositories
  Cookfeed.Api/              the web host and its controllers
tests/
  Cookfeed.IntegrationTests/ xUnit tests against real PostgreSQL, including the API over HTTP
  Cookfeed.Domain.Tests/     xUnit: the shopping-list aggregator, no database
  Cookfeed.Application.Tests/ xUnit + NSubstitute: service rules against fake repositories
docs/                        design document, ER diagrams, schema.sql, seed.sql, queries.sql
```

Each project references only the layers inside it: Application uses Domain and Contracts,
Infrastructure implements Application's interfaces with EF Core, and Api wires everything together.

## Versions

Everything is pinned so every machine builds and tests the same thing:

| What | Version | Pinned in |
|---|---|---|
| .NET SDK | 10.0.112 | `global.json` |
| NuGet packages | see file | `Directory.Packages.props`, plus `packages.lock.json` in each project |
| `dotnet-ef` | 10.0.11 | `dotnet-tools.json` |
| PostgreSQL | 16.15 | `docker-compose.yml` |

On Ubuntu 24.04 (including WSL), `sudo apt install dotnet-sdk-10.0` installs SDK 10.0.112.

## Getting started

From this folder, with Docker running (one-time Docker setup is in [`DOCKER.md`](DOCKER.md)):

```bash
cp .env.example .env                   # once: this machine's database password (git-ignored)
docker compose up -d --wait            # PostgreSQL 16.15 on localhost:5432
dotnet tool restore                    # installs dotnet-ef
dotnet ef database update --project src/Cookfeed.Infrastructure --startup-project src/Cookfeed.Api
dotnet run --project src/Cookfeed.Api  # seeds an empty database in Development, then serves the API
dotnet test --solution Cookfeed.slnx   # all tests
```

Git ignores `.env`, and `.env.example` is committed in its place, which is common practice: the example shows
which settings a machine needs. The value in it is a placeholder for the database container on your own
machine, so the project runs without editing anything. It is not a credential for any real service.

Every pull request that touches `CookFeed_api/` runs the same restore, build and tests in GitHub Actions
(`.github/workflows/api-tests.yml`, against `postgres:16.15`); the result shows on the PR.

`DOCKER.md` explains each command, how to look inside the database with `psql`, and the fidelity test.
