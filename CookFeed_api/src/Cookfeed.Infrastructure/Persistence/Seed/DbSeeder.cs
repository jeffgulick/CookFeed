using Microsoft.EntityFrameworkCore;

namespace Cookfeed.Infrastructure.Persistence.Seed;

/// <summary>
/// Loads the same rows as <c>docs/sql/seed.sql</c> into an empty, migrated database. The API runs it at
/// startup in Development; it does nothing if the database already has accounts, so it is safe to run on
/// every start.
/// </summary>
public class DbSeeder(CookfeedDbContext db)
{
    public async Task SeedAsync(CancellationToken cancellationToken = default)
    {
        if (await db.Users.AnyAsync(cancellationToken))
        {
            return;
        }

        // All or nothing: a failure part-way leaves the database empty, not half seeded.
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        db.Roles.AddRange(SeedData.Roles);
        db.Units.AddRange(SeedData.Units);
        db.Users.AddRange(SeedData.Users);
        db.UserRoles.AddRange(SeedData.UserRoles);
        db.CreatorProfiles.AddRange(SeedData.CreatorProfiles);
        db.Ingredients.AddRange(SeedData.Ingredients);
        db.Recipes.AddRange(SeedData.Recipes);
        db.RecipeSteps.AddRange(SeedData.RecipeSteps);
        db.RecipeIngredients.AddRange(SeedData.RecipeIngredients);
        db.Products.AddRange(SeedData.Products);
        db.ProductRecipes.AddRange(SeedData.ProductRecipes);
        db.SavedRecipes.AddRange(SeedData.SavedRecipes);
        db.MealPlans.AddRange(SeedData.MealPlans);
        db.MealPlanEntries.AddRange(SeedData.MealPlanEntries);
        db.CartItems.AddRange(SeedData.CartItems);
        db.Orders.AddRange(SeedData.Orders);
        db.OrderItems.AddRange(SeedData.OrderItems);
        db.OrderItemRecipes.AddRange(SeedData.OrderItemRecipes);
        db.Reviews.AddRange(SeedData.Reviews);
        await db.SaveChangesAsync(cancellationToken);

        await ResetIdSequencesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }

    /// <summary>
    /// The rows above carry explicit ids, which do not advance the tables' id sequences. Move each sequence
    /// past the highest id, as the end of <c>seed.sql</c> does, so the next row the API inserts gets a fresh id.
    /// </summary>
    private Task ResetIdSequencesAsync(CancellationToken cancellationToken) =>
        db.Database.ExecuteSqlRawAsync("""
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
            SELECT setval(pg_get_serial_sequence('order_item_recipes', 'id'), (SELECT MAX(id) FROM order_item_recipes));
            SELECT setval(pg_get_serial_sequence('product_recipes', 'id'), (SELECT MAX(id) FROM product_recipes));
            SELECT setval(pg_get_serial_sequence('reviews', 'id'), (SELECT MAX(id) FROM reviews));
            """, cancellationToken);
}
