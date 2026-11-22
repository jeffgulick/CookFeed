using System.Net;
using System.Net.Http.Json;
using Cookfeed.Contracts.Cart;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// The caller's cart over HTTP: <c>GET /api/me/cart</c>, <c>PUT</c> and <c>DELETE /api/me/cart/{productId}</c>, and
/// <c>DELETE /api/me/cart</c>. A cart holds one copy of a product; only a home cook has one; and a product the
/// caller made, already owns, or that is no longer for sale cannot go in. The tests that only read, or that are
/// refused before anything is written, use the shared seeded database; each test that changes rows builds its own.
/// </summary>
public sealed class CartEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    private const int BreadBox = 2, ThreeWeeknights = 3, SummerGrilling = 5;
    private const int Alex = 1, Priya = 2, Kenji = 4, Admin = 6, Sam = 7, Noor = 8;
    private readonly Dictionary<string, CookfeedApiFactory> _apis = [];

    [Fact]
    public async Task The_cart_lists_the_callers_lines_as_the_products_are_now()
    {
        var connectionString = await databases.EfWithDbSeederAsync();
        var expected = await Sql.QueryLinesAsync(connectionString, $"""
            SELECT p.id, p.type, p.title, p.cover_image_url, c.handle, p.price_cents,
                   (SELECT COUNT(DISTINCT pr.recipe_id) FROM product_recipes pr WHERE pr.product_id = p.id)
            FROM cart_items ci
            JOIN products p ON p.id = ci.product_id
            JOIN creator_profiles c ON c.user_id = p.creator_id
            WHERE ci.user_id = {Priya}
            ORDER BY ci.added_at, p.id
            """);

        var cart = await GetCartAsync(connectionString, Priya);

        Assert.NotEmpty(expected);
        Assert.Equal(expected, cart.Lines.Select(l => string.Join(" | ",
            l.ProductId, l.Type, l.Title, l.CoverImageUrl, l.CreatorHandle, l.PriceCents, l.RecipeCount)));
        Assert.Equal(cart.Lines.Sum(l => l.PriceCents), cart.TotalCents);
        Assert.Equal("USD", cart.Currency);
        Assert.Empty(cart.Unavailable);
    }

    [Fact]
    public async Task A_cook_with_nothing_in_the_cart_gets_an_empty_cart()
    {
        var cart = await GetCartAsync(await databases.EfWithDbSeederAsync(), Sam);

        Assert.Empty(cart.Lines);
        Assert.Equal(0, cart.TotalCents);
    }

    [Fact]
    public async Task Adding_a_product_puts_it_in_the_cart_once_however_often_it_is_asked()
    {
        var connectionString = await OwnDatabaseAsync("cart_add");

        var first = await SendAsync(connectionString, HttpMethod.Put, $"/api/me/cart/{ThreeWeeknights}", Noor);
        var second = await SendAsync(connectionString, HttpMethod.Put, $"/api/me/cart/{ThreeWeeknights}", Noor);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var cart = await ReadCartAsync(second);
        var line = Assert.Single(cart.Lines);
        Assert.Equal((ThreeWeeknights, "Three Weeknights in Japan", 1299, "kenji-kitchen"),
            (line.ProductId, line.Title, line.PriceCents, line.CreatorHandle));
        Assert.Equal(1299, cart.TotalCents);
        Assert.Equal("1", await ScalarAsync(connectionString,
            $"SELECT COUNT(*) FROM cart_items WHERE user_id = {Noor} AND product_id = {ThreeWeeknights}"));
        // The cart is the caller's own: nobody else's changed.
        Assert.Equal("1", await ScalarAsync(connectionString, $"SELECT COUNT(*) FROM cart_items WHERE user_id <> {Noor}"));
    }

    [Fact]
    public async Task Lines_are_listed_in_the_order_they_were_added()
    {
        var connectionString = await OwnDatabaseAsync("cart_order");

        await SendAsync(connectionString, HttpMethod.Put, $"/api/me/cart/{ThreeWeeknights}", Noor);
        var response = await SendAsync(connectionString, HttpMethod.Put, $"/api/me/cart/{BreadBox}", Noor);

        var cart = await ReadCartAsync(response);
        Assert.Equal([ThreeWeeknights, BreadBox], cart.Lines.Select(l => l.ProductId));
        Assert.Equal(1798, cart.TotalCents);
    }

    [Theory]
    [InlineData(Kenji, ThreeWeeknights, HttpStatusCode.BadRequest)]   // his own plan
    [InlineData(Alex, ThreeWeeknights, HttpStatusCode.Conflict)]      // already bought
    [InlineData(Sam, SummerGrilling, HttpStatusCode.Conflict)]        // retired
    [InlineData(Sam, 999, HttpStatusCode.NotFound)]                   // no such product
    [InlineData(Admin, ThreeWeeknights, HttpStatusCode.Forbidden)]    // the admin does not shop
    [InlineData(999, ThreeWeeknights, HttpStatusCode.Forbidden)]      // no such account
    public async Task A_product_the_caller_may_not_buy_is_refused_with_a_reason_and_nothing_is_written(int caller,
        int productId, HttpStatusCode expected)
    {
        var connectionString = await databases.EfWithDbSeederAsync();
        var before = await ScalarAsync(connectionString, "SELECT COUNT(*) FROM cart_items");

        var response = await SendAsync(connectionString, HttpMethod.Put, $"/api/me/cart/{productId}", caller);

        Assert.Equal(expected, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(before, await ScalarAsync(connectionString, "SELECT COUNT(*) FROM cart_items"));
    }

    [Fact]
    public async Task A_refusal_says_why_in_words_the_app_can_show()
    {
        var response = await SendAsync(await databases.EfWithDbSeederAsync(), HttpMethod.Put,
            $"/api/me/cart/{ThreeWeeknights}", Kenji);

        var problem = await response.Content.ReadFromJsonAsync<Dictionary<string, object>>(TestContext.Current.CancellationToken);
        Assert.Contains("own", problem!["detail"].ToString());
    }

    [Theory]
    [InlineData("GET", "/api/me/cart")]
    [InlineData("DELETE", "/api/me/cart")]
    [InlineData("DELETE", "/api/me/cart/2")]
    public async Task The_admin_has_no_cart(string method, string url)
    {
        var response = await SendAsync(await databases.EfWithDbSeederAsync(), new HttpMethod(method), url, Admin);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Taking_a_product_out_removes_only_that_line_and_asking_again_changes_nothing()
    {
        var connectionString = await OwnDatabaseAsync("cart_remove");
        await SendAsync(connectionString, HttpMethod.Put, $"/api/me/cart/{ThreeWeeknights}", Noor);
        await SendAsync(connectionString, HttpMethod.Put, $"/api/me/cart/{BreadBox}", Noor);

        var first = await SendAsync(connectionString, HttpMethod.Delete, $"/api/me/cart/{BreadBox}", Noor);
        var second = await SendAsync(connectionString, HttpMethod.Delete, $"/api/me/cart/{BreadBox}", Noor);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Equal([ThreeWeeknights], (await ReadCartAsync(second)).Lines.Select(l => l.ProductId));
        // Priya's line for the same product is untouched.
        Assert.Equal("1", await ScalarAsync(connectionString,
            $"SELECT COUNT(*) FROM cart_items WHERE user_id = {Priya} AND product_id = {BreadBox}"));
    }

    [Fact]
    public async Task Emptying_the_cart_removes_every_line_of_the_caller_and_nobody_elses()
    {
        var connectionString = await OwnDatabaseAsync("cart_clear");
        await SendAsync(connectionString, HttpMethod.Put, $"/api/me/cart/{ThreeWeeknights}", Noor);
        await SendAsync(connectionString, HttpMethod.Put, $"/api/me/cart/{BreadBox}", Noor);

        var response = await SendAsync(connectionString, HttpMethod.Delete, "/api/me/cart", Noor);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Empty((await ReadCartAsync(response)).Lines);
        Assert.Equal("0", await ScalarAsync(connectionString, $"SELECT COUNT(*) FROM cart_items WHERE user_id = {Noor}"));
        Assert.Equal("1", await ScalarAsync(connectionString, $"SELECT COUNT(*) FROM cart_items WHERE user_id = {Priya}"));
    }

    [Fact]
    public async Task A_line_whose_product_went_off_sale_is_named_and_left_out_of_the_total()
    {
        var connectionString = await OwnDatabaseAsync("cart_unavailable");
        await Sql.ExecuteAsync(connectionString, $"UPDATE products SET is_active = false WHERE id = {BreadBox}");

        var cart = await GetCartAsync(connectionString, Priya);

        Assert.Empty(cart.Lines);
        Assert.Equal(0, cart.TotalCents);
        Assert.Equal(["The Bread Box"], cart.Unavailable);
    }

    private async Task<CartDto> GetCartAsync(string connectionString, int caller)
    {
        var response = await SendAsync(connectionString, HttpMethod.Get, "/api/me/cart", caller);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadCartAsync(response);
    }

    private static async Task<CartDto> ReadCartAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<CartDto>(TestContext.Current.CancellationToken))!;

    private async Task<HttpResponseMessage> SendAsync(string connectionString, HttpMethod method, string url, int caller)
    {
        if (!_apis.TryGetValue(connectionString, out var api))
        {
            _apis[connectionString] = api = new CookfeedApiFactory(connectionString);
        }

        using var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-User-Id", caller.ToString());
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
