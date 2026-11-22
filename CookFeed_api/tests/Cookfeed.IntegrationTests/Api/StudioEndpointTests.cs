using System.Net;
using System.Net.Http.Json;
using Cookfeed.Contracts.Feed;
using Cookfeed.Contracts.Products;
using Cookfeed.Contracts.Studio;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// The creator studio over HTTP (<c>/api/me/studio</c>, DesignDocument.md §3.8): a creator sees their own recipes,
/// drafts included, their plans, their sales and the reviews of their plans, and may publish or unpublish a recipe
/// and retire or restore a plan, within the rules. Seed: Kenji (4) has six recipes, one of them the draft Miso Soup
/// with no ingredients, and one plan, Three Weeknights in Japan, sold three times. Tests that write build their own
/// database.
/// </summary>
public sealed class StudioEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    private const int Tamagoyaki = 16, ChickenTeriyaki = 5, MisoSoupDraft = 13, Caprese = 15;
    private const int ThreeWeeknights = 3, BreadBox = 2, SummerGrilling = 5;
    private const int Alex = 1, Maria = 3, Kenji = 4, Dan = 5, Admin = 6;
    private readonly Dictionary<string, CookfeedApiFactory> _apis = [];

    [Fact]
    public async Task A_creator_sees_their_own_recipes_newest_first_drafts_included()
    {
        var connectionString = await databases.EfWithDbSeederAsync();
        var expected = await Sql.QueryLinesAsync(connectionString, $"""
            SELECT r.id, r.title, r.servings, r.is_published, r.visibility, r.save_count
            FROM recipes r WHERE r.creator_id = {Kenji} ORDER BY r.id DESC
            """);

        var studio = await GetStudioAsync(connectionString, Kenji);

        Assert.Equal("kenji-kitchen", studio.Handle);
        Assert.False(studio.IsSuspended);
        Assert.Equal(expected, studio.Recipes.Select(r => string.Join(" | ", r.Id, r.Title, r.Servings,
            r.IsPublished ? "True" : "False", r.Visibility, r.SaveCount)));
        Assert.Contains(studio.Recipes, r => r is { Id: MisoSoupDraft, IsPublished: false });
        // Nobody else's.
        Assert.DoesNotContain(studio.Recipes, r => r.Id == Caprese);
    }

    [Fact]
    public async Task Each_recipe_names_the_plans_it_is_in_and_says_why_its_button_is_off()
    {
        var studio = await GetStudioAsync(await databases.EfWithDbSeederAsync(), Kenji);

        var teriyaki = studio.Recipes.Single(r => r.Id == ChickenTeriyaki);
        Assert.Equal(["Three Weeknights in Japan"], teriyaki.InPlans);
        Assert.Contains("Three Weeknights in Japan", teriyaki.PublishProblem);
        // A draft with nothing to cook cannot be published yet.
        Assert.Contains("ingredient", studio.Recipes.Single(r => r.Id == MisoSoupDraft).PublishProblem);
        // A free recipe no plan holds and nobody bought can be unpublished.
        var tamagoyaki = studio.Recipes.Single(r => r.Id == Tamagoyaki);
        Assert.Empty(tamagoyaki.InPlans);
        Assert.Null(tamagoyaki.PublishProblem);
    }

    [Fact]
    public async Task A_creator_sees_their_plans_with_what_each_holds_and_how_often_it_sold()
    {
        var connectionString = await databases.EfWithDbSeederAsync();
        var expected = await Sql.QueryLinesAsync(connectionString, $"""
            SELECT p.id, p.title, p.type, p.price_cents, p.is_active,
                   (SELECT COUNT(DISTINCT pr.recipe_id) FROM product_recipes pr WHERE pr.product_id = p.id),
                   (SELECT COUNT(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id
                    WHERE oi.product_id = p.id AND o.status = 'Paid')
            FROM products p WHERE p.creator_id = {Dan} ORDER BY p.id DESC
            """);

        var studio = await GetStudioAsync(connectionString, Dan);

        Assert.Equal(2, expected.Count);
        Assert.Equal(expected, studio.Products.Select(p => string.Join(" | ", p.Id, p.Title, p.Type, p.PriceCents,
            p.IsActive ? "True" : "False", p.RecipeCount, p.Sold)));
        // Family Week serves the oats twice; the retired collection has nothing in it, so it cannot be restored.
        Assert.Equal(6, studio.Products.Single(p => p.Id == 4).MealCount);
        var retired = studio.Products.Single(p => p.Id == SummerGrilling);
        Assert.False(retired.IsForSale);
        Assert.Contains("no recipes", retired.RestoreProblem);
    }

    [Fact]
    public async Task The_sales_and_what_they_earned_match_Q10()
    {
        // Q10: paid revenue per creator, from the seller written on each order line.
        var connectionString = await databases.EfWithDbSeederAsync();
        var q10 = (await Sql.QueryAsync(connectionString, SqlFiles.Query(10))).Single(row => row[0] == "kenji-kitchen");

        var studio = await GetStudioAsync(connectionString, Kenji);

        Assert.Equal(int.Parse(q10[1]!), studio.Stats.Sales);
        Assert.Equal(decimal.Parse(q10[2]!, System.Globalization.CultureInfo.InvariantCulture), studio.Stats.EarnedCents / 100m);
        Assert.Equal(studio.Stats.Sales, studio.Sales.Count(s => s.Status == Cookfeed.Contracts.Orders.OrderStatus.Paid));
        Assert.All(studio.Sales, sale => Assert.Equal("Three Weeknights in Japan", sale.ProductTitle));
        // Newest first, each with who bought it.
        Assert.Equal(studio.Sales.OrderByDescending(s => s.PlacedAt).Select(s => s.BuyerName), studio.Sales.Select(s => s.BuyerName));
    }

    [Fact]
    public async Task The_numbers_at_the_top_add_up_from_the_rows()
    {
        var studio = await GetStudioAsync(await databases.EfWithDbSeederAsync(), Kenji);

        Assert.Equal(studio.Recipes.Count(r => r.IsPublished), studio.Stats.PublishedRecipes);
        Assert.Equal(studio.Recipes.Count(r => !r.IsPublished), studio.Stats.Drafts);
        Assert.Equal(studio.Products.Count(p => p.IsForSale), studio.Stats.PlansForSale);
        Assert.Equal(studio.Recipes.Sum(r => r.SaveCount), studio.Stats.Saves);
    }

    [Fact]
    public async Task The_reviews_of_the_creators_plans_are_listed_newest_first()
    {
        var connectionString = await databases.EfWithDbSeederAsync();
        var expected = await Sql.QueryLinesAsync(connectionString, $"""
            SELECT rv.id, u.display_name, rv.rating, p.title
            FROM reviews rv JOIN products p ON p.id = rv.product_id JOIN users u ON u.id = rv.user_id
            WHERE p.creator_id = {Kenji} AND rv.hidden_at IS NULL
            ORDER BY rv.created_at DESC, rv.id DESC
            """);

        var studio = await GetStudioAsync(connectionString, Kenji);

        Assert.NotEmpty(expected);
        Assert.Equal(expected, studio.Reviews.Select(r => string.Join(" | ", r.Id, r.ReviewerName, r.Rating, r.ProductTitle)));
    }

    [Theory]
    [InlineData(Alex)]    // a home cook
    [InlineData(Admin)]
    [InlineData(999)]
    public async Task Only_a_creator_has_a_studio(int caller)
    {
        var connectionString = await databases.EfWithDbSeederAsync();

        Assert.Equal(HttpStatusCode.Forbidden, (await SendAsync(connectionString, HttpMethod.Get, "/api/me/studio", caller)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await SendAsync(connectionString, HttpMethod.Post, $"/api/me/studio/recipes/{Tamagoyaki}/unpublish", caller)).StatusCode);
    }

    [Fact]
    public async Task Unpublishing_takes_a_recipe_out_of_the_store_and_publishing_puts_it_back()
    {
        var connectionString = await OwnDatabaseAsync("studio_publish");

        var unpublished = await PostAsync(connectionString, $"recipes/{Tamagoyaki}/unpublish", Kenji);
        Assert.False(unpublished.Recipes.Single(r => r.Id == Tamagoyaki).IsPublished);
        var feed = await ReadAsync<FeedPageDto>(await SendAsync(connectionString, HttpMethod.Get, "/api/feed?pageSize=50", null));
        Assert.DoesNotContain(feed.Items, i => i.Id == Tamagoyaki);

        var published = await PostAsync(connectionString, $"recipes/{Tamagoyaki}/publish", Kenji);
        Assert.True(published.Recipes.Single(r => r.Id == Tamagoyaki).IsPublished);
        feed = await ReadAsync<FeedPageDto>(await SendAsync(connectionString, HttpMethod.Get, "/api/feed?pageSize=50", null));
        Assert.Contains(feed.Items, i => i.Id == Tamagoyaki);
        // The first date it was published is kept.
        Assert.Equal(await ScalarAsync(await databases.EfWithDbSeederAsync(), $"SELECT published_at FROM recipes WHERE id = {Tamagoyaki}"),
            await ScalarAsync(connectionString, $"SELECT published_at FROM recipes WHERE id = {Tamagoyaki}"));
    }

    [Theory]
    [InlineData("unpublish", ChickenTeriyaki, "Three Weeknights in Japan")]   // in a plan
    [InlineData("publish", MisoSoupDraft, "ingredient")]                      // nothing to cook yet
    public async Task A_change_the_rules_do_not_allow_is_a_409_that_says_why_and_changes_nothing(string action, int recipeId,
        string says)
    {
        var connectionString = await databases.EfWithDbSeederAsync();
        var before = await ScalarAsync(connectionString, $"SELECT is_published FROM recipes WHERE id = {recipeId}");

        var response = await SendAsync(connectionString, HttpMethod.Post, $"/api/me/studio/recipes/{recipeId}/{action}", Kenji);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<Dictionary<string, object>>(TestContext.Current.CancellationToken);
        Assert.Contains(says, problem!["detail"].ToString());
        Assert.Equal(before, await ScalarAsync(connectionString, $"SELECT is_published FROM recipes WHERE id = {recipeId}"));
    }

    [Fact]
    public async Task Retiring_a_plan_takes_it_off_the_store_buyers_keep_it_and_restoring_puts_it_back()
    {
        var connectionString = await OwnDatabaseAsync("studio_retire");

        var retired = await PostAsync(connectionString, $"products/{ThreeWeeknights}/retire", Kenji);
        Assert.False(retired.Products.Single().IsForSale);
        var forSale = await ReadAsync<List<ProductTileDto>>(await SendAsync(connectionString, HttpMethod.Get, "/api/products", null));
        Assert.DoesNotContain(forSale, p => p.Id == ThreeWeeknights);
        // Alex bought it: its premium recipe still opens for him.
        Assert.Equal(HttpStatusCode.OK,
            (await SendAsync(connectionString, HttpMethod.Get, $"/api/recipes/{ChickenTeriyaki}", Alex)).StatusCode);

        var restored = await PostAsync(connectionString, $"products/{ThreeWeeknights}/restore", Kenji);
        Assert.True(restored.Products.Single().IsForSale);
        forSale = await ReadAsync<List<ProductTileDto>>(await SendAsync(connectionString, HttpMethod.Get, "/api/products", null));
        Assert.Contains(forSale, p => p.Id == ThreeWeeknights);
    }

    [Fact]
    public async Task A_plan_with_no_recipes_cannot_go_back_on_sale()
    {
        var connectionString = await databases.EfWithDbSeederAsync();

        var response = await SendAsync(connectionString, HttpMethod.Post, $"/api/me/studio/products/{SummerGrilling}/restore", Dan);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("False", await ScalarAsync(connectionString, $"SELECT is_active FROM products WHERE id = {SummerGrilling}"));
    }

    [Theory]
    [InlineData("recipes/15/unpublish")]    // Maria's recipe
    [InlineData("recipes/999/publish")]
    [InlineData("products/2/retire")]       // Maria's collection
    [InlineData("products/999/restore")]
    public async Task Another_creators_recipe_or_plan_is_not_found_and_is_not_changed(string route)
    {
        var connectionString = await databases.EfWithDbSeederAsync();

        var response = await SendAsync(connectionString, HttpMethod.Post, $"/api/me/studio/{route}", Kenji);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("True", await ScalarAsync(connectionString, $"SELECT is_published FROM recipes WHERE id = {Caprese}"));
        Assert.Equal("True", await ScalarAsync(connectionString, $"SELECT is_active FROM products WHERE id = {BreadBox}"));
    }

    private async Task<StudioDto> GetStudioAsync(string connectionString, int caller)
    {
        var response = await SendAsync(connectionString, HttpMethod.Get, "/api/me/studio", caller);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadAsync<StudioDto>(response);
    }

    private async Task<StudioDto> PostAsync(string connectionString, string route, int caller)
    {
        var response = await SendAsync(connectionString, HttpMethod.Post, $"/api/me/studio/{route}", caller);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadAsync<StudioDto>(response);
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<T>(TestContext.Current.CancellationToken))!;

    private async Task<HttpResponseMessage> SendAsync(string connectionString, HttpMethod method, string url, int? caller)
    {
        if (!_apis.TryGetValue(connectionString, out var api))
        {
            _apis[connectionString] = api = new CookfeedApiFactory(connectionString);
        }

        using var request = new HttpRequestMessage(method, url);
        if (caller is not null)
        {
            request.Headers.Add("X-User-Id", caller.Value.ToString());
        }
        return await api.CreateClient().SendAsync(request, TestContext.Current.CancellationToken);
    }

    private async Task<string> OwnDatabaseAsync(string purpose)
    {
        var connectionString = await databases.CreateMigratedDatabaseAsync(purpose);
        await DatabaseFixture.SeedWithDbSeederAsync(connectionString);
        return connectionString;
    }

    private static async Task<string?> ScalarAsync(string connectionString, string sql) =>
        (await Sql.QueryAsync(connectionString, sql))[0][0];

    public async ValueTask DisposeAsync()
    {
        foreach (var api in _apis.Values)
        {
            await api.DisposeAsync();
        }
    }
}
