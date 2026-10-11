# Cookfeed — Core Queries, Generated SQL, and Indexes

> **Status: all four sections are verified.** Each SQL block is the statement EF Core logged when the
> endpoint ran (2026-10-11), not a prediction. Each section also says where that statement differs from the
> design-time version and why it was changed.

Each core query is one LINQ query inside a repository in
`src/Cookfeed.Infrastructure/Persistence/Repositories/`:

| Section | Repository |
|---|---|
| §1 feed | `RecipeRepository` |
| §2 storefront | `CreatorRepository` |
| §3 shopping list | `ShoppingListRepository` |
| §4 order history | `OrderRepository` |

Each implements the matching interface in `src/Cookfeed.Application/Abstractions/Persistence/`. A
controller calls a service, the service calls the repository, and read methods return `Cookfeed.Contracts`
DTOs; `IQueryable` never leaves the repository (`DesignDocument.md` §1). In the LINQ below, `db` is the
repository's `CookfeedDbContext`. Every section shows the LINQ, the SQL EF Core produced for it, the
query plan, and the indexes that make it cheap.

**How the SQL was captured.** `src/Cookfeed.Api/appsettings.Development.json` turns on
`Microsoft.EntityFrameworkCore.Database.Command` logging at `Information`, so the exact statement is
printed on every request: run `dotnet run --project src/Cookfeed.Api`, call the endpoint, and read the log.
Plans come from `EXPLAIN (ANALYZE, COSTS OFF, TIMING OFF)` in `psql` on the seeded development database.
The seeded tables are a page or two each, so a sequential scan wins on cost; plans are shown with
`enable_seqscan = off` to reveal the index the planner uses once tables are large.

**Only part of the algorithm runs in SQL for the shopping list (§3).** The repository sums per
(ingredient, unit category), and `ShoppingListService` passes the result to the pure-C#
`ShoppingListAggregator` in `Cookfeed.Domain`, which does the density conversion, picks the preferred
unit, and applies the unmerged-line policy (`DesignDocument.md` §7.5). `docs/sql/queries.sql` Q8 does the
whole thing in SQL instead. That is a standalone reference query, not what the API runs, and the API's
output is tested against it line for line.

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

## 3. Shopping list — *verified 2026-10-11*

**Endpoint:** `GET /api/me/shopping-list?weekStart=2026-09-21`
- The required `X-User-Id` header is the caller, as on `/api/me/orders`.
- `weekStart` is optional: without it every plan counts, which is what `queries.sql` Q8 computes.
- Saved recipes always count.

**Code:** `MyShoppingListController` → `ShoppingListService` → `ShoppingListRepository.GetIngredientTotalsAsync`
(the SQL half), then `ShoppingListAggregator.Aggregate` in `Cookfeed.Domain` (the C# half). The split is
the one DesignDocument.md §7.5 lays out:

| Half | What it does |
|---|---|
| **SQL** | Chooses the recipes, scales them, and sums every ingredient line per (ingredient, unit category) in the category's base unit. |
| **C#** | Converts Volume ↔ Mass through density, toward the preferred unit's category; merges what now shares a category; presents in the preferred unit or falls back to the base unit; rounds; sorts; and moves ingredients that still need two lines into `unmerged`. |

```csharp
var entries =
    from e in db.MealPlanEntries
    join mp in db.MealPlans on e.MealPlanId equals mp.Id
    where mp.UserId == userId && (weekStart == null || mp.WeekStart == weekStart)
    select e;

var planned =                                  // scaled by the servings override; two nights = two rows
    from e in entries
    join r in db.Recipes on e.RecipeId equals r.Id
    select new RecipeAtScale { RecipeId = e.RecipeId, Scale = (decimal)(e.ServingsOverride ?? r.Servings) / r.Servings };
var savedNotPlanned =                          // saved and also planned -> counts once, at the planned scale
    from s in db.SavedRecipes
    where s.UserId == userId && !entries.Any(e => e.RecipeId == s.RecipeId)
    select new RecipeAtScale { RecipeId = s.RecipeId, Scale = 1m };

from source in planned.Concat(savedNotPlanned)                     // UNION ALL
join ri in db.RecipeIngredients on source.RecipeId equals ri.RecipeId
join unit in db.Units on ri.UnitId equals unit.Id
join i in db.Ingredients on ri.IngredientId equals i.Id
join preferred in db.Units on i.PreferredShoppingUnitId equals preferred.Id into preferredUnits
from preferred in preferredUnits.DefaultIfEmpty()                  // LEFT JOIN: not every ingredient has one
where !ri.IsOptional
group new { ri.Quantity, source.Scale, unit.ToBaseFactor }
    by new { i.Id, i.Name, i.Category, i.DensityGPerMl,
             preferred.Category, preferred.ToBaseFactor, preferred.Abbreviation, unit.Category } into g
select new IngredientTotal(..., g.Sum(x => Math.Round(x.Quantity * x.Scale * x.ToBaseFactor, 6)))
```

**Generated SQL, as logged** (`weekStart=2026-09-21`):

```sql
SELECT i.id, i.name, i.category, i.density_g_per_ml, u1.category, u1.to_base_factor, u1.abbreviation, u0.category, COALESCE(sum(round(r0.quantity * u."Scale" * u0.to_base_factor, 6)), 0.0)
FROM (
    SELECT m.recipe_id AS "RecipeId", COALESCE(m.servings_override, r.servings)::numeric / r.servings::numeric AS "Scale"
    FROM meal_plan_entries AS m
    INNER JOIN meal_plans AS m0 ON m.meal_plan_id = m0.id
    INNER JOIN recipes AS r ON m.recipe_id = r.id
    WHERE m0.user_id = @userId AND m0.week_start = @weekStart
    UNION ALL
    SELECT s.recipe_id AS "RecipeId", 1.0 AS "Scale"
    FROM saved_recipes AS s
    WHERE s.user_id = @userId AND NOT EXISTS (
        SELECT 1
        FROM meal_plan_entries AS m1
        INNER JOIN meal_plans AS m2 ON m1.meal_plan_id = m2.id
        WHERE m2.user_id = @userId AND m2.week_start = @weekStart AND m1.recipe_id = s.recipe_id)
) AS u
INNER JOIN recipe_ingredients AS r0 ON u."RecipeId" = r0.recipe_id
INNER JOIN units AS u0 ON r0.unit_id = u0.id
INNER JOIN ingredients AS i ON r0.ingredient_id = i.id
LEFT JOIN units AS u1 ON i.preferred_shopping_unit_id = u1.id
WHERE NOT (r0.is_optional)
GROUP BY i.id, i.name, i.category, i.density_g_per_ml, u1.category, u1.to_base_factor, u1.abbreviation, u0.category
```

With no `weekStart`, EF Core compiles the same statement without either `week_start` condition.

**Reviewed: the first version was correct and slow, and the logged SQL is what showed it.**

1. **Navigations inside a grouped query become correlated subqueries.** The first LINQ grouped
   `recipe_ingredients` rows and summed `x.Line.Quantity * x.Scale * x.Line.Unit.ToBaseFactor`, reaching
   the unit through its navigation. EF Core could not turn that into a `SUM` over the grouped rows. Each
   `SUM` became a correlated subquery that rebuilt the whole recipe set: the `UNION ALL`, every join, and
   a null-safe comparison of all eight key columns. That ran once per output line, 41 extra passes for
   Alex. The tests passed, because the numbers were right.
   - **How it was found.** Small probe queries pinned the cause down: the same query with explicit
     `join`s gives a plain `GROUP BY … SUM(...)`, both over one table and over the `UNION ALL`.
   - **Rule taken from it.** In a grouped aggregate, join explicitly. Navigations are fine in `Where` and
     `Select`, as in §1, §2 and §4.
2. **Rounding goes inside the `SUM`.** `COALESCE(m.servings_override, r.servings)::numeric / r.servings`
   is exact in PostgreSQL and carries 16 or more decimal places. Multiplied by a quantity (3 places) and a
   unit factor (6), the sum overflowed .NET's 28-digit `decimal` the first time a scaled plan was included
   (`OverflowException`). Each line is therefore rounded to 6 places, a millionth of a gram or millilitre,
   before it is summed. Wrapping the round *around* the `SUM` instead brought back the correlated
   subquery from point 1.
3. **One statement, as designed.** One `UNION ALL` builds the recipe set with a per-row scale, followed
   by the joins and one `GROUP BY`. The rows going into the aggregate number recipes × ingredient lines:
   60 for Alex, well under a thousand for any one user.
4. **The planned set appears twice**, once in the `UNION ALL` and once inside `NOT EXISTS`, as predicted
   at design time: EF Core does not write a CTE. Each copy is an index probe on `meal_plans(user_id,
   week_start)`, then the plan's entries. `entries` deliberately skips the join to `recipes`, so the
   `NOT EXISTS` copy does not drag it in.
5. **The preferred unit comes through the `LEFT JOIN`**, so there is no separate units lookup. The
   aggregator gets everything it needs on each total.
6. **Not built: the "from which recipes" labels per line.** The design mentioned a second, flat query for
   them. The deliverable does not need it, and it can be added later without changing this statement.

**Plan** (`EXPLAIN ANALYZE`, `enable_seqscan = off`, Alex's week):

```
HashAggregate (actual rows=42)                         -- Group Key: i.id, u1.*, u0.category (name, aisle, density
  ->  Nested Loop Left Join (actual rows=60)           --   are dropped: they depend on the primary key i.id)
        ->  Hash Join  (Hash Cond: RecipeId = r0.recipe_id)
              ->  Append (actual rows=8)                                   -- the UNION ALL: 4 planned + 4 saved
                    ->  Index Scan using ix_meal_plans_user_id_week_start  (user_id = 1 AND week_start = …)
                        ->  Bitmap Index Scan on ix_meal_plan_entries_meal_plan_id_planned_date_slot
                        ->  Index Scan using pk_recipes
                    ->  Nested Loop Anti Join                              -- NOT EXISTS
                          ->  Bitmap Index Scan on pk_saved_recipes  (user_id = 1)
                          ->  Materialize -> ix_meal_plans_user_id_week_start -> ix_meal_plan_entries_…
              ->  Hash -> Index Scan using ix_recipe_ingredients_recipe_id_sort_order (84 rows)
                         -> Memoize -> Index Scan using pk_units
        ->  Memoize -> Index Scan using pk_ingredients
  ->  Index Scan using pk_units (preferred unit)
```

On 84 seeded ingredient lines the planner hashes the whole small table rather than probing it. With hash
and merge joins turned off, which is the shape it picks once `recipe_ingredients` is large, it probes
`ix_recipe_ingredients_recipe_id_sort_order` once per source recipe: 8 loops, `Index Cond: (recipe_id =
"RecipeId")`.

**Indexes, and why:**

| Index | Serves |
|---|---|
| unique `ix_meal_plans_user_id_week_start (user_id, week_start)` | the plan lookup, in both copies of the planned set: one probe |
| `ix_meal_plan_entries_meal_plan_id_planned_date_slot` | a plan's entries, through its leading column (also the calendar page) |
| PK `saved_recipes (user_id, recipe_id)` | the caller's saves, as a range on the leading column |
| `ix_recipe_ingredients_recipe_id_sort_order` | each source recipe's ingredient lines |
| PKs on `recipes`, `units`, `ingredients` | the remaining joins; `Memoize` caches units and ingredients that repeat |

**Tests:**

- `tests/Cookfeed.Domain.Tests/ShoppingList/ShoppingListAggregatorTests.cs`, the policy with no database:
  - the flour example (1,032.91 g) and milk converting toward millilitres
  - no density, which keeps lines apart as `unmerged`
  - count that never merges with mass
  - the base-unit fallbacks and division into the preferred unit
  - rounding half away from zero, and sorting
- `tests/Cookfeed.Application.Tests/ShoppingList/ShoppingListServiceTests.cs`
- `tests/Cookfeed.IntegrationTests/Api/ShoppingListEndpointTests.cs`, over HTTP:
  - Alex's list equals **Q8** line for line (41 lines).
  - A week's list equals Q8 with that one week condition added, for Alex's week and for a week with no
    plan (saved recipes only).
  - A recipe planned on two nights counts twice, checked against Q8 on a database with a second taco
    night.
  - The admin, who saves and plans nothing, gets an empty list.
  - A missing caller or a malformed `weekStart` is a 400.

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
