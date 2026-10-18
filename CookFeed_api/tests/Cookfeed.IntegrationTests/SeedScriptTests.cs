using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests;

/// <summary>
/// <c>docs/sql/seed.sql</c> and <c>docs/sql/queries.sql</c> must run unchanged against the database the EF
/// Core migration builds (DOCKER.md, fidelity test steps 1 and 2), and give the results the design document
/// quotes.
/// </summary>
public class SeedScriptTests(DatabaseFixture databases)
{
    public static TheoryData<int> ReadOnlyQueries => [.. SqlFiles.ReadOnlyQueryNumbers];

    [Fact]
    public async Task Seed_script_loads_into_the_migrated_database()
    {
        // Building this database runs seed.sql; any error in it fails here.
        var connectionString = await databases.EfWithSeedScriptAsync();

        var users = await Sql.QueryAsync(connectionString, "SELECT count(*) FROM users");
        Assert.Equal("10", users[0][0]);
    }

    [Theory]
    [MemberData(nameof(ReadOnlyQueries))]
    public async Task Query_gives_the_same_result_as_on_the_schema_sql_database(int query)
    {
        var expected = await Sql.QueryLinesAsync(await databases.ReferenceWithSeedScriptAsync(), SqlFiles.Query(query));
        var actual = await Sql.QueryLinesAsync(await databases.EfWithSeedScriptAsync(), SqlFiles.Query(query));

        // Same rows in the same order: these queries have ORDER BY, and the order is part of the answer.
        Assert.Equal(expected, actual);
    }

    [Fact]
    public async Task Feed_and_trending_leave_out_product_only_recipes()
    {
        // DesignDocument.md §3.3: ProductOnly recipes are reachable only through a purchase. Every recipe in a
        // product is one, so the feed is the six free recipes, two from each creator.
        var connectionString = await databases.EfWithSeedScriptAsync();
        var productOnly = (await Sql.QueryAsync(connectionString, "SELECT title FROM recipes WHERE visibility = 'ProductOnly'"))
            .Select(row => row[0]).ToList();

        var feed = await Sql.QueryAsync(connectionString, SqlFiles.Query(1));
        var trending = await Sql.QueryAsync(connectionString, SqlFiles.Query(3));

        Assert.Equal(13, productOnly.Count);
        Assert.Equal(6, feed.Count);
        Assert.Equal(5, trending.Count);
        Assert.DoesNotContain(feed, row => productOnly.Contains(row[1]));
        Assert.DoesNotContain(trending, row => productOnly.Contains(row[0]));
    }

    [Fact]
    public async Task Nobody_has_saved_a_recipe_they_cannot_open()
    {
        // DesignDocument.md §3.3: a ProductOnly recipe is saved only by a cook whose Paid order holds it; nobody
        // saves their own recipe, and the admin saves nothing.
        var rows = await Sql.QueryAsync(await databases.EfWithSeedScriptAsync(), """
            SELECT s.user_id, s.recipe_id
            FROM saved_recipes s JOIN recipes r ON r.id = s.recipe_id
            WHERE r.creator_id = s.user_id
               OR EXISTS (SELECT 1 FROM user_roles ur JOIN roles ro ON ro.id = ur.role_id
                          WHERE ur.user_id = s.user_id AND ro.name = 'Admin')
               OR (r.visibility = 'ProductOnly' AND NOT EXISTS (
                      SELECT 1 FROM orders o
                      JOIN order_items oi ON oi.order_id = o.id
                      JOIN order_item_recipes oir ON oir.order_item_id = oi.id
                      WHERE o.user_id = s.user_id AND o.status = 'Paid' AND oir.recipe_id = s.recipe_id))
            """);

        Assert.Empty(rows);
    }

    [Fact]
    public async Task Meal_plan_counts_a_repeated_recipe_once_as_a_recipe_and_twice_as_a_meal()
    {
        // DesignDocument.md §3.2: overnight oats on day 0 and day 3 of "Family Week on a Budget".
        var rows = await Sql.QueryAsync(await databases.EfWithSeedScriptAsync(), SqlFiles.Query(5));

        var plan = Assert.Single(rows);
        Assert.Equal(["MealPlan", "Family Week on a Budget", "9.99", "5", "6"], plan);
    }

    [Fact]
    public async Task Shopping_list_has_41_lines_with_flour_in_grams_and_milk_in_millilitres()
    {
        // DesignDocument.md §3.6 and §7: liquids are no longer dropped, and the flour example adds up.
        var rows = await Sql.QueryAsync(await databases.EfWithSeedScriptAsync(), SqlFiles.Query(8));

        Assert.Equal(41, rows.Count);
        Assert.Contains(["Pantry", "all-purpose flour", "1032.91", "g"], rows);
        Assert.Contains(["Dairy", "whole milk", "946.35", "ml"], rows);
    }

    [Fact]
    public async Task Creator_earnings_attribute_a_creator_buyers_purchase_to_the_seller()
    {
        // DesignDocument.md §3.1: Dan bought Kenji's plan; the sale is Kenji's.
        var rows = await Sql.QueryAsync(await databases.EfWithSeedScriptAsync(), SqlFiles.Query(10));

        Assert.Contains(["kenji-kitchen", "3", "38.97"], rows);
    }

    [Fact]
    public async Task Buyer_keeps_a_recipe_the_creator_later_removed_from_the_product()
    {
        // DesignDocument.md §3.3: Alex's purchase still includes the focaccia Maria removed.
        var rows = await Sql.QueryAsync(await databases.EfWithSeedScriptAsync(), SqlFiles.Query(15));

        Assert.Equal(4, rows.Count);
        Assert.Contains(["No-Knead Focaccia", "True", "False"], rows);
        Assert.All(rows.Where(row => row[0] != "No-Knead Focaccia"), row => Assert.Equal(["True", "True"], row[1..]));
    }

    [Fact]
    public async Task Every_save_count_matches_its_save_rows()
    {
        // DesignDocument.md §3.4: Q16 returns the recipes whose counter is wrong; there must be none.
        var rows = await Sql.QueryAsync(await databases.EfWithSeedScriptAsync(), SqlFiles.Query(16));

        Assert.Empty(rows);
    }
}
