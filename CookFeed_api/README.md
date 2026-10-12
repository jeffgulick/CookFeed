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
| Feed | `GET /api/feed?sort=Newest\|Trending&page=&pageSize=` | §1 |
| Creator storefront | `GET /api/creators/{handle}` | §2 |
| Order history | `GET /api/me/orders` | §4 |
| Shopping-list aggregation | `GET /api/me/shopping-list?weekStart=` | §3 |

Since Deliverable 2, from the API roadmap in `docs/BuildLog.md`: recipe detail, `GET /api/recipes/{id}`
(Queries.md §1b), CORS for the Angular dev server, and an OpenAPI description at `/openapi/v1.json` in
Development.

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
| Tests | 251, all passing: Domain 26, Application 24, Integration 201 |
| Recipe feed, `GET /api/feed` | Done: controller, service, repository, DTOs; 21 tests; SQL verified in `docs/Queries.md` §1 |
| Creator storefront, `GET /api/creators/{handle}` | Done: 24 tests; SQL verified in `docs/Queries.md` §2 |
| Order history, `GET /api/me/orders` | Done: 14 tests; SQL verified in `docs/Queries.md` §4 |
| Shopping list, `GET /api/me/shopping-list` | Done: 26 tests, incl. 14 Domain tests for `ShoppingListAggregator`; SQL verified in `docs/Queries.md` §3 |
| Recipe detail, `GET /api/recipes/{id}` | Done: the access rule in `Domain/Access/RecipeAccess` (12 Domain tests), 4 service tests, 19 HTTP tests against Q4 and Q14; SQL verified in `docs/Queries.md` §1b |
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
docker compose up -d --wait            # PostgreSQL 16.15 on localhost:5432
dotnet tool restore                    # installs dotnet-ef
dotnet ef database update --project src/Cookfeed.Infrastructure --startup-project src/Cookfeed.Api
dotnet run --project src/Cookfeed.Api  # seeds an empty database in Development, then serves the API
dotnet test --solution Cookfeed.slnx   # all tests
```

Every pull request that touches `CookFeed_api/` runs the same restore, build and tests in GitHub Actions
(`.github/workflows/api-tests.yml`, against `postgres:16.15`); the result shows on the PR.

`DOCKER.md` explains each command, how to look inside the database with `psql`, and the fidelity test.
