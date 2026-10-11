-- The prototype's data, read from the seeded database (Project Deliverable 2, part 2: the website and the
-- database describe the same store with the same field names and types).
--
-- Returns one JSON object: one key per table, each an array of that table's rows in primary-key order.
-- Table and column names are turned from snake_case into the camelCase the JavaScript uses, so
-- products.price_cents is products[i].priceCents and meal_plan_entries is mealPlanEntries. Values keep their
-- database types: integers and numerics are numbers, booleans are true/false, NULL is null, dates and
-- timestamps are ISO strings (run with the time zone set to UTC so they read the same on every machine).
--
-- Left out on purpose: users.password_hash and users.email, which a web page has no business holding.
--
-- One SELECT, no functions or temporary objects, so the integration test can run this exact file
-- (tests/Cookfeed.IntegrationTests/PrototypeDataTests.cs) and compare it with prototype/js/seed-data.js.
-- Regenerate that file with tools/export-seed-data.sh.
WITH table_rows (table_name, n, row_json) AS (
    SELECT 'roles', row_number() OVER (ORDER BY id), to_jsonb(t) FROM roles t
    UNION ALL SELECT 'users', row_number() OVER (ORDER BY id), to_jsonb(t) - 'password_hash' - 'email' FROM users t
    UNION ALL SELECT 'user_roles', row_number() OVER (ORDER BY user_id, role_id), to_jsonb(t) FROM user_roles t
    UNION ALL SELECT 'creator_profiles', row_number() OVER (ORDER BY user_id), to_jsonb(t) FROM creator_profiles t
    UNION ALL SELECT 'units', row_number() OVER (ORDER BY id), to_jsonb(t) FROM units t
    UNION ALL SELECT 'ingredients', row_number() OVER (ORDER BY id), to_jsonb(t) FROM ingredients t
    UNION ALL SELECT 'recipes', row_number() OVER (ORDER BY id), to_jsonb(t) FROM recipes t
    UNION ALL SELECT 'recipe_steps', row_number() OVER (ORDER BY id), to_jsonb(t) FROM recipe_steps t
    UNION ALL SELECT 'recipe_ingredients', row_number() OVER (ORDER BY id), to_jsonb(t) FROM recipe_ingredients t
    UNION ALL SELECT 'products', row_number() OVER (ORDER BY id), to_jsonb(t) FROM products t
    UNION ALL SELECT 'product_recipes', row_number() OVER (ORDER BY product_id, sort_order, id), to_jsonb(t) FROM product_recipes t
    UNION ALL SELECT 'saved_recipes', row_number() OVER (ORDER BY user_id, recipe_id), to_jsonb(t) FROM saved_recipes t
    UNION ALL SELECT 'meal_plans', row_number() OVER (ORDER BY id), to_jsonb(t) FROM meal_plans t
    UNION ALL SELECT 'meal_plan_entries', row_number() OVER (ORDER BY id), to_jsonb(t) FROM meal_plan_entries t
    UNION ALL SELECT 'cart_items', row_number() OVER (ORDER BY user_id, product_id), to_jsonb(t) FROM cart_items t
    UNION ALL SELECT 'orders', row_number() OVER (ORDER BY id), to_jsonb(t) FROM orders t
    UNION ALL SELECT 'order_items', row_number() OVER (ORDER BY id), to_jsonb(t) FROM order_items t
    UNION ALL SELECT 'order_item_recipes', row_number() OVER (ORDER BY id), to_jsonb(t) FROM order_item_recipes t
    UNION ALL SELECT 'reviews', row_number() OVER (ORDER BY id), to_jsonb(t) FROM reviews t
),
-- snake_case to camelCase: initcap('price_cents') is 'Price_Cents'; drop the underscores and lower the first
-- letter to get 'priceCents'.
camel_rows AS (
    SELECT lower(left(replace(initcap(table_name), '_', ''), 1)) || substr(replace(initcap(table_name), '_', ''), 2) AS table_key,
           n,
           (SELECT jsonb_object_agg(lower(left(replace(initcap(k), '_', ''), 1)) || substr(replace(initcap(k), '_', ''), 2), v)
            FROM jsonb_each(row_json) AS e (k, v)) AS row_json
    FROM table_rows
)
SELECT jsonb_pretty(jsonb_object_agg(table_key, rows_json))
FROM (SELECT table_key, jsonb_agg(row_json ORDER BY n) AS rows_json FROM camel_rows GROUP BY table_key) AS per_table;
