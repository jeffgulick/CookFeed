using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Cookfeed.Contracts.Products;
using Cookfeed.Contracts.Storefront;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// <c>GET /api/products</c> over HTTP: every meal plan and collection for sale, as the tiles on Discover and on the
/// Plans page show them (the prototype's <c>productTileHtml</c>). For sale follows <c>rules.js</c> <c>isForSale</c>:
/// active, its creator not suspended, at least one recipe and none taken down (DesignDocument.md §3.8). The test that
/// changes rows builds its own database.
/// </summary>
public sealed class ProductListEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    private const int RomanPasta = 1, BreadBox = 2, ThreeWeeknights = 3, FamilyWeek = 4, RetiredGrilling = 5;
    private const int Alex = 1, Dan = 5, Sam = 7;
    private const string ForSale = """
        p.is_active AND c.suspended_at IS NULL
        AND EXISTS (SELECT 1 FROM product_recipes pr WHERE pr.product_id = p.id)
        AND NOT EXISTS (SELECT 1 FROM product_recipes pr JOIN recipes r ON r.id = pr.recipe_id
                        WHERE pr.product_id = p.id AND NOT r.is_published)
        """;
    private CookfeedApiFactory? _api;

    [Fact]
    public async Task Lists_the_products_for_sale_newest_first_with_each_tiles_fields()
    {
        var expected = await Sql.QueryLinesAsync(await ConnectionStringAsync(), $"""
            SELECT p.id, p.type, p.title, p.cover_image_url, p.price_cents, p.currency, c.handle
            FROM products p JOIN creator_profiles c ON c.user_id = p.creator_id
            WHERE {ForSale}
            ORDER BY p.created_at DESC, p.id DESC
            """);

        var products = await GetProductsAsync();

        Assert.Equal(4, expected.Count);
        Assert.Equal(expected, products.Select(p => string.Join(" | ", p.Id, p.Type, p.Title, p.CoverImageUrl,
            p.PriceCents, p.Currency, p.CreatorHandle)));
    }

    [Fact]
    public async Task A_retired_product_is_not_listed()
    {
        Assert.DoesNotContain(await GetProductsAsync(), p => p.Id == RetiredGrilling);
    }

    [Fact]
    public async Task Each_tile_counts_recipes_and_meals_as_its_page_does()
    {
        var products = await GetProductsAsync();

        Assert.Equal((5, 6), Counts(products, FamilyWeek));        // the oats are served twice (Q5)
        Assert.Equal((3, 3), Counts(products, ThreeWeeknights));
        Assert.Equal((3, null), Counts(products, RomanPasta));     // a collection counts no meals
    }

    [Fact]
    public async Task Each_tile_carries_the_rating_of_Q13_or_none()
    {
        var q13 = Assert.Single(await Sql.QueryAsync(await ConnectionStringAsync(), SqlFiles.Query(13)));

        var products = await GetProductsAsync();

        var rated = Assert.Single(products, p => p.Id == ThreeWeeknights).Rating;
        Assert.Equal((q13[1], q13[2]), (rated.ReviewCount.ToString(CultureInfo.InvariantCulture),
            rated.Average?.ToString("0.0", CultureInfo.InvariantCulture)));
        Assert.All(products.Where(p => p.Id != ThreeWeeknights),
            p => Assert.Equal((0, null), (p.Rating.ReviewCount, p.Rating.Average)));
    }

    [Theory]
    [InlineData("MealPlan", new[] { FamilyWeek, ThreeWeeknights })]
    [InlineData("RecipeCollection", new[] { BreadBox, RomanPasta })]
    public async Task The_type_filter_keeps_only_that_type(string type, int[] expected)
    {
        var products = await GetProductsAsync($"?type={type}");

        Assert.Equal(expected, products.Select(p => p.Id));
        Assert.All(products, p => Assert.Equal(type, p.Type.ToString()));
    }

    [Fact]
    public async Task Sorted_by_price_the_cheapest_comes_first()
    {
        var expected = await Sql.QueryAsync(await ConnectionStringAsync(), $"""
            SELECT p.id FROM products p JOIN creator_profiles c ON c.user_id = p.creator_id
            WHERE {ForSale} ORDER BY p.price_cents, p.id
            """);

        var products = await GetProductsAsync("?sort=Price");

        Assert.Equal(expected.Select(row => int.Parse(row[0]!, CultureInfo.InvariantCulture)), products.Select(p => p.Id));
    }

    [Fact]
    public async Task Sorted_by_rating_the_best_rated_comes_first_and_the_unrated_follow_by_id()
    {
        var products = await GetProductsAsync("?sort=Rating");

        Assert.Equal([ThreeWeeknights, RomanPasta, BreadBox, FamilyWeek], products.Select(p => p.Id));
    }

    [Theory]
    [InlineData("?type=Bundle")]
    [InlineData("?sort=Cheapest")]
    public async Task A_type_or_sort_that_is_not_one_of_the_names_is_refused_with_400(string query)
    {
        var response = await SendAsync(_api ??= new CookfeedApiFactory(await ConnectionStringAsync()), "/api/products" + query, null);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData(Alex, new[] { RomanPasta, ThreeWeeknights, FamilyWeek })]
    [InlineData(Dan, new[] { ThreeWeeknights })]
    [InlineData(Sam, new int[0])]
    [InlineData(null, new int[0])]
    public async Task A_viewer_owns_exactly_the_products_they_have_a_paid_order_for(int? viewer, int[] owned)
    {
        var products = await GetProductsAsync(viewer: viewer);

        Assert.Equal(owned.Order(), products.Where(p => p.OwnedByViewer).Select(p => p.Id).Order());
    }

    [Fact]
    public async Task The_list_and_each_products_page_agree_on_what_is_for_sale()
    {
        // One rule, read in two places: the list's filter and the page's isForSale flag must never disagree.
        var connection = await OwnSeededDatabaseAsync("forsale");
        await Sql.ExecuteAsync(connection, $"""
            UPDATE creator_profiles SET suspended_at = now() WHERE user_id = {Dan};
            UPDATE recipes SET is_published = FALSE WHERE id = 6;
            """);
        await using var api = new CookfeedApiFactory(connection);

        var listed = (await GetProductsAsync(api)).Select(p => p.Id).ToHashSet();

        // Dan is suspended (Family Week), and Three Weeknights holds the onigiri that was taken down.
        Assert.Equal([RomanPasta, BreadBox], listed.Order());
        foreach (var id in new[] { RomanPasta, BreadBox, ThreeWeeknights, FamilyWeek, RetiredGrilling })
        {
            var page = await (await SendAsync(api, $"/api/products/{id}", null)).Content
                .ReadFromJsonAsync<ProductDetailDto>(TestContext.Current.CancellationToken);
            Assert.True(listed.Contains(id) == page!.IsForSale, $"product {id}");
        }
    }

    [Fact]
    public async Task A_viewer_id_that_is_not_a_number_is_refused_with_400()
    {
        var response = await SendAsync(_api ??= new CookfeedApiFactory(await ConnectionStringAsync()), "/api/products", "alex");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private static (int, int?) Counts(List<ProductTileDto> products, int id)
    {
        var tile = Assert.Single(products, p => p.Id == id);
        return (tile.RecipeCount, tile.MealCount);
    }

    private async Task<string> OwnSeededDatabaseAsync(string purpose)
    {
        var connection = await databases.CreateMigratedDatabaseAsync(purpose);
        await DatabaseFixture.SeedWithDbSeederAsync(connection);
        return connection;
    }

    private async Task<List<ProductTileDto>> GetProductsAsync(string query = "", int? viewer = null)
    {
        _api ??= new CookfeedApiFactory(await ConnectionStringAsync());
        return await GetProductsAsync(_api, query, viewer);
    }

    private static async Task<List<ProductTileDto>> GetProductsAsync(CookfeedApiFactory api, string query = "", int? viewer = null)
    {
        var response = await SendAsync(api, "/api/products" + query, viewer?.ToString(CultureInfo.InvariantCulture));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<List<ProductTileDto>>(TestContext.Current.CancellationToken))!;
    }

    private static async Task<HttpResponseMessage> SendAsync(CookfeedApiFactory api, string url, string? viewerHeader)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (viewerHeader is not null)
        {
            request.Headers.Add("X-User-Id", viewerHeader);
        }
        return await api.CreateClient().SendAsync(request, TestContext.Current.CancellationToken);
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
