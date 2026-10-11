# Cookfeed API — Build Log

Where the API build stands, how we work, and what comes next. Read this at the start of a working
session; update **Where we are** and **Next steps** at the end of each step, in the same commit as the work.

---

## Where we are

*Last updated 2026-10-11.*

The **database layer** is built, tested and merged into `main` (PR #2). Nothing above it exists yet.

| Done | Where |
|---|---|
| Solution: 5 `src` projects + 3 test projects, Clean Architecture, versions pinned | `Cookfeed.slnx`, `global.json`, `Directory.*.props`, `dotnet-tools.json` |
| 19 entities and 5 enums, one per table in `schema.sql`; no EF Core reference | `src/Cookfeed.Domain/` |
| `CookfeedDbContext` and 19 table mappings, written to match `schema.sql` | `src/Cookfeed.Infrastructure/Persistence/` |
| `InitialCreate` migration, with the four triggers copied from `schema.sql` | `Persistence/Migrations/` |
| `DbSeeder`: the same rows and ids as `seed.sql`; runs at startup in Development | `Persistence/Seed/` |
| 45 integration tests against real PostgreSQL, all passing | `tests/Cookfeed.IntegrationTests/` |
| Docs updated to match | `README.md`, `DOCKER.md`, `docs/DesignDocument.md` §1 |

Not built yet: repositories, services, controllers, DTOs, `ShoppingListAggregator`, and the Domain and
Application tests.

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
| API style | Controllers → services → repositories; not minimal APIs | `DesignDocument.md` §1 |
| Layers | One project per layer; each references only the layers inside it | `DesignDocument.md` §1, `README.md` |
| Queries | LINQ lives only in repositories (`Infrastructure/Persistence/Repositories/`). Services hold the rules and see only repository interfaces | Lets Application tests use fakes; Application does not reference EF Core |
| Repositories | One per area with specific methods; no generic `Repository<T>`. Reads project into Contracts DTOs | `DesignDocument.md` §1 |
| EF Core model | Code-first. Entities and configurations written by hand; migrations generated with `dotnet ef migrations add`; triggers added to the migration by hand | Configurations are the source of truth from now on |
| Connection | Configured at registration (`AddInfrastructure`, `UseCookfeedDatabase`), not in `OnConfiguring` | Configuration and tests supply the connection string |
| Enums | Stored as their names in varchar columns | `CookfeedDbContext.ConfigureConventions`, `DesignDocument.md` §5 |
| Tests | xUnit v3 on Microsoft.Testing.Platform (run with `dotnet test --solution`); NSubstitute for fakes; integration tests create and drop throwaway databases and roll back their changes | `DesignDocument.md` §1 "Tests" |

---

## Toolchain

| What | Version | Pinned in |
|---|---|---|
| .NET SDK | 10.0.112 (Ubuntu: `sudo apt install dotnet-sdk-10.0`) | `global.json` |
| `dotnet-ef` | 10.0.11 | `dotnet-tools.json` |
| PostgreSQL | 16.15 | `docker-compose.yml` |
| NuGet packages | see file | `Directory.Packages.props` + `packages.lock.json` |

Commands to migrate, run and test: [`README.md`](../README.md#getting-started) and
[`DOCKER.md`](../DOCKER.md).

---

## Next steps

1. **Comment the existing database-layer code** to the commenting rule above. Mainly the 19
   configurations, `DependencyInjection.cs`, `CookfeedDbContext.cs` and `Program.cs`; fill small gaps
   elsewhere. Comments only — the build and the 45 tests must be unchanged.
2. **First feature, stepped through together: the recipe feed**, `GET /api/feed`.
   `FeedController` → `FeedService` → `IRecipeRepository.GetFeedAsync` → DTOs in Contracts. Test-first:
   Application tests with NSubstitute, an integration test over HTTP with `WebApplicationFactory`. The
   planned LINQ and its index are in `docs/Queries.md` §1.
3. **Before the first write feature (saves, cart):** decide how the API knows who is calling — the
   `X-User-Id` header alone, or `/api/users/{id}/…` in the route checked against it. Routes that take a user
   id without that check would let one user read or change another's data.

## Open items

- **CI:** a GitHub Actions workflow that runs `dotnet test` with a `postgres:16.15` service, so every pull
  request shows green or red.
- **Old branch:** the auto-named branch ending in `relaxed-newton-gutkwp` is still on GitHub and can be
  deleted (its work is in `main`). This environment cannot delete branches; do it under **Branches** on
  GitHub.
