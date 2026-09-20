# Running Cookfeed's database in Docker

PostgreSQL 16 runs in a container; the API runs on the WSL host and connects to it over
`localhost:5432`. There is no Dockerfile — we use the official `postgres:16` image as-is, so
`docker-compose.yml` is the whole setup.

| Database | Used by | Created by |
|---|---|---|
| `cookfeed` | development, `dotnet run` | the container, from `POSTGRES_DB` |
| `cookfeed_test` | `tests/Cookfeed.IntegrationTests` | `docker/init/01-create-test-db.sql` |

Connection string (both live in `appsettings.Development.json` / test config):

```
Host=localhost;Port=5432;Database=cookfeed;Username=postgres;Password=postgres
Host=localhost;Port=5432;Database=cookfeed_test;Username=postgres;Password=postgres
```

The test connection can be overridden with the `COOKFEED_TEST_CONNECTION` environment variable.

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

## The fidelity test

CLAUDE.md requires the EF migration to produce a schema that the submitted seed and queries run
against unchanged. After `dotnet ef database update`:

```bash
# 1. Load the submitted seed data into the dev database.
docker compose exec -T postgres psql -U postgres -d cookfeed -v ON_ERROR_STOP=1 < docs/sql/seed.sql
```
`ON_ERROR_STOP=1` makes psql exit on the first error instead of plowing ahead — without it a
failed INSERT scrolls past unnoticed.

```bash
# 2. Run the submitted queries and compare against write-up section 7.
docker compose exec -T postgres psql -U postgres -d cookfeed < docs/sql/queries.sql
```

```bash
# 3. Diff the migrated schema against the reference DDL.
docker compose exec -T postgres pg_dump -U postgres -d cookfeed --schema-only --no-owner > /tmp/actual-schema.sql
diff <(grep -v '^--' /tmp/actual-schema.sql) <(grep -v '^--' docs/schema.sql) | head -50
```
`pg_dump --schema-only` prints the structure without any rows. The output will not be
byte-identical to `docs/schema.sql` (pg_dump has its own formatting and ordering), so read the
diff for real differences — missing constraints, wrong types, renamed indexes — rather than
expecting it to be empty.

To start the fidelity test from a clean database:

```bash
docker compose exec -T postgres psql -U postgres -d postgres -c "DROP DATABASE cookfeed WITH (FORCE); CREATE DATABASE cookfeed;"
```
Drops and recreates the dev database in one statement. `WITH (FORCE)` disconnects anything still
attached, which is usually a stray `dotnet run`.

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

**The init script did not run / `cookfeed_test` is missing**
Scripts in `docker/init/` only run when the data volume is created. If the volume already
existed, create the database by hand:

```bash
docker compose exec postgres psql -U postgres -c "CREATE DATABASE cookfeed_test;"
```

**`password authentication failed`**
The password is baked into the volume on first creation. If you changed `POSTGRES_PASSWORD`
after the fact, either change it back or run `docker compose down -v` and start over.
