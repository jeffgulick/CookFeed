# Running Cookfeed's database in Docker

PostgreSQL 16 runs in a container and listens on `localhost:5432`; the API runs on the WSL host and
connects to it there. There is no Dockerfile — we use the official `postgres:16.15` image as-is, pinned
to the exact version the build is tested against, so `docker-compose.yml` is the whole setup.

| Database | Used by | Created by |
|---|---|---|
| `cookfeed` | development: `dotnet run`, and the `docs/` scripts | the container, from `POSTGRES_DB`; tables by `dotnet ef database update` |
| `cookfeed_test_*` | `tests/Cookfeed.IntegrationTests` | the tests themselves: each run creates throwaway databases and drops them when it finishes |

The development connection string lives in `src/Cookfeed.Api/appsettings.Development.json`:

```
Host=localhost;Port=5432;Database=cookfeed;Username=postgres;Password=postgres
```

The integration tests connect to the same server with the same credentials (the database name in their
default connection string is not used; they create their own). To run them against a different server,
set `COOKFEED_TEST_CONNECTION` to its connection string.

The `cookfeed_test` database that `docker/init/01-create-test-db.sql` creates is no longer used by the
tests. It does no harm, so the init script stays.

---

## One-time setup

1. Docker Desktop must be running on Windows with WSL2 integration enabled for Ubuntu
   (Docker Desktop → Settings → Resources → WSL Integration).

2. Your WSL user must be in the `docker` group. Check with `id` — if it does not list `docker`:

   ```bash
   sudo usermod -aG docker $USER
   ```

   Then run `wsl --shutdown` in **PowerShell** and reopen the WSL terminal. Group membership is
   only applied at login, so a new shell in the old session is not enough.

---

## Everyday commands

Run these from `CookFeed_api/` (the folder holding `docker-compose.yml`).

```bash
docker compose up -d --wait
```
Starts PostgreSQL in the background and waits until it actually accepts connections. First run
downloads the image (~150 MB) and creates both databases.

```bash
docker compose ps
```
Shows whether the container is running and whether its healthcheck is passing.

```bash
docker compose logs -f postgres
```
Tails the server log. Ctrl-C stops watching; it does not stop the database.

```bash
docker compose stop
```
Stops the container but keeps the data. Use this at the end of the day.

```bash
docker compose down
```
Stops and removes the container. The named volume, and therefore the data, survives.

```bash
docker compose down -v
```
**Destroys the data**, including both databases. Use this when you want the init script to run
again from scratch. Next `up` starts from an empty server.

---

## Talking to the database

```bash
docker compose exec postgres psql -U postgres -d cookfeed
```
Opens an interactive `psql` session inside the container. `\dt` lists tables, `\d recipes`
describes one, `\q` quits.

```bash
docker compose exec -T postgres psql -U postgres -d cookfeed < docs/schema.sql
```
Pipes a local file into `psql` in the container. `-T` disables TTY allocation, which is what
makes the redirect work.

To use a `psql` installed in WSL instead of the container's, add `-h localhost -p 5432`:

```bash
psql -h localhost -p 5432 -U postgres -d cookfeed -f docs/sql/seed.sql
```

---

## The API: migrate, run, test

Run these from `CookFeed_api/`, with the container up (`docker compose up -d --wait`).

```bash
dotnet tool restore
```
Installs the pinned `dotnet-ef` tool from `dotnet-tools.json`. Once per clone.

```bash
dotnet ef database update --project src/Cookfeed.Infrastructure --startup-project src/Cookfeed.Api
```
Applies the EF Core migrations to the `cookfeed` database: 19 tables and the four triggers. Run it
again after pulling a commit that adds a migration.

```bash
dotnet run --project src/Cookfeed.Api
```
Starts the API. In Development it first fills an empty database with the `seed.sql` data
(`DbSeeder`); once the database has accounts it leaves it alone.

While it runs in Development:
- **`http://localhost:5032/openapi/v1.json`** describes every endpoint, its parameters (including the
  `X-User-Id` caller header) and its responses. The Angular client's types can be generated from it.
  Outside Development it is not served (`OpenApi:Enabled` in `appsettings.Development.json`).
- **CORS** allows the Angular dev server, `http://localhost:4200`. A deployed front end needs its own
  origin in `Cors:AllowedOrigins` (in `appsettings.json` or an environment variable such as
  `Cors__AllowedOrigins__0`); with none set, browsers on other origins are refused.

```bash
dotnet test --solution Cookfeed.slnx
```
Runs every test project. The integration tests need the container running; they create their own
databases, so they never touch `cookfeed`.

---

## The fidelity test

The project requires the EF migration to produce a schema that the submitted seed and queries run
against unchanged. `dotnet test` checks all three steps below on every run (`SchemaFidelityTests` and
`SeedScriptTests`), so these commands are for seeing it by hand.

Start from a clean, migrated database and do **not** `dotnet run` first: the seeder would load the same
rows, and `seed.sql` would then fail on duplicate ids.

```bash
# 1. Load the submitted seed data into the migrated dev database.
docker compose exec -T postgres psql -U postgres -d cookfeed -v ON_ERROR_STOP=1 < docs/sql/seed.sql
```
`ON_ERROR_STOP=1` makes psql exit on the first error instead of plowing ahead — without it a
failed INSERT scrolls past unnoticed.

```bash
# 2. Run the submitted queries and compare against the results quoted in docs/DesignDocument.md
#    (Q5: 5 recipes / 6 meals; Q8: 41 lines, flour 1032.91 g, milk 946.35 ml; Q15; Q16: 0 rows).
docker compose exec -T postgres psql -U postgres -d cookfeed < docs/sql/queries.sql
```

```bash
# 3. Diff the migrated schema against the reference DDL.
docker compose exec -T postgres pg_dump -U postgres -d cookfeed --schema-only --no-owner > /tmp/actual-schema.sql
diff <(grep -v '^--' /tmp/actual-schema.sql) <(grep -v '^--' docs/schema.sql) | head -50
```
`pg_dump --schema-only` prints the structure without any rows. The output will not be
byte-identical to `docs/schema.sql` (pg_dump has its own formatting and ordering, and EF Core names
primary and foreign keys `pk_…`/`fk_…` where `schema.sql` lets PostgreSQL name them), so read the diff
for real differences — missing constraints, wrong types, renamed indexes — rather than expecting it to
be empty. `SchemaFidelityTests` does this comparison precisely.

To start the fidelity test from a clean database:

```bash
docker compose exec -T postgres psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS cookfeed WITH (FORCE);" -c "CREATE DATABASE cookfeed;"
```
Drops and recreates the dev database. The two statements need separate `-c` flags: psql runs a
single `-c` with several statements as one transaction, and `DROP DATABASE` is not allowed inside
a transaction. `WITH (FORCE)` disconnects anything still attached, which is usually a stray
`dotnet run` or a database viewer. Then run `dotnet ef database update` again before step 1.

---

## Troubleshooting

**`permission denied while trying to connect to the Docker daemon socket`**
Your shell is not in the `docker` group yet. See One-time setup, step 2.

**`Cannot connect to the Docker daemon`**
Docker Desktop is not running on Windows, or WSL integration is off for this distro.

**`bind: address already in use` on 5432**
Something else already holds the port — often a PostgreSQL installed directly in WSL. Check with
`ss -ltn | grep 5432`. Either stop it (`sudo systemctl stop postgresql`) or change the host side
of the mapping in `docker-compose.yml` to `"5433:5432"` and update the connection strings.

**The integration tests fail with `connection refused` or a timeout**
The container is not running, or not healthy yet. Run `docker compose up -d --wait` and try again.

**Lots of `cookfeed_test_…` databases left behind**
A test run that was killed part-way cannot drop its databases. They are harmless; remove them with
`docker compose down -v` (which also resets `cookfeed`) or drop them one by one in `psql`.

**`password authentication failed`**
The password is baked into the volume on first creation. If you changed `POSTGRES_PASSWORD`
after the fact, either change it back or run `docker compose down -v` and start over.
