# Cookfeed

[![API tests](https://github.com/jeffgulick/CookFeed/actions/workflows/api-tests.yml/badge.svg)](https://github.com/jeffgulick/CookFeed/actions/workflows/api-tests.yml)
[![App tests](https://github.com/jeffgulick/CookFeed/actions/workflows/app-tests.yml/badge.svg)](https://github.com/jeffgulick/CookFeed/actions/workflows/app-tests.yml)

Cookfeed is a short-video recipe marketplace. Home cooks discover recipes through video, save them, plan
their week, and turn everything they saved and planned into a single shopping list. "2 cups flour" and
"500 g all-purpose flour" become one line. Creators sell recipe collections and meal plans.

| Folder | What it is |
|---|---|
| [`CookFeed_api/`](CookFeed_api/README.md) | The back end: ASP.NET Core 10, EF Core 10 and PostgreSQL 16, laid out as Clean Architecture, with its tests run by GitHub Actions on every pull request that touches it. [Deliverable 2 is mapped item by item here](CookFeed_api/README.md#deliverable-2). |
| [`CookFeed_frontend/app/`](CookFeed_frontend/app/README.md) | The web app: Angular 22 with Tailwind CSS, built against the API and converted page by page from the prototype. Its unit tests and build run in GitHub Actions on every pull request that touches it. |
| [`CookFeed_frontend/prototype/`](CookFeed_frontend/prototype/README.md) | The HTML/JavaScript prototype from Homeworks 1 and 3. It is the specification the Angular app is converted from, and is removed when the last page is done. |

## Run it

You need Docker, the .NET SDK 10.0 (10.0.112 or a later 10.0.1xx patch), Node.js 22.22.3 or later with npm, and a
browser. The commands are for a bash shell. Nothing in the source needs editing.

Terminal 1, the database and the API:

```bash
cd CookFeed_api
cp .env.example .env                   # once: a placeholder password for the local database (git ignores .env)
docker compose up -d --wait            # PostgreSQL 16 on localhost:5432
dotnet tool restore                    # once: installs dotnet-ef
dotnet restore                         # once: downloads the packages; the next command needs them
dotnet ef database update --project src/Cookfeed.Infrastructure --startup-project src/Cookfeed.Api
dotnet run --project src/Cookfeed.Api  # fills the empty database with the seed data, then serves localhost:5032
```

Terminal 2, the web app:

```bash
cd CookFeed_frontend/app
npm ci                                 # once: the exact versions in package-lock.json
npm start                              # serves the app at http://localhost:4200
```

Open `http://localhost:4200`, choose **Sign in** and pick an account: a home cook, a creator or the admin. There are
no passwords. To put the data back to the seed after trying a purchase, with the API running:
`curl -X POST http://localhost:5032/api/dev/reset`.

The details, and how to run the tests, are in each project's README: [the API](CookFeed_api/README.md#getting-started)
and [the web app](CookFeed_frontend/app/README.md).

## Read more

Start with the [design document](CookFeed_api/docs/DesignDocument.md), the
[core queries and their SQL](CookFeed_api/docs/Queries.md), and the
[build log](CookFeed_api/docs/BuildLog.md).
