# Cookfeed — Core Queries, Generated SQL, and Indexes

> **Status: §1 (feed), §2 (storefront) and §4 (order history) are verified: their SQL is what EF Core logged. §3 is still
> expected output, not yet captured output;** they were written alongside the design, before the code
> existed. As each vertical slice is built, the block for that
> query gets replaced with the statement actually logged by
> `Microsoft.EntityFrameworkCore.Database.Command`. Until a section says *verified*, treat its SQL as
> a prediction of the query shape, not a transcript.

Each core query will be one LINQ expression inside a repository in
`src/Cookfeed.Infrastructure/Persistence/Repositories/` (`RecipeRepository` for the feed and recipe
detail, `CreatorRepository`, `ShoppingListRepository`, `OrderRepository`), implementing the matching
interface in `src/Cookfeed.Application/Abstractions/Persistence/`. A controller calls a service, the
service calls the repository, and read methods return `Cookfeed.Contracts` DTOs; `IQueryable` never
leaves the repository (`DesignDocument.md` §1). In the LINQ below, `db` is the repository's
`CookfeedDbContext`. This document shows the LINQ, the SQL EF Core is expected to produce for it, and
the index that makes it cheap (aliases shortened for readability).

`src/Cookfeed.Api/appsettings.Development.json` turns on `Microsoft.EntityFrameworkCore.Database.Command`
logging at `Information`, so the exact statement is printed on every request. As each repository is built,
run `dotnet run --project src/Cookfeed.Api`, hit the endpoint, and paste what it logs over the block here.

To see the planner's choice, prefix any statement with `EXPLAIN (ANALYZE, BUFFERS)` in `psql`.

The shopping-list section below is the one place where the SQL is deliberately only half the algorithm:
the repository aggregates per (ingredient, unit category), and `ShoppingListService` passes the result
to the pure-C# `ShoppingListAggregator` in `Cookfeed.Domain` for the density conversion, preferred-unit
presentation, and unmerged-line policy. See `DesignDocument.md` §7.5. `docs/sql/queries.sql` Q8 does the
whole thing in SQL instead — that is a standalone reference query, not what the API runs, and its output
is what the aggregator will be tested against line for line.

---

## 1. Feed — *verified 2026-10-11*

**Endpoint:** `GET /api/feed?sort=Newest|Trending&page=1&pageSize=20`, optional header `X-User-Id`

**Code:** `FeedController` → `FeedService` → `RecipeRepository.GetFeedAsync`. `1 ≤ page ≤ 42,949,672` (the most whose offset still fits in an int) and
`1 ≤ pageSize ≤ 50` are `[Range]` checks on the controller, so a bad value is a 400 before any SQL runs.
`FeedService` asks for `pageSize + 1` rows and uses the extra one only to set `hasMore`, which avoids the
`SELECT COUNT(*)` that offset pagination normally needs.

```csharp
var recipes = db.Recipes.AsNoTracking()
    .Where(r => r.IsPublished && r.Visibility == RecipeVisibility.Public);   // ProductOnly and drafts never reach the feed

var ordered = sort switch
{
    FeedSort.Newest   => recipes.OrderByDescending(r => r.PublishedAt).ThenByDescending(r => r.Id),
    FeedSort.Trending => recipes.OrderByDescending(r => r.SaveCount)
                                .ThenByDescending(r => r.PublishedAt).ThenByDescending(r => r.Id),
};

return await ordered
    .Skip(skip).Take(take)                    // take = pageSize + 1
    .Select(r => new FeedItemDto(
        r.Id, r.Title, r.VideoUrl, r.ThumbnailUrl, r.Servings,
        r.PrepMinutes == null && r.CookMinutes == null ? null : (r.PrepMinutes ?? 0) + (r.CookMinutes ?? 0),
        r.SaveCount, r.PublishedAt!.Value,
        r.Creator.Handle, r.Creator.User.DisplayName, r.Creator.IsVerified,
        viewerId != null && r.SavedBy.Any(s => s.UserId == viewerId)))
    .ToListAsync(cancellationToken);
```

**Generated SQL, as logged** (`sort=Trending`, with `X-User-Id`):

```sql
SELECT r0.id, r0.title, r0.video_url, r0.thumbnail_url, r0.servings, CASE
    WHEN r0.prep_minutes IS NULL AND r0.cook_minutes IS NULL THEN NULL
    ELSE COALESCE(r0.prep_minutes, 0) + COALESCE(r0.cook_minutes, 0)
END, r0.save_count, r0.published_at, c.handle, u.display_name, c.is_verified, EXISTS (
    SELECT 1
    FROM saved_recipes AS s
    WHERE r0.id = s.recipe_id AND s.user_id = @viewerId)
FROM (
    SELECT r.id, r.cook_minutes, r.creator_id, r.prep_minutes, r.published_at, r.save_count, r.servings, r.thumbnail_url, r.title, r.video_url
    FROM recipes AS r
    WHERE r.is_published AND r.visibility = 'Public'
    ORDER BY r.save_count DESC, r.published_at DESC, r.id DESC
    LIMIT @p1 OFFSET @p
) AS r0
INNER JOIN creator_profiles AS c ON r0.creator_id = c.user_id
INNER JOIN users AS u ON c.user_id = u.id
ORDER BY r0.save_count DESC, r0.published_at DESC, r0.id DESC
```

`sort=Newest` is the same statement with `ORDER BY r.published_at DESC, r.id DESC` in both places. With no
`X-User-Id`, EF Core compiles a separate statement for a null `viewerId` that has no `EXISTS` at all.

**Reviewed.** Three differences from the SQL predicted before the code existed, all improvements:

1. **Page first, then join.** EF Core puts `LIMIT/OFFSET` in a subquery over `recipes` alone, so only the
   page's rows (at most 51) are joined to `creator_profiles` and `users`. The prediction had a flat join
   with `LIMIT` at the end. The outer `ORDER BY` re-sorts at most 51 rows.
2. **Only the columns the card needs.** The `Select` into `FeedItemDto` means no `description`, no
   `created_at` and no entity tracking (`AsNoTracking`).
3. **No `EXISTS` for an anonymous viewer.** `viewerId != null && …` is folded away when the parameter is
   null, instead of being sent as `@viewerId IS NOT NULL AND EXISTS (…)`.

**Plan** (`EXPLAIN ANALYZE` on the seeded development database; `Newest`, inner page query):

```
Limit (actual rows=10 loops=1)
  ->  Incremental Sort (actual rows=10 loops=1)
        Sort Key: published_at DESC, id DESC
        Presorted Key: published_at
        ->  Index Scan using ix_recipes_is_published_visibility_published_at on recipes r (actual rows=10 loops=1)
              Index Cond: ((is_published = true) AND ((visibility)::text = 'Public'::text))
```

and for the full statement, joins and viewer check:

```
Nested Loop
  ->  Nested Loop
        ->  Limit -> Incremental Sort -> Index Scan using ix_recipes_is_published_visibility_published_at
        ->  Memoize (Cache Key: r.creator_id) -> Index Scan using pk_creator_profiles  (Index Cond: user_id = r.creator_id)
  ->  Index Scan using pk_users  (Index Cond: id = c.user_id)
  SubPlan 2
    ->  Bitmap Heap Scan on saved_recipes s  ->  Bitmap Index Scan on pk_saved_recipes  (Index Cond: user_id = 1)
```

**Indexes, and why:**

- `ix_recipes_is_published_visibility_published_at (is_published, visibility, published_at DESC)` serves
  `Newest`. Both leading columns are equality predicates, so the index returns the matching rows already
  in `published_at DESC` order. PostgreSQL chose it even on 13 seeded rows, with default planner
  settings.
- **Sort cost.** The plan has no full Sort, only an *Incremental Sort*, whose `Presorted Key` is
  `published_at`. It sorts by `id` only within a group of equal `published_at`, and `Limit` stops it
  after one page. The `id` tie-break is there so pages never overlap or skip a row when two recipes
  publish at the same instant.
- **Not added: `id` in the index.** Adding `id DESC` to the index would remove even the incremental sort.
  But the ties it handles are rare, and the change would need a new migration plus a matching
  `schema.sql` change. Not worth it.
- `ix_recipes_is_published_visibility_save_count (is_published, visibility, save_count DESC)` serves
  `Trending` the same way. Presorted key `save_count`; ties on save count are common, and the incremental
  sort orders those by `published_at, id`.
- **Joins.** The creator and user joins are primary-key lookups. `Memoize` caches the creator because a
  page has few distinct creators (3 misses, 7 hits here).
- **The viewer's saves.** `SavedByViewer` uses the composite primary key `saved_recipes(user_id,
  recipe_id)`. With `user_id` leading, PostgreSQL reads the viewer's saves once (`SubPlan`, `loops=1`)
  instead of probing once per card.
- **At scale.** Keyset pagination (`WHERE (published_at, id) < (@last_published_at, @last_id)`) would
  replace `OFFSET`, so deep pages do not read and discard the rows before them. The same index serves it.

**Tests:**

- `tests/Cookfeed.Application.Tests/Feed/FeedServiceTests.cs`: the `pageSize + 1` / `hasMore` rule, with a
  fake repository.
- `tests/Cookfeed.IntegrationTests/Api/FeedEndpointTests.cs`, over HTTP:
  - `Newest` matches `queries.sql` Q1 id for id; `Trending` matches Q3.
  - ProductOnly recipes and drafts are absent.
  - Pages join up with no gaps or repeats.
  - `savedByViewer` matches the viewer's `saved_recipes` rows.
  - Out-of-range paging (including a page whose offset would overflow), an unknown sort or a non-numeric
    `X-User-Id` gets a 400.

---

## 1b. Recipe detail

**Endpoint:** `GET /api/recipes/{id}`

```csharp
db.Recipes.AsNoTracking()
  .Where(r => r.Id == recipeId && r.IsPublished
           && (r.Visibility == RecipeVisibility.Public
               || r.OrderItemRecipes.Any(oir => oir.OrderItem.Order.UserId == viewerId
                                              && oir.OrderItem.Order.Status == OrderStatus.Paid)))
  .Select(r => new RecipeDetailDto(..., 
      r.Ingredients.OrderBy(i => i.SortOrder).Select(i => new RecipeIngredientDto(...)).ToList(),
      r.Steps.OrderBy(s => s.StepNumber).Select(s => new RecipeStepDto(...)).ToList()))
  .SingleOrDefaultAsync()
```

EF Core translates the two nested collections into one statement with `LEFT JOIN`s and an `ORDER BY` that lets it split the row set back into parent/children:

```sql
SELECT r.id, r.title, ..., c.handle, u.display_name, r.save_count,
       ri.ingredient_id, i.name, ri.quantity, un.abbreviation, ri.display_text, ri.preparation, ri.is_optional, ri.sort_order,
       st.step_number, st.instruction, st.video_timestamp_seconds
FROM recipes r
JOIN creator_profiles c ON r.creator_id = c.user_id
JOIN users u ON c.user_id = u.id
LEFT JOIN (recipe_ingredients ri JOIN ingredients i ON ... JOIN units un ON ...) ON ri.recipe_id = r.id
LEFT JOIN recipe_steps st ON st.recipe_id = r.id
WHERE r.id = @id AND r.is_published
  AND (r.visibility = 'Public' OR EXISTS (
        SELECT 1 FROM order_item_recipes oir
        JOIN order_items oi ON oir.order_item_id = oi.id
        JOIN orders o ON oi.order_id = o.id
        WHERE oir.recipe_id = r.id AND o.user_id = @viewerId AND o.status = 'Paid'))
ORDER BY r.id, ri.sort_order, ri.id, st.step_number
```

**Indexes:** PK `recipes(id)`; `ix_recipe_ingredients_recipe_id_sort_order (recipe_id, sort_order)` returns the ingredient rows already in display order; unique `ix_recipe_steps_recipe_id_step_number (recipe_id, step_number)` does the same for steps. The access `EXISTS` (DesignDocument.md §3.3, `queries.sql` Q14) probes `ix_order_item_recipes_recipe_id` then the PKs of `order_items` and `orders`; it is evaluated only for `ProductOnly` recipes because the `OR` short-circuits on the `visibility` column already in hand.

---

## 2. Creator storefront — *verified 2026-10-11*

**Endpoint:** `GET /api/creators/{handle}`, optional header `X-User-Id`. An unknown handle is 404.

**Code:** `CreatorsController` → `StorefrontService` → `CreatorRepository.GetStorefrontAsync`. The service
lower-cases the handle, so `/api/creators/Maria-Cooks` works. It lower-cases the *argument*, not the
column, so the lookup still uses the unique index.

```csharp
db.CreatorProfiles.AsNoTracking()
    .AsSplitQuery()
    .Where(c => c.Handle == handle)
    .Select(c => new
    {
        c.Handle, c.User.DisplayName, c.Bio, c.AvatarUrl, c.IsVerified,
        ViewerIsCreator = viewerId != null && c.UserId == viewerId,
        Recipes = c.Recipes
            .Where(r => r.IsPublished && r.Visibility == RecipeVisibility.Public)
            .OrderByDescending(r => r.PublishedAt).ThenByDescending(r => r.Id)
            .Select(r => new StorefrontRecipeDto(r.Id, r.Title, r.ThumbnailUrl, /* total minutes */, r.SaveCount, r.PublishedAt!.Value))
            .ToList(),
        Products = c.Products
            .Where(p => p.IsActive)
            .OrderBy(p => p.CreatedAt).ThenBy(p => p.Id)
            .Select(p => new StorefrontProductDto(
                p.Id, /* type */, p.Title, p.Description, p.CoverImageUrl, p.PriceCents, p.Currency,
                p.Recipes.Select(pr => pr.RecipeId).Distinct().Count(),                    // distinct recipes
                p.Type == ProductType.MealPlan ? p.Recipes.Count() : null,                  // meals; a plan may repeat a recipe
                viewerId != null && db.OrderItems.Any(oi =>
                    oi.ProductId == p.Id && oi.Order.UserId == viewerId && oi.Order.Status == OrderStatus.Paid)))
            .ToList(),
    })
    .SingleOrDefaultAsync(cancellationToken);
```

`RecipeCount` and `TotalSaves` are then worked out in C# from the recipe list already fetched
(`Recipes.Count`, `Recipes.Sum(r => r.SaveCount)`).

**Generated SQL, as logged** (`dan-meal-preps` with `X-User-Id: 1`). There are three statements, one per
part of the page:

```sql
-- 1. the creator
SELECT c.handle, u.display_name, c.bio, c.avatar_url, c.is_verified, c.user_id = @viewerId, c.user_id, u.id
FROM creator_profiles AS c
INNER JOIN users AS u ON c.user_id = u.id
WHERE c.handle = @handle
ORDER BY c.user_id, u.id
LIMIT 2

-- 2. the public recipes
SELECT r2.id, r2.title, r2.thumbnail_url, r2.c, r2.save_count, r2.published_at, s.user_id, s.id
FROM (
    SELECT c.user_id, u.id
    FROM creator_profiles AS c
    INNER JOIN users AS u ON c.user_id = u.id
    WHERE c.handle = @handle
    ORDER BY c.user_id, u.id
    LIMIT 1
) AS s
INNER JOIN (
    SELECT r1.id, r1.title, r1.thumbnail_url, CASE
        WHEN r1.prep_minutes IS NULL AND r1.cook_minutes IS NULL THEN NULL
        ELSE COALESCE(r1.prep_minutes, 0) + COALESCE(r1.cook_minutes, 0)
    END AS c, r1.save_count, r1.published_at, r1.creator_id
    FROM recipes AS r1
    WHERE r1.is_published AND r1.visibility = 'Public'
) AS r2 ON s.user_id = r2.creator_id
ORDER BY s.user_id, s.id, r2.published_at DESC, r2.id DESC

-- 3. the active products
SELECT p7.id, p7.c, p7.title, p7.description, p7.cover_image_url, p7.price_cents, p7.currency, p7.c0, p7.c1, p7.c2, s0.user_id, s0.id
FROM (
    SELECT c.user_id, u.id
    FROM creator_profiles AS c
    INNER JOIN users AS u ON c.user_id = u.id
    WHERE c.handle = @handle
    ORDER BY c.user_id, u.id
    LIMIT 1
) AS s0
INNER JOIN (
    SELECT p3.id, CASE
        WHEN p3.type = 'MealPlan' THEN 1
        ELSE 0
    END AS c, p3.title, p3.description, p3.cover_image_url, p3.price_cents, p3.currency, (
        SELECT count(*)::int
        FROM (
            SELECT DISTINCT p4.recipe_id
            FROM product_recipes AS p4
            WHERE p3.id = p4.product_id
        ) AS p5) AS c0, CASE
        WHEN p3.type = 'MealPlan' THEN (
            SELECT count(*)::int
            FROM product_recipes AS p6
            WHERE p3.id = p6.product_id)
    END AS c1, EXISTS (
        SELECT 1
        FROM order_items AS o1
        INNER JOIN orders AS o2 ON o1.order_id = o2.id
        WHERE o1.product_id = p3.id AND o2.user_id = @viewerId AND o2.status = 'Paid') AS c2, p3.created_at, p3.creator_id
    FROM products AS p3
    WHERE p3.is_active
) AS p7 ON s0.user_id = p7.creator_id
ORDER BY s0.user_id, s0.id, p7.created_at, p7.id
```

**Reviewed.** Two changes from the design-time version, both made after reading the SQL:

1. **Split query.** Without `AsSplitQuery()`, EF Core sent one statement that `LEFT JOIN`ed the recipe
   subquery *and* the product subquery to the creator. The two lists are independent, so every recipe
   came back once per product: 5 × 1 rows for Dan, 3 × 2 for Maria. A creator with 200 recipes and 10
   products would send 2,000 wide rows to show 210 items. EF Core warns about exactly this
   (`MultipleCollectionIncludeWarning`, logged on the first run). Split, the three statements return
   1 + recipes + products rows. The cost is two extra round trips, each re-finding the creator with one
   probe of the unique `handle` index.
2. **No aggregate subqueries for the header.** The design had two extra subqueries over `recipes`, for the
   count and the sum of saves. Since the page already fetches every public recipe of the creator, the
   repository counts and sums that list in C#. That is two fewer scans of the same rows.

Retired products (`is_active = false`) are left out; they stay in the table only because orders refer to
them. "Owned" means a **Paid** order for the product, so Alex's *Cancelled* order for *The Bread Box* does
not count; `StorefrontEndpointTests` checks that case. The `MealPlan` → `ProductType` mapping compiles to
a `CASE` on the stored name, and the JSON sends it as `"MealPlan"`, not a number.

**Plans** (`EXPLAIN ANALYZE`, `enable_seqscan = off` because the seeded tables fit in one page, so a
sequential scan wins on cost at this size):

```
-- 1. creator
Limit -> Sort -> Nested Loop
  ->  Index Scan using ix_creator_profiles_handle on creator_profiles c   (Index Cond: handle = 'dan-meal-preps')
  ->  Index Scan using pk_users on users u                                 (Index Cond: id = c.user_id)

-- 2. recipes
Incremental Sort (Presorted Key: c.user_id)
  ->  Nested Loop
        ->  Limit -> … Index Scan using ix_creator_profiles_handle …
        ->  Bitmap Heap Scan on recipes r1 (actual rows=5)
              Filter: (is_published AND visibility = 'Public')
              ->  Bitmap Index Scan on ix_recipes_creator_id (actual rows=5)   (Index Cond: creator_id = c.user_id)

-- 3. products
Incremental Sort (Presorted Key: c.user_id)
  ->  Nested Loop
        ->  Limit -> … Index Scan using ix_creator_profiles_handle …
        ->  Index Scan using ix_products_creator_id_is_active on products p3   (Index Cond: creator_id = c.user_id AND is_active)
        SubPlan 1  (distinct recipes)  ->  Bitmap Index Scan on ix_product_recipes_product_id_sort_order
        SubPlan 2  (meals)             ->  Bitmap Index Scan on ix_product_recipes_product_id_sort_order
        SubPlan 3  (owned)             ->  Index Scan using ix_order_items_product_id on order_items o1
                                           ->  Index Scan using ix_orders_user_id_placed_at on orders o2
                                                 (Index Cond: user_id = 1; Filter: status = 'Paid')
```

**Indexes, and why:**

- **Unique `ix_creator_profiles_handle`.** The URL lookup is one index probe, and each of the three
  statements starts with it.
- **`ix_recipes_creator_id`.** Serves the recipe list. `is_published` and `visibility` are checked as a
  filter on the creator's rows. That is a few dozen rows even for a prolific creator, so a composite
  `(creator_id, is_published, visibility, published_at DESC)` index is not worth its write cost here.
- **`ix_products_creator_id_is_active (creator_id, is_active)`.** Both predicates are in the index
  condition, so retired products are never read.
- **`ix_product_recipes_product_id_sort_order`.** Serves both counts through its leading `product_id`.
  The same index returns a bundle in display order on the product page.
- **The ownership `EXISTS`.** Uses `ix_order_items_product_id`, then `ix_orders_user_id_placed_at` for
  the viewer's orders; `status` is a filter over that one user's handful of orders.

**Seen while reviewing the plan: the cost of the `save_count` denormalization.** On the freshly seeded
database, the recipes scan first read 21 index entries to return Dan's 5 rows. `pg_stat_user_tables`
showed 38 updates to `recipes`, **0 of them HOT**, and 38 dead row versions. Each save fires the
`saved_recipes_save_count` trigger (DesignDocument.md §3.4), which updates the recipe row. Because
`save_count` is a column of `ix_recipes_is_published_visibility_save_count`, PostgreSQL cannot update the
row in place; it writes a new row version and a new entry in *every* index on `recipes`. After `VACUUM`,
the same scan read exactly 5 entries. Autovacuum does this on its own in production. The point stands,
though: a save costs more than one small insert, and that is the price of reading `save_count` without a
`COUNT(*)` on the feed (DesignDocument.md §6).

**Tests:**

- `tests/Cookfeed.Application.Tests/Storefront/StorefrontServiceTests.cs`: lower-casing the handle,
  passing the viewer through, and null for an unknown handle.
- `tests/Cookfeed.IntegrationTests/Api/StorefrontEndpointTests.cs`, over HTTP, for all three seeded
  creators:
  - The recipe list has only published Public recipes, newest first.
  - `recipeCount` and `totalSaves` match `queries.sql` **Q2**; the product lines match **Q5**, with
    distinct recipes and meals, and the retired product absent.
  - Ownership matches Paid orders, and a cancelled order does not count.
  - `viewerIsCreator` is true only for the creator.
  - An unknown handle is 404, and a non-numeric `X-User-Id` is 400.

---

## 3. Shopping list

**Endpoint:** `GET /api/users/{id}/shopping-list?weekStart=2026-09-21`

This is two SQL statements (aggregation, then a distinct recipe count over the same source set) plus a units lookup, followed by in-memory reconciliation described in the design document §7.5.

### Step A — which recipes, at what scale

```csharp
var planned = db.MealPlanEntries
  .Where(e => e.MealPlan.UserId == userId && (weekStart == null || e.MealPlan.WeekStart == weekStart))
  .Select(e => new { e.RecipeId, Scale = (decimal)(e.ServingsOverride ?? e.Recipe.Servings) / e.Recipe.Servings });

var savedNotPlanned = db.SavedRecipes
  .Where(s => s.UserId == userId && !planned.Any(p => p.RecipeId == s.RecipeId))
  .Select(s => new { s.RecipeId, Scale = 1m });

var sources = planned.Concat(savedNotPlanned);   // UNION ALL
```

### Step B — normalise and aggregate

```csharp
sources
  .Join(db.RecipeIngredients, src => src.RecipeId, ri => ri.RecipeId, (src, ri) => new { src.Scale, ri })
  .Where(x => !x.ri.IsOptional)
  .GroupBy(x => new { x.ri.IngredientId, x.ri.Ingredient.Name, x.ri.Ingredient.Category,
                      x.ri.Ingredient.DensityGPerMl, x.ri.Ingredient.PreferredShoppingUnitId,
                      UnitCategory = x.ri.Unit.Category })
  .Select(g => new {
      g.Key.IngredientId, g.Key.Name, ..., g.Key.UnitCategory,
      BaseQuantity = g.Sum(x => x.ri.Quantity * x.Scale * x.ri.Unit.ToBaseFactor) })
```

**Generated SQL:**

```sql
SELECT i.id AS ingredient_id, i.name, i.category, i.density_g_per_ml, i.preferred_shopping_unit_id,
       un.category AS unit_category,
       COALESCE(SUM(ri.quantity * src.scale * un.to_base_factor), 0.0) AS base_quantity
FROM (
    -- planned entries, scaled
    SELECT e.recipe_id,
           CAST(COALESCE(e.servings_override, r.servings) AS numeric) / r.servings AS scale
    FROM meal_plan_entries e
    JOIN meal_plans mp ON e.meal_plan_id = mp.id
    JOIN recipes r ON e.recipe_id = r.id
    WHERE mp.user_id = @userId AND (@weekStart IS NULL OR mp.week_start = @weekStart)
    UNION ALL
    -- saved recipes not already planned
    SELECT s.recipe_id, 1.0 AS scale
    FROM saved_recipes s
    WHERE s.user_id = @userId
      AND NOT EXISTS (
          SELECT 1 FROM meal_plan_entries e2
          JOIN meal_plans mp2 ON e2.meal_plan_id = mp2.id
          WHERE mp2.user_id = @userId AND (@weekStart IS NULL OR mp2.week_start = @weekStart)
            AND e2.recipe_id = s.recipe_id)
) AS src
JOIN recipe_ingredients ri ON src.recipe_id = ri.recipe_id
JOIN ingredients i ON ri.ingredient_id = i.id
JOIN units un ON ri.unit_id = un.id
WHERE NOT ri.is_optional
GROUP BY i.id, i.name, i.category, i.density_g_per_ml, i.preferred_shopping_unit_id, un.category
```

One `UNION ALL` to build the recipe set with a per-row scale, one join to the ingredient lines, one `GROUP BY` with `SUM` of the normalised quantity. The rows going into the `GROUP BY` number (recipes × ingredients per recipe), typically well under a thousand for one user.

A second, flat query over the same `src` set returns `DISTINCT (ingredient_id, recipe title)` pairs so the UI can label each line with the recipes it came from. Keeping it separate rather than projecting a collection inside the `GROUP BY` keeps the aggregate statement a plain grouped `SELECT` that `EXPLAIN` reads cleanly.

**Indexes and why:**

| Index | Serves |
|---|---|
| unique `ix_meal_plans_user_id_week_start (user_id, week_start)` | `WHERE mp.user_id = ? AND mp.week_start = ?` — one probe |
| `ix_meal_plan_entries_meal_plan_id_planned_date_slot` | entries for a plan (leading column), also the calendar page |
| PK `saved_recipes (user_id, recipe_id)` | `WHERE s.user_id = ?` range scan on leading column; `NOT EXISTS` lookup |
| `ix_recipe_ingredients_recipe_id_sort_order` | the `JOIN recipe_ingredients ON recipe_id` for each source recipe |
| PKs on `ingredients`, `units`, `recipes` | the remaining joins |

**Reviewed:** the planned-entries subquery appears twice in the generated SQL (once in the `UNION ALL` branch, once inside `NOT EXISTS`) because EF cannot hoist a CTE from a LINQ subquery. For a single user's data this is negligible; if it showed in `EXPLAIN` as a hot spot the fix is a raw-SQL `WITH planned AS (...)` via `FromSql`, keeping the same indexes.

### Step C — application

Covered in `DesignDocument.md` §7.3–7.5. Volume↔Mass via density *toward the preferred unit's category*, fall back to the base unit when the line still cannot be expressed in the preferred unit, rounding, aisle sort. The direction rule is the fix for the dropped-liquids defect the Assignment 2 review found in Q8 (§3.6). The `Units` table (14 rows) is loaded once per call with `ToDictionaryAsync`.

---

## 4. Order history — *verified 2026-10-11*

**Endpoint:** `GET /api/me/orders`, **required** header `X-User-Id`.

**Code:** `MyOrdersController` → `OrderHistoryService` → `OrderRepository.GetOrderHistoryAsync`.

- **The caller.** The user id comes from the caller, never from the route: `/api/me/…` routes take no
  user id, so no request can name someone else's orders. Until login exists (Assignment 4), the caller
  is the `X-User-Id` header.
- **Validation.** The header is `[BindRequired]` with `[Range(1, int.MaxValue)]`, so a missing,
  non-numeric or zero value is a 400 before any SQL runs.
- **An id that names no user** gets an empty list, which reveals nothing (DesignDocument.md §9).

```csharp
db.Orders.AsNoTracking()
    .Where(o => o.UserId == userId)
    .OrderByDescending(o => o.PlacedAt).ThenByDescending(o => o.Id)
    .Select(o => new OrderDto(
        o.Id, ToContract(o.Status), o.PlacedAt, o.PaidAt, o.TotalCents, o.Currency,
        o.Items
            .OrderBy(i => i.Id)
            .Select(i => new OrderItemDto(
                i.ProductId, i.ProductTitle, i.UnitPriceCents,                                   // the checkout snapshot
                db.CreatorProfiles.Where(c => c.UserId == i.CreatorId).Select(c => c.Handle).FirstOrDefault()))
            .ToList()))
    .ToListAsync(cancellationToken);
```

**Generated SQL, as logged:**

```sql
SELECT o.id, o.status, o.placed_at, o.paid_at, o.total_cents, o.currency, o0.product_id, o0.product_title, o0.unit_price_cents, (
    SELECT c.handle
    FROM creator_profiles AS c
    WHERE c.user_id = o0.creator_id
    LIMIT 1), o0.id
FROM orders AS o
LEFT JOIN order_items AS o0 ON o.id = o0.order_id
WHERE o.user_id = @userId
ORDER BY o.placed_at DESC, o.id DESC, o0.id
```

**Reviewed:**

1. **One statement, and that is right here.** Orders → items is a *single* collection, so the
   `LEFT JOIN` returns one row per item (plus one per order with no items), with no multiplication. Contrast
   §2, where two *sibling* collections multiplied each other's rows and `AsSplitQuery()` was needed.
   Splitting here would only add a round trip.
2. **The seller follows the snapshot.** The design-time version joined `order_items → products →
   creator_profiles` for the seller's handle; that reads today's owner of the product. The code follows
   Q9 instead and looks up `order_items.creator_id`, the seller *at checkout*. That column deliberately
   has no foreign key (DesignDocument.md §6), so EF Core has no navigation for it; the correlated subquery
   is a primary-key probe. `SellerHandle` is nullable for the case where that creator no longer has a
   storefront.
3. **Title and price never touch `products`.** They come from `order_items.product_title` and
   `unit_price_cents`. `OrderHistoryEndpointTests` proves it: on a database of its own, it renames and
   reprices the Roman Pasta Collection, and Alex's history still shows the original title at 799.
4. **Status is mapped in C#.** `ToContract` is a static method EF Core cannot translate, so it runs on the
   fetched `status` value in the final projection. That is the only kind of client evaluation EF Core
   allows, and it costs nothing here.

**Plan** (`EXPLAIN ANALYZE`, `enable_seqscan = off`, Alex = user 1):

```
Incremental Sort (actual rows=4 loops=1)
  Sort Key: o.placed_at DESC, o.id DESC, o0.id
  Presorted Key: o.placed_at
  ->  Nested Loop Left Join (actual rows=4 loops=1)
        ->  Index Scan using ix_orders_user_id_placed_at on orders o (actual rows=3 loops=1)
              Index Cond: (user_id = 1)
        ->  Index Scan using ix_order_items_order_id_product_id on order_items o0 (actual rows=1 loops=3)
              Index Cond: (order_id = o.id)
        SubPlan 1
          ->  Limit -> Index Scan using pk_creator_profiles on creator_profiles c (actual rows=1 loops=4)
                Index Cond: (user_id = o0.creator_id)
```

**Indexes, and why:**

- `ix_orders_user_id_placed_at (user_id, placed_at DESC)`: the filter and the sort are the same index,
  read in order. The incremental sort only orders ties on `placed_at` by `id` and then the items. Every
  other user's orders are never read.
- Unique `ix_order_items_order_id_product_id (order_id, product_id)`: serves the join on `order_id`
  through its leading column. Its uniqueness is also the rule "a product appears once per order".
- `pk_creator_profiles`: one probe per item for the seller's handle.
- **No paging yet.** A user's history is small. If it grows, keyset paging on
  `(placed_at, id) < (@last_placed_at, @last_id)` uses the same index without `OFFSET`.

**Tests:**

- `tests/Cookfeed.Application.Tests/Orders/OrderHistoryServiceTests.cs`
- `tests/Cookfeed.IntegrationTests/Api/OrderHistoryEndpointTests.cs`, over HTTP:
  - Alex's lines equal `queries.sql` **Q9**.
  - Users 1, 2 and 5 each see exactly their own orders, newest first.
  - No orders (user 7) and no such user (999) both give an empty list.
  - Every `totalCents` equals the sum of its items (the check DesignDocument.md §6 promised).
  - The snapshot survives a rename and reprice.
  - Status is sent as a name.
  - A missing, non-numeric or zero `X-User-Id` is a 400.

---

## Write paths worth noting

Not "queries" in the assignment's sense, but the two writes that keep the denormalized columns correct:

**Save a recipe** (`POST /api/users/{u}/saves/{r}`): requires the `HomeCook` role and, for a `ProductOnly` recipe, the same access check as the detail endpoint. The service does one thing: add a `saved_recipes` row (`INSERT INTO saved_recipes`). The `saved_recipes_save_count` trigger runs

```sql
UPDATE recipes SET save_count = save_count + 1 WHERE id = @r
```

inside the same statement — a single atomic increment, so two users saving simultaneously cannot both read 41 and write 42, and the application never touches the counter. Unsave is the mirror `DELETE`; the trigger decrements. A cascaded delete from a hard-deleted account is decremented the same way (DesignDocument.md §3.4). `queries.sql` Q16 is the consistency check the integration tests will run after each of these.

**Add to cart** (`POST /api/users/{u}/cart/{p}`): requires `HomeCook`; `CartService` refuses it if `product.CreatorId == u` ("you cannot buy your own product") and the controller returns `400`, and the `cart_items_refuse_self_purchase` trigger refuses the row if anything else tries.

**Checkout** (`POST /api/users/{u}/checkout`): requires `HomeCook`. `CheckoutService` reads the cart's products and builds the order; `OrderRepository` saves it with a single `SaveChanges`. That inserts an `orders` row with `total_cents = SUM(price_cents)`, one `order_items` row per product carrying `product_title`, `unit_price_cents`, and `creator_id` snapshots, and one `order_item_recipes` row per `product_recipes` row of each product (`recipe_id`, `sort_order`, `day_offset`, `slot` copied as they are that moment), then `DELETE FROM cart_items WHERE user_id = @u` — all in the one transaction EF Core opens for that `SaveChanges`, so a failure anywhere leaves the cart intact and no partial order. The `order_items_refuse_self_purchase` trigger is the last line of defense against a self-purchase reaching an order.
