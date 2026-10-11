using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests;

/// <summary>
/// <c>recipes.save_count</c> must always equal the number of <c>saved_recipes</c> rows for the recipe
/// (DesignDocument.md §3.4 and §6). The <c>saved_recipes_save_count</c> trigger keeps it so; these tests
/// change the save rows the three ways the application can, and check the counter after each.
/// </summary>
public class SaveCountTests(DatabaseFixture databases)
{
    [Fact]
    public async Task Saving_a_recipe_adds_one_to_its_count()
    {
        await using var db = await OpenSeededAsync();
        var pair = (await db.QueryAsync("""
            SELECT u.id, r.id FROM users u CROSS JOIN recipes r
            WHERE NOT EXISTS (SELECT 1 FROM saved_recipes s WHERE s.user_id = u.id AND s.recipe_id = r.id)
            ORDER BY u.id, r.id LIMIT 1
            """))[0];
        var (userId, recipeId) = (pair[0], pair[1]);
        var before = await SaveCountAsync(db, recipeId);

        await db.ExecuteAsync($"INSERT INTO saved_recipes (user_id, recipe_id) VALUES ({userId}, {recipeId})");

        Assert.Equal(before + 1, await SaveCountAsync(db, recipeId));
        await AssertEveryCountMatchesAsync(db);
    }

    [Fact]
    public async Task Unsaving_a_recipe_takes_one_from_its_count()
    {
        await using var db = await OpenSeededAsync();
        var save = (await db.QueryAsync("SELECT user_id, recipe_id FROM saved_recipes ORDER BY 1, 2 LIMIT 1"))[0];
        var (userId, recipeId) = (save[0], save[1]);
        var before = await SaveCountAsync(db, recipeId);

        await db.ExecuteAsync($"DELETE FROM saved_recipes WHERE user_id = {userId} AND recipe_id = {recipeId}");

        Assert.Equal(before - 1, await SaveCountAsync(db, recipeId));
        await AssertEveryCountMatchesAsync(db);
    }

    [Fact]
    public async Task Deleting_an_account_takes_its_saves_off_every_count()
    {
        // A hard delete is only possible for an account with no orders (orders are ON DELETE RESTRICT).
        // Its saves are removed by ON DELETE CASCADE, and the trigger fires for each cascaded row.
        await using var db = await OpenSeededAsync();
        var userId = await db.ScalarAsync<int>("""
            SELECT u.id FROM users u
            WHERE EXISTS (SELECT 1 FROM saved_recipes s WHERE s.user_id = u.id)
              AND NOT EXISTS (SELECT 1 FROM orders o WHERE o.user_id = u.id)
              AND NOT EXISTS (SELECT 1 FROM creator_profiles c WHERE c.user_id = u.id)
            ORDER BY u.id LIMIT 1
            """);
        var totalBefore = await db.ScalarAsync<long>("SELECT sum(save_count) FROM recipes");
        var theirSaves = await db.ScalarAsync<long>($"SELECT count(*) FROM saved_recipes WHERE user_id = {userId}");

        await db.ExecuteAsync($"DELETE FROM users WHERE id = {userId}");

        Assert.Equal(totalBefore - theirSaves, await db.ScalarAsync<long>("SELECT sum(save_count) FROM recipes"));
        await AssertEveryCountMatchesAsync(db);
    }

    private async Task<RolledBackConnection> OpenSeededAsync() =>
        await RolledBackConnection.OpenAsync(await databases.EfWithSeedScriptAsync());

    private static Task<int> SaveCountAsync(RolledBackConnection db, string? recipeId) =>
        db.ScalarAsync<int>($"SELECT save_count FROM recipes WHERE id = {recipeId}");

    /// <summary>queries.sql Q16 lists the recipes whose counter is wrong; there must be none.</summary>
    private static async Task AssertEveryCountMatchesAsync(RolledBackConnection db) =>
        Assert.Empty(await db.QueryAsync(SqlFiles.Query(16)));
}
