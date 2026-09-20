# Cookfeed — Core Queries, Generated SQL, and Indexes

> **Status: the SQL in this document is expected output, not yet captured output.** It was written
> alongside the design, before the code existed. As each vertical slice is built, the block for that
> query gets replaced with the statement actually logged by
> `Microsoft.EntityFrameworkCore.Database.Command`. Until a section says *verified*, treat its SQL as
> a prediction of the query shape, not a transcript.

Each core query is one LINQ expression inside a read-side reader in
`src/Cookfeed.Infrastructure/Persistence/Queries/` (`FeedReader`, `RecipeReader`, `StorefrontReader`,
`ShoppingListReader`, `OrderReader`), implementing the corresponding port in
`src/Cookfeed.Application/Abstractions/Persistence/`. Readers return DTOs and never leak `IQueryable`
past the port. This document shows the LINQ, the SQL EF Core produces for it, and the index that makes
it cheap (aliases shortened for readability).

`appsettings.Development.json` turns on `Microsoft.EntityFrameworkCore.Database.Command` logging at
`Information` so the exact statement is printed on every request — run `dotnet run`, hit the endpoint,
and paste what it logs over the block here.

To see the planner's choice, prefix any statement with `EXPLAIN (ANALYZE, BUFFERS)` in `psql`.

The shopping-list section below is the one place where the SQL is deliberately only half the algorithm:
the reader aggregates per (ingredient, unit category) and the pure-C# `ShoppingListAggregator` in
`Cookfeed.Domain` does the density conversion, preferred-unit presentation, and unmerged-line policy.
See `DesignDocument.md` §6.5. `docs/sql/queries.sql` Q8 does the whole thing in SQL instead — that is a
standalone reference query, not what the API runs.

---

## 1. Feed

**Endpoint:** `GET /api/feed?sort=Newest|Trending&page=1&pageSize=20`

```csharp
db.Recipes.AsNoTracking()
  .Where(r => r.IsPublished)
  .OrderByDescending(r => r.PublishedAt).ThenByDescending(r => r.Id)
  .Skip((page - 1) * pageSize)
  .Take(pageSize + 1)                       // +1 row => HasMore without a COUNT(*)
  .Select(r => new FeedItemDto(
      r.Id, r.Title, r.VideoUrl, r.ThumbnailUrl, r.Servings,
      /* total minutes */, r.SaveCount, r.PublishedAt!.Value,
      r.Creator.Handle, r.Creator.User.DisplayName, r.Creator.IsVerified,
      viewerId != null && r.Saves.Any(s => s.UserId == viewerId)))
```

**Generated SQL (Newest):**

```sql
SELECT r.id, r.title, r.video_url, r.thumbnail_url, r.servings,
       CASE WHEN r.prep_minutes IS NULL AND r.cook_minutes IS NULL THEN NULL
            ELSE COALESCE(r.prep_minutes, 0) + COALESCE(r.cook_minutes, 0) END,
       r.save_count, r.published_at,
       c.handle, u.display_name, c.is_verified,
       CASE WHEN @viewerId IS NOT NULL AND EXISTS (
            SELECT 1 FROM saved_recipes s WHERE s.recipe_id = r.id AND s.user_id = @viewerId)
            THEN TRUE ELSE FALSE END
FROM recipes AS r
INNER JOIN creator_profiles AS c ON r.creator_id = c.user_id
INNER JOIN users AS u ON c.user_id = u.id
WHERE r.is_published
ORDER BY r.published_at DESC, r.id DESC
LIMIT @take OFFSET @skip
```

**Index:** `ix_recipes_is_published_published_at (is_published, published_at DESC)`. The `WHERE is_published` + `ORDER BY published_at DESC` + `LIMIT` shape is served by walking this index forward from the top and stopping after `pageSize + 1` rows: no sort node, no scan of unpublished drafts. `Trending` uses the sibling index `(is_published, save_count DESC)` with the same plan shape. The creator/user joins are PK lookups. The `EXISTS` for `SavedByViewer` hits the composite PK of `saved_recipes(user_id, recipe_id)`.

**Reviewed:** the `Take(pageSize + 1)` trick avoids the separate `SELECT COUNT(*)` that offset pagination normally needs. At scale, keyset pagination (`WHERE published_at < @last`) would replace `OFFSET`; the index is already the right one for that.

---

## 1b. Recipe detail

**Endpoint:** `GET /api/recipes/{id}`

```csharp
db.Recipes.AsNoTracking()
  .Where(r => r.Id == recipeId && r.IsPublished)
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
ORDER BY r.id, ri.sort_order, ri.id, st.step_number
```

**Indexes:** PK `recipes(id)`; `ix_recipe_ingredients_recipe_id_sort_order (recipe_id, sort_order)` returns the ingredient rows already in display order; unique `ix_recipe_steps_recipe_id_step_number (recipe_id, step_number)` does the same for steps.

---

## 2. Creator storefront

**Endpoint:** `GET /api/creators/{handle}`

```csharp
db.CreatorProfiles.AsNoTracking()
  .Where(c => c.Handle == handle)
  .Select(c => new StorefrontDto(
      c.Handle, c.User.DisplayName, c.Bio, c.AvatarUrl, c.IsVerified,
      c.Recipes.Count(r => r.IsPublished),
      c.Recipes.Where(r => r.IsPublished).Sum(r => r.SaveCount),
      c.Recipes.Where(r => r.IsPublished).OrderByDescending(r => r.PublishedAt).Select(...).ToList(),
      c.Products.Where(p => p.IsActive).OrderBy(p => p.CreatedAt).Select(p => new StorefrontProductDto(
          ..., p.ProductRecipes.Count,
          viewerId != null && p.OrderItems.Any(oi => oi.Order.UserId == viewerId && oi.Order.Status == "Paid"))).ToList()))
  .SingleOrDefaultAsync()
```

**Generated SQL (shape):**

```sql
SELECT c.handle, u.display_name, c.bio, c.avatar_url, c.is_verified,
       (SELECT count(*)::int FROM recipes r WHERE r.creator_id = c.user_id AND r.is_published),
       (SELECT COALESCE(sum(r.save_count), 0)::int FROM recipes r WHERE r.creator_id = c.user_id AND r.is_published),
       r2.id, r2.title, r2.thumbnail_url, r2.save_count, r2.published_at,
       p.id, p.type, p.title, p.description, p.price_cents, p.currency,
       (SELECT count(*)::int FROM product_recipes pr WHERE pr.product_id = p.id),
       CASE WHEN @viewerId IS NOT NULL AND EXISTS (
            SELECT 1 FROM order_items oi JOIN orders o ON oi.order_id = o.id
            WHERE oi.product_id = p.id AND o.user_id = @viewerId AND o.status = 'Paid') THEN TRUE ELSE FALSE END
FROM creator_profiles c
JOIN users u ON c.user_id = u.id
LEFT JOIN recipes r2 ON r2.creator_id = c.user_id AND r2.is_published
LEFT JOIN products p ON p.creator_id = c.user_id AND p.is_active
WHERE c.handle = @handle
ORDER BY c.user_id, r2.published_at DESC, r2.id, p.created_at
```

**Indexes:** unique `ix_creator_profiles_handle` — the URL lookup is a single index probe. `ix_recipes_creator_id` serves the recipe list and both aggregate subqueries. `ix_products_creator_id_is_active (creator_id, is_active)` serves the product list. The ownership `EXISTS` uses `ix_order_items_product_id` then the PK on `orders`.

**Reviewed:** the two aggregate subqueries over `recipes` scan the same rows as the recipe list join. For a creator with thousands of recipes that would be worth collapsing into one grouped subquery; at this project's scale the readability of the single LINQ projection wins.

---

## 3. Shopping list

**Endpoint:** `GET /api/users/{id}/shopping-list?weekStart=2026-09-21`

This is two SQL statements (aggregation, then a distinct recipe count over the same source set) plus a units lookup, followed by in-memory reconciliation described in the design document §6.5.

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

Covered in `DesignDocument.md` §6.3–6.5. Volume→Mass via density, preferred unit, rounding, aisle sort. The `Units` table (14 rows) is loaded once per call with `ToDictionaryAsync`.

---

## 4. Order history

**Endpoint:** `GET /api/users/{id}/orders`

```csharp
db.Orders.AsNoTracking()
  .Where(o => o.UserId == userId)
  .OrderByDescending(o => o.PlacedAt)
  .Select(o => new OrderDto(o.Id, o.Status, o.PlacedAt, o.PaidAt, o.TotalCents, o.Currency,
      o.Items.OrderBy(i => i.Id)
             .Select(i => new OrderItemDto(i.ProductId, i.ProductTitle, i.UnitPriceCents, i.Product.Creator.Handle))
             .ToList()))
```

**Generated SQL:**

```sql
SELECT o.id, o.status, o.placed_at, o.paid_at, o.total_cents, o.currency,
       oi.product_id, oi.product_title, oi.unit_price_cents, c.handle, oi.id
FROM orders o
LEFT JOIN (
    order_items oi
    JOIN products p ON oi.product_id = p.id
    JOIN creator_profiles c ON p.creator_id = c.user_id
) ON o.id = oi.order_id
WHERE o.user_id = @userId
ORDER BY o.placed_at DESC, o.id, oi.id
```

**Indexes:** `ix_orders_user_id_placed_at (user_id, placed_at DESC)` — the filter and the sort are the same index, read in order, so no sort node. Unique `ix_order_items_order_id_product_id (order_id, product_id)` serves the join on `order_id` through its leading column. The product/creator joins are PK lookups and exist only to produce the current `handle`; `product_title` and `unit_price_cents` come from the snapshot columns on `order_items`, not from `products`, which is the point of the snapshot.

---

## Write paths worth noting

Not "queries" in the assignment's sense, but the two writes that keep the denormalized columns correct:

**Save a recipe** (`POST /api/users/{u}/saves/{r}`): inside one transaction, `INSERT INTO saved_recipes` then

```sql
UPDATE recipes SET save_count = save_count + 1 WHERE id = @r
```

via `ExecuteUpdateAsync` — a single atomic statement, so two users saving simultaneously cannot both read 41 and write 42.

**Checkout** (`POST /api/users/{u}/checkout`): reads the cart's products, inserts an `orders` row with `total_cents = SUM(price_cents)` and one `order_items` row per product carrying `product_title`, `unit_price_cents`, and `creator_id` snapshots, then `DELETE FROM cart_items WHERE user_id = @u` — all in one transaction, so a failure anywhere leaves the cart intact and no partial order.
