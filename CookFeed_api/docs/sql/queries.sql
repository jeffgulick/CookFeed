-- Cookfeed core queries (PostgreSQL). Run against a seeded database:  psql -d cookfeed -f queries.sql
--
-- These are the queries submitted with the write-up, revised after Assignment 2 feedback. Do NOT rewrite
-- them to mirror the C# implementation: this file is the fidelity test (load docs/schema.sql +
-- docs/sql/seed.sql, run this, compare). The API expresses the same questions in LINQ across the Clean
-- Architecture layers; docs/Queries.md tracks that side.
--
-- Revision notes (DesignDocument.md §3):
--   Q1-Q3   the feed and storefront show only visibility = 'Public' recipes.
--   Q5      counts distinct recipes and meals separately, since a meal plan may repeat a recipe.
--   Q8      the preferred shopping unit now decides the direction of the density conversion, and an
--           ingredient that cannot be expressed in its preferred unit falls back to the base unit of
--           its category instead of being dropped. The output matches the API's "unmerged" policy.
--   Q11     entitlements read order_item_recipes (the bundle as bought), not the live product_recipes.
--   Q14-Q17 new: recipe access, bundle drift, save_count consistency, and the rules the database refuses.

-- Q1. Feed: all public, published recipes, newest first, with the creator's handle and name
SELECT r.id, r.title, c.handle, u.display_name AS creator, r.servings, r.save_count, r.published_at::date
FROM recipes r
JOIN creator_profiles c ON r.creator_id = c.user_id
JOIN users u ON c.user_id = u.id
WHERE r.is_published AND r.visibility = 'Public'
ORDER BY r.published_at DESC;

-- Q2. Counts public published recipes per creator (what the storefront lists)
SELECT c.handle, COUNT(r.id) AS published_recipes, COALESCE(SUM(r.save_count), 0) AS total_saves
FROM creator_profiles c
LEFT JOIN recipes r ON r.creator_id = c.user_id AND r.is_published AND r.visibility = 'Public'
GROUP BY c.handle
ORDER BY total_saves DESC;

-- Q3. Trending feed: top 5 most-saved public recipes (newest wins a tie)
SELECT r.title, c.handle, r.save_count
FROM recipes r
JOIN creator_profiles c ON r.creator_id = c.user_id
WHERE r.is_published AND r.visibility = 'Public'
ORDER BY r.save_count DESC, r.published_at DESC
LIMIT 5;

-- Q4. Recipe detail: structured ingredients for a specific recipe, in display order
SELECT ri.sort_order, ri.quantity, un.abbreviation AS unit, i.name AS ingredient, ri.preparation
FROM recipe_ingredients ri
JOIN ingredients i ON ri.ingredient_id = i.id
JOIN units un ON ri.unit_id = un.id
JOIN recipes r ON ri.recipe_id = r.id
WHERE r.title = '15-Minute Spaghetti Carbonara'
ORDER BY ri.sort_order;

-- Q5. Creator storefront: a creator's active products with the number of recipes in each.
--     A meal plan may schedule one recipe on several days, so "recipes" (distinct) and "meals" (rows) differ.
SELECT p.type, p.title, ROUND(p.price_cents / 100.0, 2) AS price_usd,
       COUNT(DISTINCT pr.recipe_id) AS recipes,
       COUNT(pr.id) FILTER (WHERE p.type = 'MealPlan') AS meals
FROM creator_profiles c
JOIN products p ON p.creator_id = c.user_id AND p.is_active
LEFT JOIN product_recipes pr ON pr.product_id = p.id
WHERE c.handle = 'dan-meal-preps'
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

-- Q8. SHOPPING LIST: every ingredient across a user's planned + saved recipes, aggregated into one line per ingredient.
--     Step A: which recipes and at what scale (planned entries scaled by servings_override; saved-but-not-planned at 1x).
--     Step B: normalise each quantity to its unit category's base (ml / g / count). When the ingredient has a known
--             density, convert *toward the preferred shopping unit's category*: flour prefers grams, so "2 cups flour"
--             becomes grams; milk prefers millilitres, so "200 g milk" would become millilitres and "1.5 cups milk"
--             stays volume. The earlier version converted every dense volume to mass unconditionally and then could
--             not join liquids back to their millilitre preference, so they vanished from the list.
--     Step C: present in the preferred shopping unit. If there is no preferred unit, or the line's category still
--             differs from it (count vs. mass with no density), present in the category's base unit. An ingredient
--             with two irreconcilable categories therefore gets two lines, which is the same "unmerged" policy the
--             application's ShoppingListAggregator applies (DesignDocument.md §7.5).
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
           CASE
               WHEN un.category = 'Volume' AND pu.category = 'Mass'   AND i.density_g_per_ml IS NOT NULL THEN 'Mass'
               WHEN un.category = 'Mass'   AND pu.category = 'Volume' AND i.density_g_per_ml IS NOT NULL THEN 'Volume'
               ELSE un.category
           END AS category,
           ri.quantity * src.scale * un.to_base_factor
             * CASE
                   WHEN un.category = 'Volume' AND pu.category = 'Mass'   AND i.density_g_per_ml IS NOT NULL THEN i.density_g_per_ml
                   WHEN un.category = 'Mass'   AND pu.category = 'Volume' AND i.density_g_per_ml IS NOT NULL THEN 1 / i.density_g_per_ml
                   ELSE 1
               END AS base_qty
    FROM src
    JOIN recipe_ingredients ri ON ri.recipe_id = src.recipe_id AND NOT ri.is_optional
    JOIN ingredients i ON ri.ingredient_id = i.id
    JOIN units un ON ri.unit_id = un.id
    LEFT JOIN units pu ON pu.id = i.preferred_shopping_unit_id
)
SELECT n.aisle, n.name AS ingredient,
       ROUND(SUM(n.base_qty) / COALESCE(pu.to_base_factor, 1), 2) AS quantity,
       COALESCE(pu.abbreviation, CASE n.category WHEN 'Volume' THEN 'ml' WHEN 'Mass' THEN 'g' ELSE 'ea' END) AS unit
FROM normalised n
LEFT JOIN units pu ON pu.id = n.preferred_shopping_unit_id AND pu.category = n.category
GROUP BY n.aisle, n.name, n.category, pu.to_base_factor, pu.abbreviation
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

-- Q10. Creator earnings: paid revenue per creator. Buyers may themselves be creators (Dan bought from Kenji);
--      order_items.creator_id is always the seller, so the grouping is unaffected.
SELECT c.handle, COUNT(oi.id) AS items_sold, ROUND(SUM(oi.unit_price_cents) / 100.0, 2) AS revenue_usd
FROM order_items oi
JOIN orders o ON oi.order_id = o.id AND o.status = 'Paid'
JOIN creator_profiles c ON oi.creator_id = c.user_id
GROUP BY c.handle
ORDER BY revenue_usd DESC;

-- Q11. Which recipes a buyer has access to through paid products (entitlements).
--      Reads the checkout snapshot (order_item_recipes), not the live bundle, so later edits to the product
--      by its creator neither add to nor remove from what this buyer already owns.
SELECT DISTINCT r.title, r.visibility, oi.product_title AS via_product
FROM orders o
JOIN users u ON o.user_id = u.id
JOIN order_items oi ON oi.order_id = o.id
JOIN order_item_recipes oir ON oir.order_item_id = oi.id
JOIN recipes r ON oir.recipe_id = r.id
WHERE u.email = 'priya@example.com' AND o.status = 'Paid'
ORDER BY oi.product_title, r.title;

-- Q12. (Assignment 3) Reviews for a product, newest first, with the reviewer's display name
SELECT u.display_name AS reviewer, rv.rating, rv.recommends, rv.created_at::date AS posted, rv.body
FROM reviews rv
JOIN users u ON rv.user_id = u.id
JOIN products p ON rv.product_id = p.id
WHERE p.title = 'Three Weeknights in Japan'
ORDER BY rv.created_at DESC;

-- Q13. (Assignment 3) Review summary for a product: count, average rating, percent recommending
SELECT p.title,
       COUNT(rv.id) AS reviews,
       ROUND(AVG(rv.rating), 1) AS average_rating,
       ROUND(100.0 * COUNT(*) FILTER (WHERE rv.recommends) / NULLIF(COUNT(rv.id), 0)) AS percent_recommend
FROM products p
LEFT JOIN reviews rv ON rv.product_id = p.id
WHERE p.title = 'Three Weeknights in Japan'
GROUP BY p.id, p.title;

-- Q14. Recipe access: may this viewer open this recipe? This is the rule the recipe-detail endpoint applies.
--      A recipe is visible when it is published and Public, or when the viewer holds a Paid order whose
--      snapshot contains it. Shown for every ProductOnly recipe and every user: Alex owns both products that
--      contain them, Priya and Dan own only "Three Weeknights in Japan", home cooks without a purchase see neither.
SELECT r.title AS product_only_recipe, u.display_name AS viewer,
       EXISTS (SELECT 1
               FROM orders o
               JOIN order_items oi ON oi.order_id = o.id
               JOIN order_item_recipes oir ON oir.order_item_id = oi.id
               WHERE o.user_id = u.id AND o.status = 'Paid' AND oir.recipe_id = r.id) AS can_open
FROM recipes r
CROSS JOIN users u
WHERE r.is_published AND r.visibility = 'ProductOnly'
ORDER BY r.title, u.id;

-- Q15. Bundle drift: what a buyer keeps versus what the product contains today.
--      Alex bought "Roman Pasta Collection" when it still included No-Knead Focaccia; Maria removed it since.
--      kept_from_purchase = in the snapshot, in_product_today = in the live bundle.
--      A recipe added to the product after the purchase would appear as (false, true): not Alex's.
WITH purchase AS (
    SELECT oi.id AS order_item_id, oi.product_id
    FROM order_items oi
    JOIN orders o ON oi.order_id = o.id
    JOIN users u ON o.user_id = u.id
    WHERE u.email = 'alex@example.com' AND oi.product_title = 'Roman Pasta Collection' AND o.status = 'Paid'
),
bought AS (SELECT DISTINCT oir.recipe_id FROM order_item_recipes oir JOIN purchase USING (order_item_id)),
live   AS (SELECT DISTINCT pr.recipe_id  FROM product_recipes pr    JOIN purchase USING (product_id))
SELECT r.title,
       (b.recipe_id IS NOT NULL) AS kept_from_purchase,
       (l.recipe_id IS NOT NULL) AS in_product_today
FROM bought b
FULL OUTER JOIN live l ON l.recipe_id = b.recipe_id
JOIN recipes r ON r.id = COALESCE(b.recipe_id, l.recipe_id)
ORDER BY r.title;

-- Q16. save_count consistency: zero rows means every counter equals its save rows.
--      Holds after seeding (the counter is never written by the seed) and after any save, unsave or
--      cascaded delete, because the saved_recipes_save_count trigger maintains it.
SELECT r.id, r.title, r.save_count, COUNT(s.user_id) AS actual_saves
FROM recipes r
LEFT JOIN saved_recipes s ON s.recipe_id = r.id
GROUP BY r.id, r.title, r.save_count
HAVING r.save_count <> COUNT(s.user_id);

-- Q17. Rules the database refuses. Each statement below is EXPECTED TO FAIL; psql prints the error and
--      continues. Nothing is changed. (Run interactively with \set ON_ERROR_STOP off, which is the default.)
--      a) a creator adding their own product to their cart
INSERT INTO cart_items (user_id, product_id) VALUES (3, 1);
--      b) granting the admin a buying/selling role
INSERT INTO user_roles (user_id, role_id) VALUES (6, 1);
--      c) the same recipe twice in the same meal of a meal plan
INSERT INTO product_recipes (product_id, recipe_id, sort_order, day_offset, slot) VALUES (4, 9, 9, 3, 'Breakfast');
--      d) a collection listing a recipe twice
INSERT INTO product_recipes (product_id, recipe_id, sort_order) VALUES (1, 1, 9);
--      e) deleting a recipe that somebody has bought. Removing it from every live product is allowed (that is
--         the creator's call); deleting the recipe itself is refused because Alex's purchase snapshot still
--         references it. The creator's remedy is to unpublish, not delete.
BEGIN;
DELETE FROM product_recipes WHERE recipe_id = 3;
DELETE FROM recipes WHERE id = 3;
ROLLBACK;
