using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Cookfeed.Contracts.Products;
using Cookfeed.Contracts.Storefront;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// <c>GET /api/creators/{handle}</c> over HTTP, against the database <c>DbSeeder</c> builds. Counts and product
/// lines are held to <c>docs/sql/queries.sql</c> Q2 and Q5 run on the same database. The tests that change rows
/// (a suspended creator, a recipe taken down) build their own database.
/// </summary>
public sealed class StorefrontEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    private CookfeedApiFactory? _api;
    private string? _changed;

    public static TheoryData<string> Handles => ["maria-cooks", "kenji-kitchen", "dan-meal-preps"];

    [Fact]
    public async Task An_unknown_handle_is_404()
    {
        var response = await SendAsync("/api/creators/nobody-here");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task The_header_shows_the_creator_as_stored()
    {
        var expected = await Sql.QueryLinesAsync(await ConnectionStringAsync(), """
            SELECT c.handle, u.display_name, c.bio, c.avatar_url, c.is_verified
            FROM creator_profiles c JOIN users u ON c.user_id = u.id
            WHERE c.handle = 'maria-cooks'
            """);

        var s = await GetStorefrontAsync("maria-cooks");

        Assert.Equal(expected, [string.Join(" | ", s.Handle, s.DisplayName, s.Bio, s.AvatarUrl, s.IsVerified ? "True" : "False")]);
    }

    [Theory]
    [MemberData(nameof(Handles))]
    public async Task Lists_only_the_creators_public_published_recipes_newest_first(string handle)
    {
        var expected = await Sql.QueryAsync(await ConnectionStringAsync(), $"""
            SELECT r.id FROM recipes r JOIN creator_profiles c ON r.creator_id = c.user_id
            WHERE c.handle = '{handle}' AND r.is_published AND r.visibility = 'Public'
            ORDER BY r.published_at DESC, r.id DESC
            """);

        var s = await GetStorefrontAsync(handle);

        Assert.Equal(expected.Select(row => int.Parse(row[0]!)), s.Recipes.Select(r => r.Id));
    }

    [Theory]
    [MemberData(nameof(Handles))]
    public async Task Recipe_count_and_total_saves_match_Q2(string handle)
    {
        var q2 = await Sql.QueryAsync(await ConnectionStringAsync(), SqlFiles.Query(2));
        var row = Assert.Single(q2, r => r[0] == handle);

        var s = await GetStorefrontAsync(handle);

        Assert.Equal(row[1], s.RecipeCount.ToString(CultureInfo.InvariantCulture));
        Assert.Equal(row[2], s.TotalSaves.ToString(CultureInfo.InvariantCulture));
    }

    [Fact]
    public async Task Products_match_Q5_active_only_in_creation_order_with_distinct_recipes_and_meals()
    {
        // Q5 is written for dan-meal-preps: a meal plan that schedules one recipe twice, and a retired product.
        var expected = await Sql.QueryLinesAsync(await ConnectionStringAsync(), SqlFiles.Query(5));

        var s = await GetStorefrontAsync("dan-meal-preps");

        var actual = s.Products.Select(p => string.Join(" | ", p.Type, p.Title,
            (p.PriceCents / 100m).ToString("0.00", CultureInfo.InvariantCulture), p.RecipeCount, p.MealCount ?? 0));
        Assert.Equal(expected, actual);
    }

    [Fact]
    public async Task A_meal_plan_counts_meals_and_a_collection_does_not()
    {
        var s = await GetStorefrontAsync("dan-meal-preps");

        Assert.All(s.Products, p => Assert.Equal(p.Type == ProductType.MealPlan, p.MealCount is not null));
    }

    [Theory]
    [MemberData(nameof(Handles))]
    public async Task A_viewer_owns_exactly_the_products_they_have_a_paid_order_for(string handle)
    {
        const int viewer = 1;
        var paid = await Sql.QueryAsync(await ConnectionStringAsync(), $"""
            SELECT DISTINCT oi.product_id FROM order_items oi JOIN orders o ON oi.order_id = o.id
            WHERE o.user_id = {viewer} AND o.status = 'Paid'
            """);
        var paidIds = paid.Select(row => int.Parse(row[0]!)).ToHashSet();

        var s = await GetStorefrontAsync(handle, viewerId: viewer);

        Assert.All(s.Products, p => Assert.Equal(paidIds.Contains(p.Id), p.OwnedByViewer));
    }

    [Fact]
    public async Task A_cancelled_order_does_not_count_as_owning()
    {
        // Alex (user 1) cancelled the order for The Bread Box and paid for the Roman Pasta Collection.
        var s = await GetStorefrontAsync("maria-cooks", viewerId: 1);

        Assert.True(Assert.Single(s.Products, p => p.Title == "Roman Pasta Collection").OwnedByViewer);
        Assert.False(Assert.Single(s.Products, p => p.Title == "The Bread Box").OwnedByViewer);
    }

    [Fact]
    public async Task Without_a_viewer_nothing_is_owned_and_the_viewer_is_not_the_creator()
    {
        var s = await GetStorefrontAsync("maria-cooks");

        Assert.NotEmpty(s.Products);
        Assert.DoesNotContain(s.Products, p => p.OwnedByViewer);
        Assert.False(s.ViewerIsCreator);
    }

    [Theory]
    [InlineData(3, true)]    // Maria herself
    [InlineData(1, false)]   // a home cook
    public async Task Viewer_is_creator_only_on_their_own_storefront(int viewer, bool expected)
    {
        var s = await GetStorefrontAsync("maria-cooks", viewerId: viewer);

        Assert.Equal(expected, s.ViewerIsCreator);
    }

    [Fact]
    public async Task A_handle_typed_with_capitals_still_finds_the_creator()
    {
        var s = await GetStorefrontAsync("Maria-Cooks");

        Assert.Equal("maria-cooks", s.Handle);
    }

    [Theory]
    [InlineData("%E2%84%AAenji-kitchen")]   // the Kelvin sign, which ToLowerInvariant would fold to "k"
    [InlineData("kenji_kitchen")]
    [InlineData("kenji%20kitchen")]
    public async Task A_handle_that_is_not_letters_digits_and_hyphens_is_404(string handle)
    {
        var response = await SendAsync($"/api/creators/{handle}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Product_types_are_sent_as_names()
    {
        var response = await SendAsync("/api/creators/dan-meal-preps");

        Assert.Contains("\"type\":\"MealPlan\"", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task A_viewer_id_that_is_not_a_number_is_refused_with_400()
    {
        var response = await SendAsync("/api/creators/maria-cooks", viewerHeader: "alex");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Each_recipe_card_carries_its_servings()
    {
        var expected = await Sql.QueryLinesAsync(await ConnectionStringAsync(), """
            SELECT r.id, r.servings FROM recipes r JOIN creator_profiles c ON r.creator_id = c.user_id
            WHERE c.handle = 'kenji-kitchen' AND r.is_published AND r.visibility = 'Public'
            ORDER BY r.published_at DESC, r.id DESC
            """);

        var s = await GetStorefrontAsync("kenji-kitchen");

        Assert.NotEmpty(expected);
        Assert.Equal(expected, s.Recipes.Select(r => $"{r.Id} | {r.Servings}"));
    }

    [Theory]
    [MemberData(nameof(Handles))]
    public async Task No_seeded_creator_is_suspended(string handle)
    {
        Assert.False((await GetStorefrontAsync(handle)).IsSuspended);
    }

    [Fact]
    public async Task A_suspended_creator_keeps_the_storefront_and_its_recipes_and_sells_nothing()
    {
        // DesignDocument.md §3.8: the page still opens and says so, the free recipes stay, and nothing is for sale.
        await using var api = new CookfeedApiFactory(await ChangedDatabaseAsync());

        var s = await GetStorefrontAsync(api, "dan-meal-preps");

        Assert.True(s.IsSuspended);
        Assert.NotEmpty(s.Recipes);
        Assert.Empty(s.Products);
    }

    [Theory]
    [InlineData("maria-cooks", new[] { 1, 2 })]
    [InlineData("kenji-kitchen", new int[0])]      // Three Weeknights holds the onigiri that was taken down
    [InlineData("dan-meal-preps", new int[0])]     // suspended
    public async Task The_storefront_lists_exactly_the_products_whose_own_page_says_for_sale(string handle, int[] expected)
    {
        // One rule, read in three places: the storefront, the list of plans, and each plan's page.
        await using var api = new CookfeedApiFactory(await ChangedDatabaseAsync());

        var listed = (await GetStorefrontAsync(api, handle)).Products.Select(p => p.Id).ToList();

        Assert.Equal(expected, listed);
        foreach (var id in listed)
        {
            var page = await api.CreateClient().GetFromJsonAsync<ProductDetailDto>($"/api/products/{id}",
                TestContext.Current.CancellationToken);
            Assert.True(page!.IsForSale, $"product {id}");
        }
    }

    [Theory]
    [InlineData(2, new[] { "The Bread Box" })]   // Priya's seeded cart
    [InlineData(1, new string[0])]               // Alex's cart is empty
    [InlineData(null, new string[0])]            // a visitor has no cart
    public async Task A_product_says_whether_it_is_in_the_viewers_cart(int? viewer, string[] inCart)
    {
        var s = await GetStorefrontAsync("maria-cooks", viewer);

        Assert.Equal(inCart, s.Products.Where(p => p.InCart).Select(p => p.Title));
    }

    // The seed with Dan suspended and the onigiri (recipe 6, in Three Weeknights) taken down.
    private async Task<string> ChangedDatabaseAsync()
    {
        _changed ??= await CreateChangedDatabaseAsync();
        return _changed;
    }

    private async Task<string> CreateChangedDatabaseAsync()
    {
        var connection = await databases.CreateMigratedDatabaseAsync("storefront");
        await DatabaseFixture.SeedWithDbSeederAsync(connection);
        await Sql.ExecuteAsync(connection, """
            UPDATE creator_profiles SET suspended_at = now() WHERE user_id = 5;
            UPDATE recipes SET is_published = FALSE WHERE id = 6;
            """);
        return connection;
    }

    private static async Task<StorefrontDto> GetStorefrontAsync(CookfeedApiFactory api, string handle)
    {
        var response = await api.CreateClient().GetAsync($"/api/creators/{handle}", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<StorefrontDto>(TestContext.Current.CancellationToken))!;
    }

    private async Task<StorefrontDto> GetStorefrontAsync(string handle, int? viewerId = null)
    {
        var response = await SendAsync($"/api/creators/{handle}", viewerId?.ToString());

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<StorefrontDto>(TestContext.Current.CancellationToken))!;
    }

    private async Task<HttpResponseMessage> SendAsync(string url, string? viewerHeader = null)
    {
        _api ??= new CookfeedApiFactory(await ConnectionStringAsync());
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (viewerHeader is not null)
        {
            request.Headers.Add("X-User-Id", viewerHeader);
        }
        return await _api.CreateClient().SendAsync(request, TestContext.Current.CancellationToken);
    }

    private Task<string> ConnectionStringAsync() => databases.EfWithDbSeederAsync();

    public async ValueTask DisposeAsync()
    {
        if (_api is not null)
        {
            await _api.DisposeAsync();
        }
    }
}
