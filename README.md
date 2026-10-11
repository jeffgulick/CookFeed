# Cookfeed

[![API tests](https://github.com/jeffgulick/CookFeed/actions/workflows/api-tests.yml/badge.svg)](https://github.com/jeffgulick/CookFeed/actions/workflows/api-tests.yml)

Cookfeed is a short-video recipe marketplace. Home cooks discover recipes through video, save them, plan
their week, and turn everything they saved and planned into a single shopping list. "2 cups flour" and
"500 g all-purpose flour" become one line. Creators sell recipe collections and meal plans.

| Folder | What it is |
|---|---|
| [`CookFeed_api/`](CookFeed_api/README.md) | The back end: ASP.NET Core 10, EF Core 10 and PostgreSQL 16, laid out as Clean Architecture, with its tests run by GitHub Actions on every pull request that touches it. [Deliverable 2 is mapped item by item here](CookFeed_api/README.md#deliverable-2). |
| [`CookFeed_frontend/prototype/`](CookFeed_frontend/prototype/README.md) | The HTML/JavaScript prototype from Homeworks 1 and 3. The Angular app replaces it in Assignment 4, built against the API. |

Start with the [design document](CookFeed_api/docs/DesignDocument.md), the
[core queries and their SQL](CookFeed_api/docs/Queries.md), and the
[build log](CookFeed_api/docs/BuildLog.md).
