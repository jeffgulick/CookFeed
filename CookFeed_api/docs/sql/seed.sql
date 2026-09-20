-- Cookfeed seed data (PostgreSQL). Same content as src/Cookfeed.Api/Data/Seed/DbSeeder.cs.
-- Run after schema.sql:  psql -d cookfeed -f seed.sql
BEGIN;

-- Roles
INSERT INTO roles (id, name) VALUES
  (1, 'HomeCook'),
  (2, 'Creator'),
  (3, 'Admin');

-- Units: every unit has a category and a factor to that category's base (ml / g / 1)
INSERT INTO units (id, name, abbreviation, category, to_base_factor, is_metric) VALUES
  (1, 'teaspoon', 'tsp', 'Volume', 4.92892, FALSE),
  (2, 'tablespoon', 'tbsp', 'Volume', 14.7868, FALSE),
  (3, 'cup', 'c', 'Volume', 236.588, FALSE),
  (4, 'fluid ounce', 'fl oz', 'Volume', 29.5735, FALSE),
  (5, 'millilitre', 'ml', 'Volume', 1, TRUE),
  (6, 'litre', 'L', 'Volume', 1000, TRUE),
  (7, 'gram', 'g', 'Mass', 1, TRUE),
  (8, 'kilogram', 'kg', 'Mass', 1000, TRUE),
  (9, 'ounce', 'oz', 'Mass', 28.3495, FALSE),
  (10, 'pound', 'lb', 'Mass', 453.592, FALSE),
  (11, 'each', 'ea', 'Count', 1, TRUE),
  (12, 'clove', 'clove', 'Count', 1, TRUE),
  (13, 'can', 'can', 'Count', 1, TRUE),
  (14, 'bunch', 'bunch', 'Count', 1, TRUE);

-- Users (password_hash is a placeholder; real hashes come from ASP.NET Identity)
INSERT INTO users (id, email, display_name, password_hash, created_at) VALUES
  (1, 'alex@example.com', 'Alex Rivera', '$2a$11$devonlydevonlydevonlydevonlydevonlydevonlydevonlyde', '2026-08-01 12:00:00+00'),
  (2, 'priya@example.com', 'Priya Shah', '$2a$11$devonlydevonlydevonlydevonlydevonlydevonlydevonlyde', '2026-08-04 12:00:00+00'),
  (3, 'maria@example.com', 'Maria Conti', '$2a$11$devonlydevonlydevonlydevonlydevonlydevonlydevonlyde', '2026-07-02 12:00:00+00'),
  (4, 'kenji@example.com', 'Kenji Watanabe', '$2a$11$devonlydevonlydevonlydevonlydevonlydevonlydevonlyde', '2026-07-07 12:00:00+00'),
  (5, 'dan@example.com', 'Dan Okafor', '$2a$11$devonlydevonlydevonlydevonlydevonlydevonlydevonlyde', '2026-07-22 12:00:00+00'),
  (6, 'admin@cookfeed.app', 'Cookfeed Admin', '$2a$11$devonlydevonlydevonlydevonlydevonlydevonlydevonlyde', '2026-06-02 12:00:00+00');

-- User roles (creators are also home cooks)
INSERT INTO user_roles (user_id, role_id) VALUES
  (1, 1),
  (2, 1),
  (3, 1),
  (3, 2),
  (4, 1),
  (4, 2),
  (5, 1),
  (5, 2),
  (6, 3);

-- Creator profiles (1:1 with users)
INSERT INTO creator_profiles (user_id, handle, bio, is_verified) VALUES
  (3, 'maria-cooks', 'Roman trattoria classics, filmed in a tiny Chicago kitchen. Weeknight pasta is a right, not a privilege.', TRUE),
  (4, 'kenji-kitchen', 'Japanese home cooking with a weeknight clock. Everything under 30 minutes, everything shoppable.', TRUE),
  (5, 'dan-meal-preps', 'Dad of three. I cook on Sunday so we eat all week. No fancy gear.', FALSE);

-- Canonical ingredients (density enables volume->mass conversion)
INSERT INTO ingredients (id, name, category, density_g_per_ml, preferred_shopping_unit_id) VALUES
  (1, 'all-purpose flour', 'Pantry', 0.53, 7),
  (2, 'granulated sugar', 'Pantry', 0.85, 7),
  (3, 'brown sugar', 'Pantry', 0.82, 7),
  (4, 'unsalted butter', 'Dairy', 0.911, 7),
  (5, 'egg', 'Dairy', NULL, 11),
  (6, 'whole milk', 'Dairy', 1.03, 5),
  (7, 'parmesan cheese', 'Dairy', 0.45, 7),
  (8, 'mozzarella cheese', 'Dairy', NULL, 7),
  (9, 'heavy cream', 'Dairy', 1.0, 5),
  (10, 'olive oil', 'Pantry', 0.92, 5),
  (11, 'kosher salt', 'Spices', 1.2, 7),
  (12, 'black pepper', 'Spices', 0.5, 7),
  (13, 'garlic', 'Produce', NULL, 12),
  (14, 'yellow onion', 'Produce', NULL, 11),
  (15, 'crushed tomatoes', 'Pantry', 1.02, 13),
  (16, 'fresh basil', 'Produce', NULL, 14),
  (17, 'spaghetti', 'Pantry', NULL, 7),
  (18, 'pancetta', 'Meat', NULL, 7),
  (19, 'boneless chicken thigh', 'Meat', NULL, 7),
  (20, 'chicken breast', 'Meat', NULL, 7),
  (21, 'ground beef', 'Meat', NULL, 7),
  (22, 'soy sauce', 'Pantry', 1.07, 5),
  (23, 'mirin', 'Pantry', 1.1, 5),
  (24, 'sake', 'Beverages', 0.99, 5),
  (25, 'fresh ginger', 'Produce', NULL, 7),
  (26, 'scallion', 'Produce', NULL, 14),
  (27, 'short-grain rice', 'Pantry', 0.85, 7),
  (28, 'rice vinegar', 'Pantry', 1.01, 5),
  (29, 'sesame oil', 'Pantry', 0.92, 5),
  (30, 'vegetable oil', 'Pantry', 0.92, 5),
  (31, 'lime', 'Produce', NULL, 11),
  (32, 'cilantro', 'Produce', NULL, 14),
  (33, 'flour tortilla', 'Bakery', NULL, 11),
  (34, 'chickpeas', 'Pantry', NULL, 13),
  (35, 'tahini', 'Pantry', 1.1, 5),
  (36, 'lemon', 'Produce', NULL, 11),
  (37, 'ground cumin', 'Spices', 0.55, 7),
  (38, 'chili powder', 'Spices', 0.5, 7),
  (39, 'baking powder', 'Pantry', 0.9, 7),
  (40, 'vanilla extract', 'Pantry', 0.88, 5),
  (41, 'chocolate chips', 'Pantry', 0.65, 7),
  (42, 'rolled oats', 'Pantry', 0.41, 7),
  (43, 'banana', 'Produce', NULL, 11),
  (44, 'honey', 'Pantry', 1.42, 5),
  (45, 'greek yogurt', 'Dairy', 1.05, 7),
  (46, 'blueberries', 'Produce', NULL, 7),
  (47, 'baby spinach', 'Produce', NULL, 7),
  (48, 'bell pepper', 'Produce', NULL, 11),
  (49, 'broccoli', 'Produce', NULL, 11),
  (50, 'cornstarch', 'Pantry', 0.54, 7);

-- Recipes (12 published + 1 draft). created_at shown equal to published_at for brevity.
INSERT INTO recipes (id, creator_id, title, description, video_url, thumbnail_url, servings, prep_minutes, cook_minutes, is_published, created_at, published_at, save_count) VALUES
  (1, 3, '15-Minute Spaghetti Carbonara', 'No cream. Ever. Eggs, cheese, pancetta, pepper, and the pasta water does the rest.', 'https://cdn.cookfeed.app/videos/001.mp4', 'https://cdn.cookfeed.app/thumbs/001.jpg', 4, 5, 12, TRUE, '2026-07-12 12:00:00+00', '2026-07-12 12:00:00+00', 412),
  (2, 3, 'Sunday Marinara from Scratch', 'One can of tomatoes, one onion, one hour. Freezes beautifully.', 'https://cdn.cookfeed.app/videos/002.mp4', 'https://cdn.cookfeed.app/thumbs/002.jpg', 6, 10, 60, TRUE, '2026-07-14 12:00:00+00', '2026-07-14 12:00:00+00', 289),
  (3, 3, 'No-Knead Focaccia', 'Mix tonight, bake tomorrow. Dimples optional but strongly encouraged.', 'https://cdn.cookfeed.app/videos/003.mp4', 'https://cdn.cookfeed.app/thumbs/003.jpg', 8, 15, 25, TRUE, '2026-07-20 12:00:00+00', '2026-07-20 12:00:00+00', 651),
  (4, 3, 'Weeknight Chicken Parm', 'Thin cutlets, quick fry, broiled with marinara and mozzarella.', 'https://cdn.cookfeed.app/videos/004.mp4', 'https://cdn.cookfeed.app/thumbs/004.jpg', 4, 15, 20, TRUE, '2026-07-26 12:00:00+00', '2026-07-26 12:00:00+00', 198),
  (5, 4, 'Chicken Teriyaki, the Real Way', 'Four ingredients in the sauce. Skin-on thighs. That''s the whole secret.', 'https://cdn.cookfeed.app/videos/005.mp4', 'https://cdn.cookfeed.app/thumbs/005.jpg', 2, 5, 15, TRUE, '2026-07-13 12:00:00+00', '2026-07-13 12:00:00+00', 733),
  (6, 4, 'Onigiri Three Ways', 'Salmon, umeboshi, and tuna-mayo. Rice, salt, and a wet hand.', 'https://cdn.cookfeed.app/videos/006.mp4', 'https://cdn.cookfeed.app/thumbs/006.jpg', 4, 20, 20, TRUE, '2026-07-17 12:00:00+00', '2026-07-17 12:00:00+00', 504),
  (7, 4, '10-Minute Ginger Garlic Stir-Fry', 'The one-pan dinner I make when I have nothing planned.', 'https://cdn.cookfeed.app/videos/007.mp4', 'https://cdn.cookfeed.app/thumbs/007.jpg', 2, 5, 8, TRUE, '2026-07-23 12:00:00+00', '2026-07-23 12:00:00+00', 387),
  (8, 5, 'Saturday Buttermilk-Style Pancakes', 'Fluffy, forgiving, and the kids can help. Milk plus a little vinegar stands in for buttermilk.', 'https://cdn.cookfeed.app/videos/008.mp4', 'https://cdn.cookfeed.app/thumbs/008.jpg', 4, 10, 15, TRUE, '2026-07-24 12:00:00+00', '2026-07-24 12:00:00+00', 276),
  (9, 5, 'Five-Day Overnight Oats', 'One mixing bowl on Sunday, five breakfasts done.', 'https://cdn.cookfeed.app/videos/009.mp4', 'https://cdn.cookfeed.app/thumbs/009.jpg', 5, 10, 0, TRUE, '2026-07-25 12:00:00+00', '2026-07-25 12:00:00+00', 522),
  (10, 5, 'Weeknight Beef Tacos', 'Skip the packet. Cumin, chili powder, and a squeeze of lime.', 'https://cdn.cookfeed.app/videos/010.mp4', 'https://cdn.cookfeed.app/thumbs/010.jpg', 4, 10, 15, TRUE, '2026-07-28 12:00:00+00', '2026-07-28 12:00:00+00', 341),
  (11, 5, 'Smooth Hummus', 'Peel the chickpeas. Yes, really. It''s worth it.', 'https://cdn.cookfeed.app/videos/011.mp4', 'https://cdn.cookfeed.app/thumbs/011.jpg', 6, 15, 0, TRUE, '2026-07-29 12:00:00+00', '2026-07-29 12:00:00+00', 154),
  (12, 5, 'Brown Butter Chocolate Chip Cookies', 'Brown the butter. Chill the dough. Thank me later.', 'https://cdn.cookfeed.app/videos/012.mp4', 'https://cdn.cookfeed.app/thumbs/012.jpg', 24, 20, 12, TRUE, '2026-07-30 12:00:00+00', '2026-07-30 12:00:00+00', 890),
  (13, 4, 'Miso Soup (draft)', NULL, 'https://cdn.cookfeed.app/videos/draft-miso.mp4', NULL, 2, NULL, NULL, FALSE, '2026-07-31 12:00:00+00', NULL, 0);

-- Recipe steps
INSERT INTO recipe_steps (id, recipe_id, step_number, instruction, video_timestamp_seconds) VALUES
  (1, 1, 1, 'Boil a large pot of salted water and cook the spaghetti until just shy of al dente.', 8),
  (2, 1, 2, 'Render the pancetta in a cold pan over medium heat until crisp.', 16),
  (3, 1, 3, 'Whisk the eggs, cheese, and pepper in a bowl.', 24),
  (4, 1, 4, 'Off the heat, toss the pasta with the pancetta, then add the egg mixture and a splash of pasta water, stirring fast until glossy.', 32),
  (5, 1, 5, 'Serve immediately with more cheese and pepper.', 40),
  (6, 2, 1, 'Sweat the onion in olive oil over low heat until translucent, about 8 minutes.', 8),
  (7, 2, 2, 'Add garlic and cook 1 minute, until fragrant.', 16),
  (8, 2, 3, 'Add tomatoes, salt, and sugar. Simmer uncovered for 45 minutes, stirring now and then.', 24),
  (9, 2, 4, 'Stir in basil off the heat.', 32),
  (10, 3, 1, 'Stir flour, salt, sugar, and 400 ml of water into a shaggy dough. Cover and refrigerate overnight.', 8),
  (11, 3, 2, 'Pour the dough into a well-oiled pan and let it rise at room temperature for 2 hours.', 16),
  (12, 3, 3, 'Dimple with oiled fingers, top with flaky salt, and bake at 230°C for 25 minutes.', 24),
  (13, 4, 1, 'Season the chicken and dredge in flour, then egg, then parmesan.', 8),
  (14, 4, 2, 'Shallow-fry in vegetable oil until golden on both sides.', 16),
  (15, 4, 3, 'Top with marinara and mozzarella and broil until bubbling.', 24),
  (16, 5, 1, 'Sear the thighs skin-side down in oil until deeply browned, about 6 minutes.', 8),
  (17, 5, 2, 'Flip, add soy, mirin, sake, and sugar, and simmer until the sauce reduces to a glaze.', 16),
  (18, 5, 3, 'Slice and spoon the glaze over. Garnish with scallions.', 24),
  (19, 6, 1, 'Cook the rice and let it cool until you can handle it.', 8),
  (20, 6, 2, 'Wet and salt your hands, scoop a handful of rice, press in a filling, and shape into a triangle.', 16),
  (21, 6, 3, 'Wrap with nori just before eating so it stays crisp.', 24),
  (22, 7, 1, 'Toss the chicken with cornstarch and 1 tbsp soy sauce.', 8),
  (23, 7, 2, 'Stir-fry the chicken in vegetable oil over high heat until just cooked, then remove.', 16),
  (24, 7, 3, 'Stir-fry the vegetables, garlic, and ginger for 3 minutes, return the chicken, add the remaining soy, vinegar, and sesame oil, and toss.', 24),
  (25, 8, 1, 'Whisk the dry ingredients together in one bowl and the wet in another.', 8),
  (26, 8, 2, 'Combine and stir just until no dry streaks remain. Lumps are fine.', 16),
  (27, 8, 3, 'Cook on a medium griddle until bubbles form, flip, and cook 1 more minute.', 24),
  (28, 9, 1, 'Mash the bananas in a large bowl and whisk in milk, yogurt, honey, and vanilla.', 8),
  (29, 9, 2, 'Stir in the oats and blueberries.', 16),
  (30, 9, 3, 'Portion into five jars and refrigerate overnight.', 24),
  (31, 10, 1, 'Brown the beef with the onion, breaking it up as it cooks.', 8),
  (32, 10, 2, 'Add garlic and spices and cook 2 minutes more.', 16),
  (33, 10, 3, 'Serve in warm tortillas with lime and cilantro.', 24),
  (34, 11, 1, 'Blend tahini and lemon juice for a minute until pale and whipped.', 8),
  (35, 11, 2, 'Add chickpeas, garlic, cumin, salt, and olive oil and blend, adding cold water a tablespoon at a time until silky.', 16),
  (36, 12, 1, 'Brown the butter in a light-colored pan until it smells nutty, then cool 10 minutes.', 8),
  (37, 12, 2, 'Beat the butter with both sugars, then the eggs and vanilla.', 16),
  (38, 12, 3, 'Fold in flour, baking powder, salt, and chocolate chips. Chill the dough at least 1 hour.', 24),
  (39, 12, 4, 'Bake at 180°C for 11–12 minutes until the edges are set and the centers look underdone.', 32),
  (40, 13, 1, 'TODO', NULL);

-- Recipe ingredients — note flour appears as 500 g (recipe 3), 1 cup (4), 2 cups (8) and 2.25 cups (12)
INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, unit_id, quantity, display_text, preparation, sort_order, is_optional) VALUES
  (1, 1, 17, 7, 400, NULL, NULL, 1, FALSE),
  (2, 1, 18, 7, 150, NULL, 'diced', 2, FALSE),
  (3, 1, 5, 11, 3, NULL, NULL, 3, FALSE),
  (4, 1, 7, 3, 1, 'Parmigiano-Reggiano', 'finely grated', 4, FALSE),
  (5, 1, 12, 1, 1, 'freshly cracked black pepper', NULL, 5, FALSE),
  (6, 1, 11, 2, 1, NULL, 'for the pasta water', 6, FALSE),
  (7, 2, 15, 13, 1, '28 oz crushed tomatoes', NULL, 1, FALSE),
  (8, 2, 14, 11, 1, NULL, 'finely diced', 2, FALSE),
  (9, 2, 13, 12, 4, NULL, 'minced', 3, FALSE),
  (10, 2, 10, 2, 3, NULL, NULL, 4, FALSE),
  (11, 2, 16, 14, 1, NULL, 'torn', 5, FALSE),
  (12, 2, 11, 1, 1, NULL, NULL, 6, FALSE),
  (13, 2, 2, 1, 1, NULL, 'optional, to balance', 7, FALSE),
  (14, 3, 1, 7, 500, 'all-purpose flour', NULL, 1, FALSE),
  (15, 3, 11, 1, 2, NULL, NULL, 2, FALSE),
  (16, 3, 10, 5, 60, 'plus more for the pan', NULL, 3, FALSE),
  (17, 3, 2, 1, 1, NULL, NULL, 4, FALSE),
  (18, 4, 20, 7, 600, NULL, 'butterflied and pounded thin', 1, FALSE),
  (19, 4, 1, 3, 1, 'all-purpose flour', 'for dredging', 2, FALSE),
  (20, 4, 5, 11, 2, NULL, 'beaten', 3, FALSE),
  (21, 4, 7, 3, 0.5, NULL, 'grated', 4, FALSE),
  (22, 4, 8, 7, 200, NULL, 'sliced', 5, FALSE),
  (23, 4, 30, 3, 0.5, NULL, 'for frying', 6, FALSE),
  (24, 4, 11, 1, 1, NULL, NULL, 7, FALSE),
  (25, 5, 19, 7, 500, 'boneless skin-on chicken thighs', NULL, 1, FALSE),
  (26, 5, 22, 2, 3, NULL, NULL, 2, FALSE),
  (27, 5, 23, 2, 3, NULL, NULL, 3, FALSE),
  (28, 5, 24, 2, 2, NULL, NULL, 4, FALSE),
  (29, 5, 2, 2, 1, NULL, NULL, 5, FALSE),
  (30, 5, 30, 2, 1, NULL, NULL, 6, FALSE),
  (31, 5, 26, 14, 1, NULL, 'sliced, to garnish', 7, FALSE),
  (32, 6, 27, 3, 2, 'short-grain (sushi) rice', 'rinsed', 1, FALSE),
  (33, 6, 11, 1, 1, NULL, NULL, 2, FALSE),
  (34, 6, 29, 1, 1, NULL, 'for the hands', 3, FALSE),
  (35, 7, 20, 7, 300, NULL, 'sliced thin', 1, FALSE),
  (36, 7, 49, 11, 1, 'head of broccoli', 'cut into florets', 2, FALSE),
  (37, 7, 48, 11, 1, NULL, 'sliced', 3, FALSE),
  (38, 7, 13, 12, 3, NULL, 'minced', 4, FALSE),
  (39, 7, 25, 7, 15, NULL, 'grated', 5, FALSE),
  (40, 7, 22, 2, 2, NULL, NULL, 6, FALSE),
  (41, 7, 50, 2, 1, NULL, NULL, 7, FALSE),
  (42, 7, 29, 1, 1, NULL, NULL, 8, FALSE),
  (43, 7, 30, 2, 2, NULL, NULL, 9, FALSE),
  (44, 7, 28, 2, 1, NULL, NULL, 10, FALSE),
  (45, 8, 1, 3, 2, 'all-purpose flour', NULL, 1, FALSE),
  (46, 8, 2, 2, 2, NULL, NULL, 2, FALSE),
  (47, 8, 39, 1, 2, NULL, NULL, 3, FALSE),
  (48, 8, 11, 1, 0.5, NULL, NULL, 4, FALSE),
  (49, 8, 6, 3, 1.5, NULL, NULL, 5, FALSE),
  (50, 8, 5, 11, 2, NULL, NULL, 6, FALSE),
  (51, 8, 4, 2, 3, NULL, 'melted', 7, FALSE),
  (52, 8, 40, 1, 1, NULL, NULL, 8, FALSE),
  (53, 9, 42, 3, 2.5, NULL, NULL, 1, FALSE),
  (54, 9, 6, 3, 2.5, NULL, NULL, 2, FALSE),
  (55, 9, 45, 3, 1, NULL, NULL, 3, FALSE),
  (56, 9, 44, 2, 3, NULL, NULL, 4, FALSE),
  (57, 9, 43, 11, 2, NULL, 'mashed', 5, FALSE),
  (58, 9, 46, 7, 150, NULL, NULL, 6, FALSE),
  (59, 9, 40, 1, 1, NULL, NULL, 7, FALSE),
  (60, 10, 21, 7, 500, NULL, NULL, 1, FALSE),
  (61, 10, 14, 11, 1, NULL, 'diced', 2, FALSE),
  (62, 10, 13, 12, 2, NULL, 'minced', 3, FALSE),
  (63, 10, 37, 1, 2, NULL, NULL, 4, FALSE),
  (64, 10, 38, 2, 1, NULL, NULL, 5, FALSE),
  (65, 10, 11, 1, 1, NULL, NULL, 6, FALSE),
  (66, 10, 33, 11, 8, NULL, 'warmed', 7, FALSE),
  (67, 10, 31, 11, 2, NULL, 'cut in wedges', 8, FALSE),
  (68, 10, 32, 14, 1, NULL, 'chopped', 9, FALSE),
  (69, 11, 34, 13, 1, '15 oz can chickpeas', 'drained, skins removed', 1, FALSE),
  (70, 11, 35, 3, 0.25, NULL, NULL, 2, FALSE),
  (71, 11, 36, 11, 1, NULL, 'juiced', 3, FALSE),
  (72, 11, 13, 12, 1, NULL, NULL, 4, FALSE),
  (73, 11, 10, 2, 2, NULL, NULL, 5, FALSE),
  (74, 11, 37, 1, 0.5, NULL, NULL, 6, FALSE),
  (75, 11, 11, 1, 0.5, NULL, NULL, 7, FALSE),
  (76, 12, 4, 3, 1, NULL, 'browned and cooled', 1, FALSE),
  (77, 12, 3, 3, 1, NULL, 'packed', 2, FALSE),
  (78, 12, 2, 3, 0.5, NULL, NULL, 3, FALSE),
  (79, 12, 5, 11, 2, NULL, NULL, 4, FALSE),
  (80, 12, 40, 1, 2, NULL, NULL, 5, FALSE),
  (81, 12, 1, 3, 2.25, 'all-purpose flour', NULL, 6, FALSE),
  (82, 12, 39, 1, 1, NULL, NULL, 7, FALSE),
  (83, 12, 11, 1, 1, NULL, NULL, 8, FALSE),
  (84, 12, 41, 7, 340, NULL, NULL, 9, FALSE);

-- Products (collections and meal plans)
INSERT INTO products (id, creator_id, type, title, description, price_cents, currency, is_active, created_at) VALUES
  (1, 3, 'RecipeCollection', 'Roman Pasta Collection', 'Carbonara, marinara, and the techniques behind them, with shopping lists built in.', 799, 'USD', TRUE, '2026-07-18 12:00:00+00'),
  (2, 3, 'RecipeCollection', 'The Bread Box', 'Focaccia and friends.', 499, 'USD', TRUE, '2026-07-21 12:00:00+00'),
  (3, 4, 'MealPlan', 'Three Weeknights in Japan', 'Monday, Tuesday, Wednesday dinners, all under 30 minutes.', 1299, 'USD', TRUE, '2026-07-19 12:00:00+00'),
  (4, 5, 'MealPlan', 'Family Week on a Budget', 'Seven dinners, two breakfasts, one grocery trip.', 999, 'USD', TRUE, '2026-07-27 12:00:00+00'),
  (5, 5, 'RecipeCollection', 'Summer Grilling (retired)', NULL, 599, 'USD', FALSE, '2026-06-22 12:00:00+00');

-- Product contents (meal plans carry day_offset and slot)
INSERT INTO product_recipes (product_id, recipe_id, sort_order, day_offset, slot) VALUES
  (1, 1, 1, NULL, NULL),
  (1, 2, 2, NULL, NULL),
  (1, 4, 3, NULL, NULL),
  (2, 3, 1, NULL, NULL),
  (3, 5, 1, 0, 'Dinner'),
  (3, 7, 2, 1, 'Dinner'),
  (3, 6, 3, 2, 'Dinner'),
  (4, 9, 1, 0, 'Breakfast'),
  (4, 10, 2, 0, 'Dinner'),
  (4, 8, 3, 5, 'Breakfast'),
  (4, 11, 4, 2, 'Snack'),
  (4, 12, 5, 6, 'Snack');

-- Saved recipes
INSERT INTO saved_recipes (user_id, recipe_id, saved_at) VALUES
  (1, 1, '2026-08-02 12:00:00+00'),
  (1, 3, '2026-08-03 12:00:00+00'),
  (1, 8, '2026-08-04 12:00:00+00'),
  (1, 5, '2026-08-05 12:00:00+00'),
  (1, 12, '2026-08-06 12:00:00+00'),
  (1, 7, '2026-08-07 12:00:00+00'),
  (2, 12, '2026-08-05 12:00:00+00'),
  (3, 5, '2026-08-03 12:00:00+00');

-- Meal plans
INSERT INTO meal_plans (id, user_id, name, week_start) VALUES
  (1, 1, 'Week of Sept 21', '2026-09-21');

-- Meal plan entries (teriyaki scaled 2->4 servings; tacos planned but not saved; carbonara saved AND planned)
INSERT INTO meal_plan_entries (id, meal_plan_id, recipe_id, planned_date, slot, servings_override) VALUES
  (1, 1, 5, '2026-09-21', 'Dinner', 4),
  (2, 1, 10, '2026-09-22', 'Dinner', NULL),
  (3, 1, 1, '2026-09-23', 'Dinner', NULL),
  (4, 1, 9, '2026-09-21', 'Breakfast', NULL);

-- Cart
INSERT INTO cart_items (user_id, product_id) VALUES
  (1, 2);

-- Orders
INSERT INTO orders (id, user_id, status, placed_at, paid_at, total_cents, currency, payment_reference) VALUES
  (1, 1, 'Paid', '2026-08-11 12:00:00+00', '2026-08-11 12:01:00+00', 2098, 'USD', 'pi_seed_0001'),
  (2, 1, 'Paid', '2026-08-31 12:00:00+00', '2026-08-31 12:02:00+00', 999, 'USD', 'pi_seed_0002'),
  (3, 1, 'Cancelled', '2026-09-05 12:00:00+00', NULL, 499, 'USD', NULL),
  (4, 2, 'Paid', '2026-08-21 12:00:00+00', '2026-08-21 12:00:00+00', 999, 'USD', 'pi_seed_0003');

-- Order items (title, price and creator are snapshots taken at checkout)
INSERT INTO order_items (id, order_id, product_id, creator_id, product_title, unit_price_cents) VALUES
  (1, 1, 1, 3, 'Roman Pasta Collection', 799),
  (2, 1, 3, 4, 'Three Weeknights in Japan', 1299),
  (3, 2, 4, 5, 'Family Week on a Budget', 999),
  (4, 3, 2, 3, 'The Bread Box', 499),
  (5, 4, 4, 5, 'Family Week on a Budget', 999);

-- Re-sync identity sequences after explicit-id inserts so the application can insert normally.
SELECT setval(pg_get_serial_sequence('roles', 'id'), (SELECT MAX(id) FROM roles));
SELECT setval(pg_get_serial_sequence('units', 'id'), (SELECT MAX(id) FROM units));
SELECT setval(pg_get_serial_sequence('users', 'id'), (SELECT MAX(id) FROM users));
SELECT setval(pg_get_serial_sequence('ingredients', 'id'), (SELECT MAX(id) FROM ingredients));
SELECT setval(pg_get_serial_sequence('recipes', 'id'), (SELECT MAX(id) FROM recipes));
SELECT setval(pg_get_serial_sequence('recipe_steps', 'id'), (SELECT MAX(id) FROM recipe_steps));
SELECT setval(pg_get_serial_sequence('recipe_ingredients', 'id'), (SELECT MAX(id) FROM recipe_ingredients));
SELECT setval(pg_get_serial_sequence('products', 'id'), (SELECT MAX(id) FROM products));
SELECT setval(pg_get_serial_sequence('meal_plans', 'id'), (SELECT MAX(id) FROM meal_plans));
SELECT setval(pg_get_serial_sequence('meal_plan_entries', 'id'), (SELECT MAX(id) FROM meal_plan_entries));
SELECT setval(pg_get_serial_sequence('orders', 'id'), (SELECT MAX(id) FROM orders));
SELECT setval(pg_get_serial_sequence('order_items', 'id'), (SELECT MAX(id) FROM order_items));
COMMIT;