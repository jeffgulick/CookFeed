using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Cookfeed.Contracts.Purchases;
using Cookfeed.Contracts.Storefront;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// <c>GET /api/me/purchases</c> over HTTP: the plans and collections the caller owns through Paid orders, each with
/// the recipes it held when they bought it (the prototype's "Your plans" in My kitchen). Held to
/// <c>queries.sql</c> Q11 and Q15: it reads the purchase snapshot, so a later edit to the product changes nothing.
/// The test that changes rows builds its own database.
/// </summary>
public sealed class MyPurchasesEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    private const int RomanPasta = 1, BreadBox = 2, ThreeWeeknights = 3, FamilyWeek = 4;
    private const int Alex = 1, Priya = 2, Dan = 5, Admin = 6, Sam = 7;
    private CookfeedApiFactory? _api;

    [Fact]
    public async Task The_recipes_a_buyer_owns_match_Q11()
    {
        // Q11 is written for Priya: each recipe she owns, its visibility, and the product it came with.
        var expected = await Sql.QueryLinesAsync(await ConnectionStringAsync(), SqlFiles.Query(11));

        var purchases = await GetPurchasesAsync(Priya);

        var actual = purchases
            .SelectMany(p => p.Recipes.Select(r => (r.Title, r.Visibility, Via: p.Title)))
            .Distinct()
            .OrderBy(x => x.Via, StringComparer.Ordinal).ThenBy(x => x.Title, StringComparer.Ordinal)
            .Select(x => $"{x.Title} | {x.Visibility} | {x.Via}");
        Assert.NotEmpty(expected);
        Assert.Equal(expected, actual);
    }

    [Theory]
    [InlineData(Alex)]
    [InlineData(Priya)]
    [InlineData(Dan)]
    public async Task Each_product_bought_is_listed_once_in_order_line_order_as_it_was_titled_then(int caller)
    {
        var expected = await Sql.QueryLinesAsync(await ConnectionStringAsync(), $"""
            SELECT oi.product_id, p.type, oi.product_title, p.cover_image_url
            FROM order_items oi JOIN orders o ON o.id = oi.order_id JOIN products p ON p.id = oi.product_id
            WHERE o.user_id = {caller} AND o.status = 'Paid'
            ORDER BY oi.id
            """);

        var purchases = await GetPurchasesAsync(caller);

        Assert.NotEmpty(expected);
        Assert.Equal(expected, purchases.Select(p => string.Join(" | ", p.ProductId, p.Type, p.Title, p.CoverImageUrl)));
    }

    [Fact]
    public async Task Each_purchase_carries_the_date_of_its_order()
    {
        var expected = await Sql.QueryAsync(await ConnectionStringAsync(), $"""
            SELECT oi.product_id, to_char(o.placed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS')
            FROM order_items oi JOIN orders o ON o.id = oi.order_id
            WHERE o.user_id = {Alex} AND o.status = 'Paid' ORDER BY oi.id
            """);

        var purchases = await GetPurchasesAsync(Alex);

        Assert.Equal(expected.Select(row => $"{row[0]} | {row[1]}"), purchases.Select(p =>
            $"{p.ProductId} | {p.PurchasedAt.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss", CultureInfo.InvariantCulture)}"));
    }

    [Theory]
    [InlineData(RomanPasta)]
    [InlineData(ThreeWeeknights)]
    [InlineData(FamilyWeek)]
    public async Task The_recipes_are_the_purchase_snapshot_in_its_order_with_day_and_meal(int productId)
    {
        var expected = await Sql.QueryLinesAsync(await ConnectionStringAsync(), $"""
            SELECT oir.sort_order, oir.day_offset, oir.slot, r.id, r.title, r.thumbnail_url
            FROM order_item_recipes oir
            JOIN order_items oi ON oi.id = oir.order_item_id JOIN orders o ON o.id = oi.order_id
            JOIN recipes r ON r.id = oir.recipe_id
            WHERE o.user_id = {Alex} AND o.status = 'Paid' AND oi.product_id = {productId}
            ORDER BY oir.sort_order
            """);

        var purchase = Assert.Single(await GetPurchasesAsync(Alex), p => p.ProductId == productId);

        Assert.Equal(expected, purchase.Recipes.Select(r =>
            string.Join(" | ", r.SortOrder, r.DayOffset, r.Slot, r.RecipeId, r.Title, r.ThumbnailUrl)));
    }

    [Fact]
    public async Task A_buyer_keeps_a_recipe_the_creator_has_since_taken_out_of_the_product()
    {
        // Q15: Alex bought Roman Pasta Collection when it still held No-Knead Focaccia.
        var romanPasta = Assert.Single(await GetPurchasesAsync(Alex), p => p.ProductId == RomanPasta);

        Assert.Contains(romanPasta.Recipes, r => r.Title == "No-Knead Focaccia");
        Assert.Equal((4, null), (romanPasta.RecipeCount, romanPasta.MealCount));
    }

    [Fact]
    public async Task A_meal_plan_counts_its_distinct_recipes_and_every_meal()
    {
        var familyWeek = Assert.Single(await GetPurchasesAsync(Alex), p => p.ProductId == FamilyWeek);

        Assert.Equal(ProductType.MealPlan, familyWeek.Type);
        Assert.Equal((5, 6), (familyWeek.RecipeCount, familyWeek.MealCount));
    }

    [Fact]
    public async Task A_cancelled_order_buys_nothing()
    {
        // Alex's order for The Bread Box was cancelled.
        Assert.DoesNotContain(await GetPurchasesAsync(Alex), p => p.ProductId == BreadBox);
    }

    [Theory]
    [InlineData(Sam)]      // a cook with no orders
    [InlineData(Admin)]    // the admin never buys
    public async Task A_caller_who_has_bought_nothing_gets_an_empty_list(int caller)
    {
        Assert.Empty(await GetPurchasesAsync(caller));
    }

    [Fact]
    public async Task A_purchase_keeps_its_title_after_a_rename_and_a_refund_takes_it_away()
    {
        var connection = await databases.CreateMigratedDatabaseAsync("purchases");
        await DatabaseFixture.SeedWithDbSeederAsync(connection);
        await using var api = new CookfeedApiFactory(connection);

        await Sql.ExecuteAsync(connection, $"UPDATE products SET title = 'Tokyo Weeknights' WHERE id = {ThreeWeeknights}");
        var renamed = await GetPurchasesAsync(api, Dan);

        await Sql.ExecuteAsync(connection, $"UPDATE orders SET status = 'Refunded' WHERE user_id = {Dan}");
        var refunded = await GetPurchasesAsync(api, Dan);

        Assert.Equal("Three Weeknights in Japan", Assert.Single(renamed).Title);
        Assert.Empty(refunded);
    }

    [Fact]
    public async Task Types_and_meals_are_sent_as_names()
    {
        var response = await SendAsync(Alex.ToString(CultureInfo.InvariantCulture));
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Contains("\"type\":\"MealPlan\"", body);
        Assert.Contains("\"slot\":\"Dinner\"", body);
    }

    private async Task<List<PurchaseDto>> GetPurchasesAsync(int caller)
    {
        _api ??= new CookfeedApiFactory(await ConnectionStringAsync());
        return await GetPurchasesAsync(_api, caller);
    }

    private static async Task<List<PurchaseDto>> GetPurchasesAsync(CookfeedApiFactory api, int caller)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/me/purchases");
        request.Headers.Add("X-User-Id", caller.ToString(CultureInfo.InvariantCulture));
        var response = await api.CreateClient().SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<List<PurchaseDto>>(TestContext.Current.CancellationToken))!;
    }

    private async Task<HttpResponseMessage> SendAsync(string? callerHeader)
    {
        _api ??= new CookfeedApiFactory(await ConnectionStringAsync());
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/me/purchases");
        if (callerHeader is not null)
        {
            request.Headers.Add("X-User-Id", callerHeader);
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
