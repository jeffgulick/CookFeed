-- Cookfeed core queries (PostgreSQL). Run against a seeded database:  psql -d cookfeed -f queries.sql
--
-- These are the queries submitted with the write-up, and their output is the expected result printed
-- in write-up §7. Do NOT rewrite them to mirror the C# implementation: this file is the fidelity test
-- (load docs/schema.sql + docs/sql/seed.sql, run this, compare to §7). The API expresses the same
-- questions in LINQ across the Clean Architecture layers; docs/Queries.md tracks that side.

-- Q1. Feed: all published recipes, newest first, with the creator's handle and name
SELECT r.id, r.title, c.handle, u.display_name AS creator, r.servings, r.save_count, r.published_at::date
FROM recipes r
JOIN creator_profiles c ON r.creator_id = c.user_id
JOIN users u ON c.user_id = u.id
WHERE r.is_published
ORDER BY r.published_at DESC;

-- Q2. Counts published recipes per creator
SELECT c.handle, COUNT(r.id) AS published_recipes, COALESCE(SUM(r.save_count), 0) AS total_saves
FROM creator_profiles c
LEFT JOIN recipes r ON r.creator_id = c.user_id AND r.is_published
GROUP BY c.handle
ORDER BY total_saves DESC;

-- Q3. Trending feed: top 5 most-saved published recipes
SELECT r.title, c.handle, r.save_count
FROM recipes r
JOIN creator_profiles c ON r.creator_id = c.user_id
WHERE r.is_published
ORDER BY r.save_count DESC
LIMIT 5;

-- Q4. Recipe detail: structured ingredients for a specific recipe, in display order
SELECT ri.sort_order, ri.quantity, un.abbreviation AS unit, i.name AS ingredient, ri.preparation
FROM recipe_ingredients ri
JOIN ingredients i ON ri.ingredient_id = i.id
JOIN units un ON ri.unit_id = un.id
JOIN recipes r ON ri.recipe_id = r.id
WHERE r.title = '15-Minute Spaghetti Carbonara'
ORDER BY ri.sort_order;

-- Q5. Creator storefront: a creator's active products with the number of recipes in each
SELECT p.type, p.title, ROUND(p.price_cents / 100.0, 2) AS price_usd, COUNT(pr.recipe_id) AS recipes
FROM creator_profiles c
JOIN products p ON p.creator_id = c.user_id AND p.is_active
LEFT JOIN product_recipes pr ON pr.product_id = p.id
WHERE c.handle = 'maria-cooks'
GROUP BY p.id, p.type, p.title, p.price_cents
ORDER BY p.created_at;

-- Q6. A user's saved recipes
SELECT r.title, c.handle, s.saved_at::date AS saved_on
FROM saved_recipes s
JOIN users u ON s.user_id = u.id
JOIN recipes r ON s.recipe_id = r.id
JOIN creator_profiles c ON r.creator_id = c.user_id
WHERE u.email = 'alex@example.com'
ORDER BY s.saved_at;

-- Q7. A user's meal plan for a given week, in calendar order
SELECT e.planned_date, e.slot, r.title, r.servings AS recipe_servings, COALESCE(e.servings_override, r.servings) AS planned_servings
FROM meal_plans mp
JOIN users u ON mp.user_id = u.id
JOIN meal_plan_entries e ON e.meal_plan_id = mp.id
JOIN recipes r ON e.recipe_id = r.id
WHERE u.email = 'alex@example.com' AND mp.week_start = DATE '2026-09-21'
ORDER BY e.planned_date, CASE e.slot WHEN 'Breakfast' THEN 1 WHEN 'Lunch' THEN 2 WHEN 'Dinner' THEN 3 ELSE 4 END;

-- NOTE on Q8: this standalone query does the whole algorithm in SQL, including the
--     volume->mass density conversion. The application deliberately splits it (DesignDocument §6.5):
--     ShoppingListReader does Steps A-B, the pure C# ShoppingListAggregator does the density
--     conversion and presentation. One consequence: the final JOIN below requires a preferred
--     shopping unit in the matching category, so an ingredient without one, or with a category that
--     cannot be reconciled, is dropped here. The API surfaces those as "unmerged" lines instead of
--     dropping them, so the two outputs differ for exactly those ingredients. That is intended.
-- Q8. SHOPPING LIST: every ingredient across a user's planned + saved recipes, aggregated into one line per ingredient.
--     Step A: which recipes and at what scale (planned entries scaled by servings_override; saved-but-not-planned at 1x).
--     Step B: normalise each quantity to its unit category's base (ml / g / count) and, when the ingredient has a
--             known density, convert volume to grams so "2 cups flour" and "500 g flour" become one line.
--     Step C: present in the ingredient's preferred shopping unit.
WITH planned AS (
    SELECT e.recipe_id, COALESCE(e.servings_override, r.servings)::numeric / r.servings AS scale
    FROM meal_plan_entries e
    JOIN meal_plans mp ON e.meal_plan_id = mp.id
    JOIN users u ON mp.user_id = u.id
    JOIN recipes r ON e.recipe_id = r.id
    WHERE u.email = 'alex@example.com'
),
saved_not_planned AS (
    SELECT s.recipe_id, 1::numeric AS scale
    FROM saved_recipes s
    JOIN users u ON s.user_id = u.id
    WHERE u.email = 'alex@example.com'
      AND NOT EXISTS (SELECT 1 FROM planned p WHERE p.recipe_id = s.recipe_id)
),
src AS (SELECT * FROM planned UNION ALL SELECT * FROM saved_not_planned),
normalised AS (
    SELECT i.id AS ingredient_id, i.name, i.category AS aisle, i.preferred_shopping_unit_id,
           CASE WHEN un.category = 'Volume' AND i.density_g_per_ml IS NOT NULL THEN 'Mass' ELSE un.category END AS category,
           ri.quantity * src.scale * un.to_base_factor
             * CASE WHEN un.category = 'Volume' AND i.density_g_per_ml IS NOT NULL THEN i.density_g_per_ml ELSE 1 END AS base_qty
    FROM src
    JOIN recipe_ingredients ri ON ri.recipe_id = src.recipe_id AND NOT ri.is_optional
    JOIN ingredients i ON ri.ingredient_id = i.id
    JOIN units un ON ri.unit_id = un.id
)
SELECT n.aisle, n.name AS ingredient,
       ROUND(SUM(n.base_qty) / pu.to_base_factor, 2) AS quantity,
       pu.abbreviation AS unit
FROM normalised n
JOIN units pu ON pu.id = n.preferred_shopping_unit_id AND pu.category = n.category
GROUP BY n.aisle, n.name, pu.to_base_factor, pu.abbreviation
ORDER BY n.aisle, n.name;

-- Q9. Order history for a user, newest first, with line-item snapshots
SELECT o.id AS order_id, o.status, o.placed_at::date AS placed, ROUND(o.total_cents / 100.0, 2) AS total_usd,
       oi.product_title, ROUND(oi.unit_price_cents / 100.0, 2) AS price_usd, c.handle AS sold_by
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN order_items oi ON oi.order_id = o.id
JOIN creator_profiles c ON oi.creator_id = c.user_id
WHERE u.email = 'alex@example.com'
ORDER BY o.placed_at DESC, oi.id;

-- Q10. Creator earnings: paid revenue per creator
SELECT c.handle, COUNT(oi.id) AS items_sold, ROUND(SUM(oi.unit_price_cents) / 100.0, 2) AS revenue_usd
FROM order_items oi
JOIN orders o ON oi.order_id = o.id AND o.status = 'Paid'
JOIN creator_profiles c ON oi.creator_id = c.user_id
GROUP BY c.handle
ORDER BY revenue_usd DESC;

-- Q11. Which recipes a buyer has access to through paid products (entitlements)
SELECT DISTINCT r.title, p.title AS via_product
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN order_items oi ON oi.order_id = o.id
JOIN products p ON oi.product_id = p.id
JOIN product_recipes pr ON pr.product_id = p.id
JOIN recipes r ON pr.recipe_id = r.id
WHERE u.email = 'priya@example.com' AND o.status = 'Paid'
ORDER BY p.title, r.title;
