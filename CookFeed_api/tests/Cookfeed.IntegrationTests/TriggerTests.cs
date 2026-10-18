using Cookfeed.IntegrationTests.Support;
using Npgsql;

namespace Cookfeed.IntegrationTests;

/// <summary>
/// The rules the database itself refuses to break (DesignDocument.md §3 and §5; <c>queries.sql</c> Q17),
/// checked against the database the EF Core migration builds. Each test asserts the PostgreSQL error code
/// and the constraint named in it, because that is what the API will use to turn the error into a 4xx
/// response with a clear message.
/// </summary>
public class TriggerTests(DatabaseFixture databases)
{
    [Fact]
    public async Task A_creator_cannot_put_their_own_product_in_their_cart()
    {
        await using var db = await OpenSeededAsync();
        var (creatorId, productId) = await AnyCreatorAndTheirProductAsync(db);

        var error = await db.RefusedAsync($"INSERT INTO cart_items (user_id, product_id) VALUES ({creatorId}, {productId})");

        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal("ck_cart_items_no_self_purchase", error.ConstraintName);
    }

    [Fact]
    public async Task A_creator_cannot_buy_their_own_product()
    {
        await using var db = await OpenSeededAsync();
        var (creatorId, productId) = await AnyCreatorAndTheirProductAsync(db);
        var orderId = await db.ScalarAsync<int>($"""
            INSERT INTO orders (user_id, status, total_cents, currency) VALUES ({creatorId}, 'Pending', 0, 'USD')
            RETURNING id
            """);

        var error = await db.RefusedAsync($"""
            INSERT INTO order_items (order_id, product_id, creator_id, product_title, unit_price_cents)
            VALUES ({orderId}, {productId}, {creatorId}, 'Own product', 0)
            """);

        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal("ck_order_items_no_self_purchase", error.ConstraintName);
    }

    [Fact]
    public async Task An_admin_cannot_be_given_another_role()
    {
        await using var db = await OpenSeededAsync();
        var adminId = await db.ScalarAsync<int>(
            "SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'Admin' LIMIT 1");

        var error = await db.RefusedAsync(
            $"INSERT INTO user_roles (user_id, role_id) SELECT {adminId}, id FROM roles WHERE name = 'HomeCook'");

        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal("ck_user_roles_admin_only", error.ConstraintName);
    }

    [Fact]
    public async Task A_user_with_another_role_cannot_be_made_an_admin()
    {
        await using var db = await OpenSeededAsync();
        var homeCookId = await db.ScalarAsync<int>(
            "SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'HomeCook' LIMIT 1");

        var error = await db.RefusedAsync(
            $"INSERT INTO user_roles (user_id, role_id) SELECT {homeCookId}, id FROM roles WHERE name = 'Admin'");

        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal("ck_user_roles_admin_only", error.ConstraintName);
    }

    [Fact]
    public async Task A_meal_plan_can_repeat_a_recipe_on_another_day()
    {
        // DesignDocument.md §3.2: overnight oats on Monday and Thursday is a normal meal plan.
        await using var db = await OpenSeededAsync();
        var placement = (await db.QueryAsync("""
            SELECT product_id, recipe_id, day_offset, slot FROM product_recipes WHERE day_offset IS NOT NULL
            ORDER BY id LIMIT 1
            """))[0];
        var (productId, recipeId, slot) = (placement[0], placement[1], placement[3]);
        var anotherDay = (int.Parse(placement[2]!) + 1) % 7;

        await db.ExecuteAsync($"""
            INSERT INTO product_recipes (product_id, recipe_id, sort_order, day_offset, slot)
            VALUES ({productId}, {recipeId}, 99, {anotherDay}, '{slot}')
            ON CONFLICT DO NOTHING
            """);

        var days = await db.ScalarAsync<long>($"""
            SELECT count(*) FROM product_recipes
            WHERE product_id = {productId} AND recipe_id = {recipeId} AND slot = '{slot}'
            """);
        Assert.True(days >= 2, $"Recipe {recipeId} should now be in product {productId} on two days, found {days}.");
    }

    [Fact]
    public async Task A_meal_plan_cannot_list_a_recipe_twice_in_the_same_meal()
    {
        await using var db = await OpenSeededAsync();

        var error = await db.RefusedAsync("""
            INSERT INTO product_recipes (product_id, recipe_id, sort_order, day_offset, slot)
            SELECT product_id, recipe_id, 99, day_offset, slot FROM product_recipes WHERE day_offset IS NOT NULL LIMIT 1
            """);

        Assert.Equal(PostgresErrorCodes.UniqueViolation, error.SqlState);
        Assert.Equal("ix_product_recipes_product_id_recipe_id_day_offset_slot", error.ConstraintName);
    }

    [Fact]
    public async Task A_collection_cannot_list_a_recipe_twice()
    {
        // day_offset and slot are NULL for a collection; NULLS NOT DISTINCT makes the same index refuse this.
        await using var db = await OpenSeededAsync();

        var error = await db.RefusedAsync("""
            INSERT INTO product_recipes (product_id, recipe_id, sort_order)
            SELECT product_id, recipe_id, 99 FROM product_recipes WHERE day_offset IS NULL LIMIT 1
            """);

        Assert.Equal(PostgresErrorCodes.UniqueViolation, error.SqlState);
        Assert.Equal("ix_product_recipes_product_id_recipe_id_day_offset_slot", error.ConstraintName);
    }

    [Fact]
    public async Task A_public_recipe_cannot_be_put_in_a_product()
    {
        // DesignDocument.md §3.3: a product sells only recipes that are not free to save.
        await using var db = await OpenSeededAsync();
        var (productId, recipeId) = await AnyProductAndAPublicRecipeOfItsCreatorAsync(db);

        var error = await db.RefusedAsync($"""
            INSERT INTO product_recipes (product_id, recipe_id, sort_order) VALUES ({productId}, {recipeId}, 99)
            """);

        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal("ck_product_recipes_product_only", error.ConstraintName);
    }

    [Fact]
    public async Task A_product_line_cannot_be_moved_to_a_public_recipe()
    {
        await using var db = await OpenSeededAsync();
        var (productId, recipeId) = await AnyProductAndAPublicRecipeOfItsCreatorAsync(db);

        var error = await db.RefusedAsync($"""
            UPDATE product_recipes SET recipe_id = {recipeId}
            WHERE id = (SELECT min(id) FROM product_recipes WHERE product_id = {productId})
            """);

        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal("ck_product_recipes_product_only", error.ConstraintName);
    }

    [Fact]
    public async Task A_recipe_in_a_product_cannot_be_made_public()
    {
        await using var db = await OpenSeededAsync();
        var recipeId = await db.ScalarAsync<int>("SELECT recipe_id FROM product_recipes ORDER BY id LIMIT 1");

        var error = await db.RefusedAsync($"UPDATE recipes SET visibility = 'Public' WHERE id = {recipeId}");

        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal("ck_recipes_in_product_product_only", error.ConstraintName);
    }

    [Fact]
    public async Task A_recipe_taken_out_of_every_product_can_be_made_public()
    {
        // The creator takes it out of their products first; buyers keep it through their order snapshots.
        await using var db = await OpenSeededAsync();
        var recipeId = await db.ScalarAsync<int>("SELECT recipe_id FROM product_recipes ORDER BY id LIMIT 1");
        await db.ExecuteAsync($"DELETE FROM product_recipes WHERE recipe_id = {recipeId}");

        await db.ExecuteAsync($"UPDATE recipes SET visibility = 'Public' WHERE id = {recipeId}");

        Assert.Equal("Public", await db.ScalarAsync<string>($"SELECT visibility FROM recipes WHERE id = {recipeId}"));
    }

    [Fact]
    public async Task Only_an_admin_writes_the_audit_trail()
    {
        // DesignDocument.md §3.8: admin_actions records what an admin did; nobody else may write it.
        await using var db = await OpenSeededAsync();
        var adminId = await db.ScalarAsync<int>(
            "SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'Admin' LIMIT 1");
        var cookId = await db.ScalarAsync<int>(
            "SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE r.name = 'HomeCook' LIMIT 1");

        await db.ExecuteAsync($"""
            INSERT INTO admin_actions (admin_user_id, action, target_table, target_id, note)
            VALUES ({adminId}, 'HideReview', 'reviews', 1, 'test')
            """);
        var error = await db.RefusedAsync($"""
            INSERT INTO admin_actions (admin_user_id, action, target_table, target_id)
            VALUES ({cookId}, 'HideReview', 'reviews', 1)
            """);

        Assert.Equal(PostgresErrorCodes.CheckViolation, error.SqlState);
        Assert.Equal("ck_admin_actions_admin_only", error.ConstraintName);
    }

    [Fact]
    public async Task A_recipe_somebody_bought_cannot_be_deleted()
    {
        // DesignDocument.md §3.3: removing it from every live product is allowed, deleting it is not.
        await using var db = await OpenSeededAsync();
        var recipeId = await db.ScalarAsync<int>("SELECT recipe_id FROM order_item_recipes LIMIT 1");
        await db.ExecuteAsync($"DELETE FROM product_recipes WHERE recipe_id = {recipeId}");

        var error = await db.RefusedAsync($"DELETE FROM recipes WHERE id = {recipeId}");

        Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, error.SqlState);
        Assert.Equal("order_item_recipes", error.TableName);
    }

    [Fact]
    public async Task A_user_with_orders_cannot_be_deleted()
    {
        // DesignDocument.md §5: financial history must survive; accounts with orders are anonymised instead.
        await using var db = await OpenSeededAsync();
        var buyerId = await db.ScalarAsync<int>("""
            SELECT o.user_id FROM orders o
            WHERE NOT EXISTS (SELECT 1 FROM creator_profiles c WHERE c.user_id = o.user_id)
            ORDER BY o.user_id LIMIT 1
            """);

        var error = await db.RefusedAsync($"DELETE FROM users WHERE id = {buyerId}");

        Assert.Equal(PostgresErrorCodes.ForeignKeyViolation, error.SqlState);
        Assert.Equal("orders", error.TableName);
    }

    private async Task<RolledBackConnection> OpenSeededAsync() =>
        await RolledBackConnection.OpenAsync(await databases.EfWithSeedScriptAsync());

    private static async Task<(int CreatorId, int ProductId)> AnyCreatorAndTheirProductAsync(RolledBackConnection db)
    {
        var row = (await db.QueryAsync("SELECT creator_id, id FROM products ORDER BY id LIMIT 1"))[0];
        return (int.Parse(row[0]!), int.Parse(row[1]!));
    }

    private static async Task<(int ProductId, int RecipeId)> AnyProductAndAPublicRecipeOfItsCreatorAsync(RolledBackConnection db)
    {
        var row = (await db.QueryAsync("""
            SELECT p.id, r.id FROM products p JOIN recipes r ON r.creator_id = p.creator_id
            WHERE r.visibility = 'Public' AND r.is_published ORDER BY p.id, r.id LIMIT 1
            """))[0];
        return (int.Parse(row[0]!), int.Parse(row[1]!));
    }
}
