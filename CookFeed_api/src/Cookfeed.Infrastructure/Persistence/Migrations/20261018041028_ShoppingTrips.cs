using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Cookfeed.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ShoppingTrips : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "shopping_trips",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    user_id = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    status = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false, defaultValue: "Building"),
                    sent_to = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_shopping_trips", x => x.id);
                    table.CheckConstraint("ck_shopping_trips_status", "status IN ('Building', 'Shopping', 'Sent', 'Done')");
                    table.ForeignKey(
                        name: "fk_shopping_trips_users_user_id",
                        column: x => x.user_id,
                        principalTable: "users",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "shopping_trip_items",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    trip_id = table.Column<int>(type: "integer", nullable: false),
                    recipe_id = table.Column<int>(type: "integer", nullable: false),
                    servings = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_shopping_trip_items", x => x.id);
                    table.CheckConstraint("ck_shopping_trip_items_servings_positive", "servings > 0");
                    table.ForeignKey(
                        name: "fk_shopping_trip_items_recipes_recipe_id",
                        column: x => x.recipe_id,
                        principalTable: "recipes",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_shopping_trip_items_shopping_trips_trip_id",
                        column: x => x.trip_id,
                        principalTable: "shopping_trips",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "shopping_trip_skips",
                columns: table => new
                {
                    trip_id = table.Column<int>(type: "integer", nullable: false),
                    ingredient_id = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_shopping_trip_skips", x => new { x.trip_id, x.ingredient_id });
                    table.ForeignKey(
                        name: "fk_shopping_trip_skips_ingredients_ingredient_id",
                        column: x => x.ingredient_id,
                        principalTable: "ingredients",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_shopping_trip_skips_shopping_trips_trip_id",
                        column: x => x.trip_id,
                        principalTable: "shopping_trips",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_shopping_trip_items_recipe_id",
                table: "shopping_trip_items",
                column: "recipe_id");

            migrationBuilder.CreateIndex(
                name: "ix_shopping_trip_items_trip_id",
                table: "shopping_trip_items",
                column: "trip_id");

            migrationBuilder.CreateIndex(
                name: "ix_shopping_trip_skips_ingredient_id",
                table: "shopping_trip_skips",
                column: "ingredient_id");

            migrationBuilder.CreateIndex(
                name: "ix_shopping_trips_user_id_created_at",
                table: "shopping_trips",
                columns: new[] { "user_id", "created_at" },
                descending: new[] { false, true });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "shopping_trip_items");

            migrationBuilder.DropTable(
                name: "shopping_trip_skips");

            migrationBuilder.DropTable(
                name: "shopping_trips");
        }
    }
}
