using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Cookfeed.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "roles",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_roles", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "units",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    abbreviation = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    category = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    to_base_factor = table.Column<decimal>(type: "numeric(12,6)", precision: 12, scale: 6, nullable: false),
                    is_metric = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_units", x => x.id);
                    table.CheckConstraint("ck_units_factor_positive", "to_base_factor > 0");
                });

            migrationBuilder.CreateTable(
                name: "users",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    display_name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    password_hash = table.Column<string>(type: "character varying(255)", maxLength: 255, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_users", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ingredients",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    category = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    density_g_per_ml = table.Column<decimal>(type: "numeric(8,4)", precision: 8, scale: 4, nullable: true),
                    preferred_shopping_unit_id = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ingredients", x => x.id);
                    table.CheckConstraint("ck_ingredients_density_positive", "density_g_per_ml IS NULL OR density_g_per_ml > 0");
                    table.ForeignKey(
                        name: "fk_ingredients_units_preferred_shopping_unit_id",
                        column: x => x.preferred_shopping_unit_id,
                        principalTable: "units",
                        principalColumn: "id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "creator_profiles",
                columns: table => new
                {
                    user_id = table.Column<int>(type: "integer", nullable: false),
                    handle = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    bio = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    avatar_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    is_verified = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_creator_profiles", x => x.user_id);
                    table.CheckConstraint("ck_creator_profiles_handle_slug", "handle ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'");
                    table.ForeignKey(
                        name: "fk_creator_profiles_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "meal_plans",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    week_start = table.Column<DateOnly>(type: "date", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_meal_plans", x => x.id);
                    table.ForeignKey(
                        name: "fk_meal_plans_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "orders",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    placed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    paid_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    total_cents = table.Column<int>(type: "integer", nullable: false),
                    currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    payment_reference = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_orders", x => x.id);
                    table.CheckConstraint("ck_orders_total_nonnegative", "total_cents >= 0");
                    table.ForeignKey(
                        name: "fk_orders_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "user_roles",
                columns: table => new
                {
                    user_id = table.Column<int>(type: "integer", nullable: false),
                    role_id = table.Column<int>(type: "integer", nullable: false),
                    granted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_user_roles", x => new { x.user_id, x.role_id });
                    table.ForeignKey(
                        name: "fk_user_roles_roles_role_id",
                        column: x => x.role_id,
                        principalTable: "roles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_user_roles_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "products",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    creator_id = table.Column<int>(type: "integer", nullable: false),
                    type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    cover_image_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    price_cents = table.Column<int>(type: "integer", nullable: false),
                    currency = table.Column<string>(type: "character varying(3)", maxLength: 3, nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_products", x => x.id);
                    table.CheckConstraint("ck_products_price_nonnegative", "price_cents >= 0");
                    table.ForeignKey(
                        name: "fk_products_creator_profiles_creator_id",
                        column: x => x.creator_id,
                        principalTable: "creator_profiles",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "recipes",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    creator_id = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    video_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                    thumbnail_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    servings = table.Column<int>(type: "integer", nullable: false),
                    prep_minutes = table.Column<int>(type: "integer", nullable: true),
                    cook_minutes = table.Column<int>(type: "integer", nullable: true),
                    is_published = table.Column<bool>(type: "boolean", nullable: false),
                    visibility = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false, defaultValue: "Public"),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    published_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    save_count = table.Column<int>(type: "integer", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_recipes", x => x.id);
                    table.CheckConstraint("ck_recipes_published_has_date", "is_published = false OR published_at IS NOT NULL");
                    table.CheckConstraint("ck_recipes_servings_positive", "servings > 0");
                    table.CheckConstraint("ck_recipes_visibility", "visibility IN ('Public', 'ProductOnly')");
                    table.ForeignKey(
                        name: "fk_recipes_creator_profiles_creator_id",
                        column: x => x.creator_id,
                        principalTable: "creator_profiles",
                        principalColumn: "user_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "cart_items",
                columns: table => new
                {
                    user_id = table.Column<int>(type: "integer", nullable: false),
                    product_id = table.Column<int>(type: "integer", nullable: false),
                    added_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_cart_items", x => new { x.user_id, x.product_id });
                    table.ForeignKey(
                        name: "fk_cart_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_cart_items_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "order_items",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    order_id = table.Column<int>(type: "integer", nullable: false),
                    product_id = table.Column<int>(type: "integer", nullable: false),
                    creator_id = table.Column<int>(type: "integer", nullable: false),
                    product_title = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    unit_price_cents = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_order_items", x => x.id);
                    table.CheckConstraint("ck_order_items_price_nonnegative", "unit_price_cents >= 0");
                    table.ForeignKey(
                        name: "fk_order_items_orders_order_id",
                        column: x => x.order_id,
                        principalTable: "orders",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_order_items_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "reviews",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    product_id = table.Column<int>(type: "integer", nullable: false),
                    user_id = table.Column<int>(type: "integer", nullable: false),
                    rating = table.Column<short>(type: "smallint", nullable: false),
                    recommends = table.Column<bool>(type: "boolean", nullable: false),
                    body = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_reviews", x => x.id);
                    table.CheckConstraint("ck_reviews_rating_range", "rating BETWEEN 1 AND 5");
                    table.ForeignKey(
                        name: "fk_reviews_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_reviews_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "meal_plan_entries",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    meal_plan_id = table.Column<int>(type: "integer", nullable: false),
                    recipe_id = table.Column<int>(type: "integer", nullable: false),
                    planned_date = table.Column<DateOnly>(type: "date", nullable: false),
                    slot = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    servings_override = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_meal_plan_entries", x => x.id);
                    table.CheckConstraint("ck_meal_plan_entries_servings_positive", "servings_override IS NULL OR servings_override > 0");
                    table.ForeignKey(
                        name: "fk_meal_plan_entries_meal_plans_meal_plan_id",
                        column: x => x.meal_plan_id,
                        principalTable: "meal_plans",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_meal_plan_entries_recipes_recipe_id",
                        column: x => x.recipe_id,
                        principalTable: "recipes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "product_recipes",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    product_id = table.Column<int>(type: "integer", nullable: false),
                    recipe_id = table.Column<int>(type: "integer", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    day_offset = table.Column<int>(type: "integer", nullable: true),
                    slot = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_product_recipes", x => x.id);
                    table.CheckConstraint("ck_product_recipes_day_offset_range", "day_offset IS NULL OR (day_offset BETWEEN 0 AND 6)");
                    table.CheckConstraint("ck_product_recipes_placement_pair", "(day_offset IS NULL) = (slot IS NULL)");
                    table.ForeignKey(
                        name: "fk_product_recipes_products_product_id",
                        column: x => x.product_id,
                        principalTable: "products",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_product_recipes_recipes_recipe_id",
                        column: x => x.recipe_id,
                        principalTable: "recipes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "recipe_ingredients",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    recipe_id = table.Column<int>(type: "integer", nullable: false),
                    ingredient_id = table.Column<int>(type: "integer", nullable: false),
                    unit_id = table.Column<int>(type: "integer", nullable: false),
                    quantity = table.Column<decimal>(type: "numeric(10,3)", precision: 10, scale: 3, nullable: false),
                    display_text = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: true),
                    preparation = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    is_optional = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_recipe_ingredients", x => x.id);
                    table.CheckConstraint("ck_recipe_ingredients_quantity_positive", "quantity > 0");
                    table.ForeignKey(
                        name: "fk_recipe_ingredients_ingredients_ingredient_id",
                        column: x => x.ingredient_id,
                        principalTable: "ingredients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "fk_recipe_ingredients_recipes_recipe_id",
                        column: x => x.recipe_id,
                        principalTable: "recipes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_recipe_ingredients_units_unit_id",
                        column: x => x.unit_id,
                        principalTable: "units",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "recipe_steps",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    recipe_id = table.Column<int>(type: "integer", nullable: false),
                    step_number = table.Column<int>(type: "integer", nullable: false),
                    instruction = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    video_timestamp_seconds = table.Column<int>(type: "integer", nullable: true),
                    duration_minutes = table.Column<int>(type: "integer", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_recipe_steps", x => x.id);
                    table.CheckConstraint("ck_recipe_steps_number_positive", "step_number > 0");
                    table.ForeignKey(
                        name: "fk_recipe_steps_recipes_recipe_id",
                        column: x => x.recipe_id,
                        principalTable: "recipes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "saved_recipes",
                columns: table => new
                {
                    user_id = table.Column<int>(type: "integer", nullable: false),
                    recipe_id = table.Column<int>(type: "integer", nullable: false),
                    saved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_saved_recipes", x => new { x.user_id, x.recipe_id });
                    table.ForeignKey(
                        name: "fk_saved_recipes_recipes_recipe_id",
                        column: x => x.recipe_id,
                        principalTable: "recipes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_saved_recipes_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "order_item_recipes",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    order_item_id = table.Column<int>(type: "integer", nullable: false),
                    recipe_id = table.Column<int>(type: "integer", nullable: false),
                    sort_order = table.Column<int>(type: "integer", nullable: false),
                    day_offset = table.Column<int>(type: "integer", nullable: true),
                    slot = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_order_item_recipes", x => x.id);
                    table.CheckConstraint("ck_order_item_recipes_day_offset_range", "day_offset IS NULL OR (day_offset BETWEEN 0 AND 6)");
                    table.CheckConstraint("ck_order_item_recipes_placement_pair", "(day_offset IS NULL) = (slot IS NULL)");
                    table.ForeignKey(
                        name: "fk_order_item_recipes_order_items_order_item_id",
                        column: x => x.order_item_id,
                        principalTable: "order_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_order_item_recipes_recipes_recipe_id",
                        column: x => x.recipe_id,
                        principalTable: "recipes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_cart_items_product_id",
                table: "cart_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "ix_creator_profiles_handle",
                table: "creator_profiles",
                column: "handle",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_ingredients_name",
                table: "ingredients",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_ingredients_preferred_shopping_unit_id",
                table: "ingredients",
                column: "preferred_shopping_unit_id");

            migrationBuilder.CreateIndex(
                name: "ix_meal_plan_entries_meal_plan_id_planned_date_slot",
                table: "meal_plan_entries",
                columns: new[] { "meal_plan_id", "planned_date", "slot" });

            migrationBuilder.CreateIndex(
                name: "ix_meal_plan_entries_recipe_id",
                table: "meal_plan_entries",
                column: "recipe_id");

            migrationBuilder.CreateIndex(
                name: "ix_meal_plans_user_id_week_start",
                table: "meal_plans",
                columns: new[] { "user_id", "week_start" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_order_item_recipes_order_item_id_recipe_id_day_offset_slot",
                table: "order_item_recipes",
                columns: new[] { "order_item_id", "recipe_id", "day_offset", "slot" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.CreateIndex(
                name: "ix_order_item_recipes_recipe_id",
                table: "order_item_recipes",
                column: "recipe_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_items_creator_id",
                table: "order_items",
                column: "creator_id");

            migrationBuilder.CreateIndex(
                name: "ix_order_items_order_id_product_id",
                table: "order_items",
                columns: new[] { "order_id", "product_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_order_items_product_id",
                table: "order_items",
                column: "product_id");

            migrationBuilder.CreateIndex(
                name: "ix_orders_user_id_placed_at",
                table: "orders",
                columns: new[] { "user_id", "placed_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_product_recipes_product_id_recipe_id_day_offset_slot",
                table: "product_recipes",
                columns: new[] { "product_id", "recipe_id", "day_offset", "slot" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.CreateIndex(
                name: "ix_product_recipes_product_id_sort_order",
                table: "product_recipes",
                columns: new[] { "product_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_product_recipes_recipe_id",
                table: "product_recipes",
                column: "recipe_id");

            migrationBuilder.CreateIndex(
                name: "ix_products_creator_id_is_active",
                table: "products",
                columns: new[] { "creator_id", "is_active" });

            migrationBuilder.CreateIndex(
                name: "ix_recipe_ingredients_ingredient_id",
                table: "recipe_ingredients",
                column: "ingredient_id");

            migrationBuilder.CreateIndex(
                name: "ix_recipe_ingredients_recipe_id_sort_order",
                table: "recipe_ingredients",
                columns: new[] { "recipe_id", "sort_order" });

            migrationBuilder.CreateIndex(
                name: "ix_recipe_ingredients_unit_id",
                table: "recipe_ingredients",
                column: "unit_id");

            migrationBuilder.CreateIndex(
                name: "ix_recipe_steps_recipe_id_step_number",
                table: "recipe_steps",
                columns: new[] { "recipe_id", "step_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_recipes_creator_id",
                table: "recipes",
                column: "creator_id");

            migrationBuilder.CreateIndex(
                name: "ix_recipes_is_published_visibility_published_at",
                table: "recipes",
                columns: new[] { "is_published", "visibility", "published_at" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "ix_recipes_is_published_visibility_save_count",
                table: "recipes",
                columns: new[] { "is_published", "visibility", "save_count" },
                descending: new[] { false, false, true });

            migrationBuilder.CreateIndex(
                name: "ix_reviews_product_id_created_at",
                table: "reviews",
                columns: new[] { "product_id", "created_at" },
                descending: new[] { false, true });

            migrationBuilder.CreateIndex(
                name: "ix_reviews_product_id_user_id",
                table: "reviews",
                columns: new[] { "product_id", "user_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_reviews_user_id",
                table: "reviews",
                column: "user_id");

            migrationBuilder.CreateIndex(
                name: "ix_roles_name",
                table: "roles",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_saved_recipes_recipe_id",
                table: "saved_recipes",
                column: "recipe_id");

            migrationBuilder.CreateIndex(
                name: "ix_units_abbreviation",
                table: "units",
                column: "abbreviation",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_units_name",
                table: "units",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_user_roles_role_id",
                table: "user_roles",
                column: "role_id");

            migrationBuilder.CreateIndex(
                name: "ix_users_email",
                table: "users",
                column: "email",
                unique: true);

            // Rules about which rows may exist, which a CHECK constraint cannot express because they compare
            // rows across tables or keep a derived value. EF Core does not model triggers, so they are written
            // here as SQL, copied verbatim from docs/schema.sql (DesignDocument.md §5).
            migrationBuilder.Sql("""
            -- recipes.save_count == COUNT(*) FROM saved_recipes WHERE recipe_id = recipes.id, always.
            -- A row-level trigger fires for ordinary saves and unsaves, for the rows the seed inserts, and for the rows
            -- removed by ON DELETE CASCADE when an account is hard-deleted; the counter cannot drift from the save rows.
            CREATE FUNCTION trg_saved_recipes_save_count() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF TG_OP = 'INSERT' THEN
                    UPDATE recipes SET save_count = save_count + 1 WHERE id = NEW.recipe_id;
                    RETURN NEW;
                ELSE
                    UPDATE recipes SET save_count = save_count - 1 WHERE id = OLD.recipe_id;
                    RETURN OLD;
                END IF;
            END $$;
            CREATE TRIGGER saved_recipes_save_count
                AFTER INSERT OR DELETE ON saved_recipes
                FOR EACH ROW EXECUTE FUNCTION trg_saved_recipes_save_count();

            -- A creator cannot buy their own product: refused at the cart and again at the order line, so neither the API
            -- nor a direct SQL caller can create the row.
            CREATE FUNCTION trg_cart_items_refuse_self_purchase() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF EXISTS (SELECT 1 FROM products p WHERE p.id = NEW.product_id AND p.creator_id = NEW.user_id) THEN
                    RAISE EXCEPTION 'A creator cannot add their own product (id %) to their cart', NEW.product_id
                        USING ERRCODE = 'check_violation', CONSTRAINT = 'ck_cart_items_no_self_purchase';
                END IF;
                RETURN NEW;
            END $$;
            CREATE TRIGGER cart_items_refuse_self_purchase
                BEFORE INSERT OR UPDATE ON cart_items
                FOR EACH ROW EXECUTE FUNCTION trg_cart_items_refuse_self_purchase();

            CREATE FUNCTION trg_order_items_refuse_self_purchase() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF EXISTS (SELECT 1
                           FROM orders o JOIN products p ON p.id = NEW.product_id
                           WHERE o.id = NEW.order_id AND p.creator_id = o.user_id) THEN
                    RAISE EXCEPTION 'A creator cannot buy their own product (id %)', NEW.product_id
                        USING ERRCODE = 'check_violation', CONSTRAINT = 'ck_order_items_no_self_purchase';
                END IF;
                RETURN NEW;
            END $$;
            CREATE TRIGGER order_items_refuse_self_purchase
                BEFORE INSERT OR UPDATE ON order_items
                FOR EACH ROW EXECUTE FUNCTION trg_order_items_refuse_self_purchase();

            -- Admins are operational only. An account holding Admin holds no other role, and an account holding another
            -- role cannot be granted Admin; promote by creating a separate admin account.
            CREATE FUNCTION trg_user_roles_admin_only() RETURNS trigger LANGUAGE plpgsql AS $$
            DECLARE
                new_role  varchar(40);
                conflicts integer;
            BEGIN
                SELECT name INTO new_role FROM roles WHERE id = NEW.role_id;
                SELECT COUNT(*) INTO conflicts
                FROM user_roles ur JOIN roles r ON r.id = ur.role_id
                WHERE ur.user_id = NEW.user_id AND ur.role_id <> NEW.role_id
                  AND (new_role = 'Admin' OR r.name = 'Admin');
                IF conflicts > 0 THEN
                    RAISE EXCEPTION 'User % cannot hold Admin together with another role', NEW.user_id
                        USING ERRCODE = 'check_violation', CONSTRAINT = 'ck_user_roles_admin_only';
                END IF;
                RETURN NEW;
            END $$;
            CREATE TRIGGER user_roles_admin_only
                BEFORE INSERT OR UPDATE ON user_roles
                FOR EACH ROW EXECUTE FUNCTION trg_user_roles_admin_only();
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
            DROP TRIGGER user_roles_admin_only ON user_roles;
            DROP TRIGGER order_items_refuse_self_purchase ON order_items;
            DROP TRIGGER cart_items_refuse_self_purchase ON cart_items;
            DROP TRIGGER saved_recipes_save_count ON saved_recipes;
            DROP FUNCTION trg_user_roles_admin_only();
            DROP FUNCTION trg_order_items_refuse_self_purchase();
            DROP FUNCTION trg_cart_items_refuse_self_purchase();
            DROP FUNCTION trg_saved_recipes_save_count();
            """);

            migrationBuilder.DropTable(
                name: "cart_items");

            migrationBuilder.DropTable(
                name: "meal_plan_entries");

            migrationBuilder.DropTable(
                name: "order_item_recipes");

            migrationBuilder.DropTable(
                name: "product_recipes");

            migrationBuilder.DropTable(
                name: "recipe_ingredients");

            migrationBuilder.DropTable(
                name: "recipe_steps");

            migrationBuilder.DropTable(
                name: "reviews");

            migrationBuilder.DropTable(
                name: "saved_recipes");

            migrationBuilder.DropTable(
                name: "user_roles");

            migrationBuilder.DropTable(
                name: "meal_plans");

            migrationBuilder.DropTable(
                name: "order_items");

            migrationBuilder.DropTable(
                name: "ingredients");

            migrationBuilder.DropTable(
                name: "recipes");

            migrationBuilder.DropTable(
                name: "roles");

            migrationBuilder.DropTable(
                name: "orders");

            migrationBuilder.DropTable(
                name: "products");

            migrationBuilder.DropTable(
                name: "units");

            migrationBuilder.DropTable(
                name: "creator_profiles");

            migrationBuilder.DropTable(
                name: "users");
        }
    }
}
