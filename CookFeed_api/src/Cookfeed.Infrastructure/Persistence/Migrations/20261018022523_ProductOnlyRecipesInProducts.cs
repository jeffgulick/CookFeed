using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Cookfeed.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class ProductOnlyRecipesInProducts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // A product sells only ProductOnly recipes (DesignDocument.md §3.3). A database that already holds a
            // Public recipe in a product has it made ProductOnly first, so no row breaks the rule once it is enforced.
            // The triggers are copied verbatim from docs/schema.sql.
            migrationBuilder.Sql("""
            UPDATE recipes SET visibility = 'ProductOnly'
            WHERE visibility = 'Public' AND id IN (SELECT recipe_id FROM product_recipes);

            -- A product sells only ProductOnly recipes: nothing a buyer pays for is also free to save from the feed
            -- (DesignDocument.md §3.3). Refused when a Public recipe is put in a product, and when a recipe that is in a
            -- product is made Public. To give a recipe away, the creator takes it out of their products first; buyers keep
            -- it through their order snapshots.
            CREATE FUNCTION trg_product_recipes_product_only() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF EXISTS (SELECT 1 FROM recipes r WHERE r.id = NEW.recipe_id AND r.visibility = 'Public') THEN
                    RAISE EXCEPTION 'Recipe % is Public; only ProductOnly recipes can be put in a product', NEW.recipe_id
                        USING ERRCODE = 'check_violation', CONSTRAINT = 'ck_product_recipes_product_only';
                END IF;
                RETURN NEW;
            END $$;
            CREATE TRIGGER product_recipes_product_only
                BEFORE INSERT OR UPDATE ON product_recipes
                FOR EACH ROW EXECUTE FUNCTION trg_product_recipes_product_only();

            CREATE FUNCTION trg_recipes_in_product_product_only() RETURNS trigger LANGUAGE plpgsql AS $$
            BEGIN
                IF NEW.visibility = 'Public' AND EXISTS (SELECT 1 FROM product_recipes pr WHERE pr.recipe_id = NEW.id) THEN
                    RAISE EXCEPTION 'Recipe % is in a product, so it cannot be made Public', NEW.id
                        USING ERRCODE = 'check_violation', CONSTRAINT = 'ck_recipes_in_product_product_only';
                END IF;
                RETURN NEW;
            END $$;
            CREATE TRIGGER recipes_in_product_product_only
                BEFORE UPDATE OF visibility ON recipes
                FOR EACH ROW EXECUTE FUNCTION trg_recipes_in_product_product_only();
            """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
            DROP TRIGGER recipes_in_product_product_only ON recipes;
            DROP TRIGGER product_recipes_product_only ON product_recipes;
            DROP FUNCTION trg_recipes_in_product_product_only();
            DROP FUNCTION trg_product_recipes_product_only();
            """);
        }
    }
}
