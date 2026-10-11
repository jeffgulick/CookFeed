# Cookfeed API

The back end of Cookfeed, a short-video recipe marketplace: ASP.NET Core 10 with controllers, EF Core 10
and PostgreSQL 16, laid out as Clean Architecture. The design, and why it is built this way, is in
[`docs/DesignDocument.md`](docs/DesignDocument.md); where the build stands and what comes next is in
[`docs/BuildLog.md`](docs/BuildLog.md).

## Status

| Part | State |
|---|---|
| Database design: schema, seed data, queries (`docs/`) | Done |
| EF Core entities, mappings and migration | Done — builds the same database as `docs/schema.sql` |
| C# seeder | Done — loads the same rows as `docs/sql/seed.sql` |
| Integration tests for the database | Done — 45 tests, all passing |
| Recipe feed, `GET /api/feed` | Done: controller, service, repository, DTOs; 21 tests; SQL verified in `docs/Queries.md` §1 |
| Creator storefront, `GET /api/creators/{handle}` | Done: 24 tests; SQL verified in `docs/Queries.md` §2 |
| Order history, `GET /api/me/orders` | Done: 14 tests; SQL verified in `docs/Queries.md` §4 |
| Shopping list | Next, test-first |

## Layout

```
Cookfeed.slnx
src/
  Cookfeed.Domain/           entities and enums; no framework references
  Cookfeed.Contracts/        request and response DTOs
  Cookfeed.Application/      services and repository interfaces
  Cookfeed.Infrastructure/   CookfeedDbContext, table mappings, migrations, DbSeeder, repositories
  Cookfeed.Api/              the web host and its controllers
tests/
  Cookfeed.IntegrationTests/ xUnit tests against real PostgreSQL, including the API over HTTP
  Cookfeed.Domain.Tests/     xUnit; first tests come with the shopping-list logic
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

`DOCKER.md` explains each command, how to look inside the database with `psql`, and the fidelity test.
