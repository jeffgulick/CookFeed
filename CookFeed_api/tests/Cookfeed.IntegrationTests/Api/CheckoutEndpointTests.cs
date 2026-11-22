using System.Net;
using System.Net.Http.Json;
using Cookfeed.Contracts.Cart;
using Cookfeed.Contracts.Orders;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// <c>POST /api/me/checkout</c> over HTTP (DesignDocument.md §6): the cart becomes one Paid order, each line keeps
/// the title, price and seller as they were, every recipe of each product is copied into the purchase snapshot, and
/// the cart is emptied, all or nothing. Payment is simulated. Every test that places an order builds its own
/// database.
/// </summary>
public sealed class CheckoutEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    private const int BreadBox = 2, ThreeWeeknights = 3;
    private const int Priya = 2, Admin = 6, Sam = 7, Noor = 8;
    private readonly Dictionary<string, CookfeedApiFactory> _apis = [];

    [Fact]
    public async Task Checkout_answers_201_with_the_new_paid_order()
    {
        // The seed puts The Bread Box ($4.99, by maria-cooks) in Priya's cart.
        var connectionString = await OwnDatabaseAsync("checkout_order");
        var before = DateTimeOffset.UtcNow.AddSeconds(-5);

        var response = await SendAsync(connectionString, HttpMethod.Post, "/api/me/checkout", Priya);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal("/api/me/orders", response.Headers.Location?.OriginalString);
        var order = (await response.Content.ReadFromJsonAsync<OrderDto>(TestContext.Current.CancellationToken))!;
        Assert.Equal(OrderStatus.Paid, order.Status);
        Assert.Equal(499, order.TotalCents);
        Assert.Equal("USD", order.Currency);
        Assert.InRange(order.PlacedAt, before, DateTimeOffset.UtcNow.AddSeconds(5));
        Assert.Equal(order.PlacedAt, order.PaidAt);
        var item = Assert.Single(order.Items);
        Assert.Equal((BreadBox, "The Bread Box", 499, "maria-cooks"),
            (item.ProductId, item.ProductTitle, item.UnitPriceCents, item.SellerHandle));
    }

    [Fact]
    public async Task Checkout_writes_the_order_its_snapshots_and_empties_the_cart()
    {
        var connectionString = await OwnDatabaseAsync("checkout_rows");
        var bundle = await Sql.QueryLinesAsync(connectionString, $"""
            SELECT recipe_id, sort_order, day_offset, slot FROM product_recipes
            WHERE product_id = {BreadBox} ORDER BY sort_order, recipe_id
            """);

        var response = await SendAsync(connectionString, HttpMethod.Post, "/api/me/checkout", Priya);
        var order = (await response.Content.ReadFromJsonAsync<OrderDto>(TestContext.Current.CancellationToken))!;

        // The order row.
        Assert.Equal([$"{Priya} | Paid | 499 | USD"], await Sql.QueryLinesAsync(connectionString,
            $"SELECT user_id, status, total_cents, currency FROM orders WHERE id = {order.Id}"));
        // The line: the seller, title and price copied from the product.
        Assert.Equal(await Sql.QueryLinesAsync(connectionString,
                $"SELECT id, creator_id, title, price_cents FROM products WHERE id = {BreadBox}"),
            await Sql.QueryLinesAsync(connectionString,
                $"SELECT product_id, creator_id, product_title, unit_price_cents FROM order_items WHERE order_id = {order.Id}"));
        // The recipes the buyer keeps: the product's bundle as it is now, row for row.
        Assert.NotEmpty(bundle);
        Assert.Equal(bundle, await Sql.QueryLinesAsync(connectionString, $"""
            SELECT oir.recipe_id, oir.sort_order, oir.day_offset, oir.slot
            FROM order_item_recipes oir JOIN order_items oi ON oi.id = oir.order_item_id
            WHERE oi.order_id = {order.Id} ORDER BY oir.sort_order, oir.recipe_id
            """));
        // The cart, emptied.
        Assert.Equal("0", await ScalarAsync(connectionString, $"SELECT COUNT(*) FROM cart_items WHERE user_id = {Priya}"));
    }

    [Fact]
    public async Task What_was_bought_is_the_buyers_at_once()
    {
        var connectionString = await OwnDatabaseAsync("checkout_owned");
        var premium = await ScalarAsync(connectionString,
            $"SELECT recipe_id FROM product_recipes WHERE product_id = {BreadBox} ORDER BY sort_order LIMIT 1");
        Assert.Equal(HttpStatusCode.Forbidden,
            (await SendAsync(connectionString, HttpMethod.Get, $"/api/recipes/{premium}", Priya)).StatusCode);

        var placed = await SendAsync(connectionString, HttpMethod.Post, "/api/me/checkout", Priya);
        var order = (await placed.Content.ReadFromJsonAsync<OrderDto>(TestContext.Current.CancellationToken))!;

        // The recipe opens, the order leads the history, the cart is empty, and the product cannot be added again.
        Assert.Equal(HttpStatusCode.OK,
            (await SendAsync(connectionString, HttpMethod.Get, $"/api/recipes/{premium}", Priya)).StatusCode);
        var history = await (await SendAsync(connectionString, HttpMethod.Get, "/api/me/orders", Priya))
            .Content.ReadFromJsonAsync<List<OrderDto>>(TestContext.Current.CancellationToken);
        Assert.Equal(order.Id, history![0].Id);
        var cart = await (await SendAsync(connectionString, HttpMethod.Get, "/api/me/cart", Priya))
            .Content.ReadFromJsonAsync<CartDto>(TestContext.Current.CancellationToken);
        Assert.Empty(cart!.Lines);
        Assert.Equal(HttpStatusCode.Conflict,
            (await SendAsync(connectionString, HttpMethod.Put, $"/api/me/cart/{BreadBox}", Priya)).StatusCode);
    }

    [Fact]
    public async Task Two_products_make_one_order_whose_total_is_their_sum()
    {
        var connectionString = await OwnDatabaseAsync("checkout_two");
        await SendAsync(connectionString, HttpMethod.Put, $"/api/me/cart/{ThreeWeeknights}", Noor);
        await SendAsync(connectionString, HttpMethod.Put, $"/api/me/cart/{BreadBox}", Noor);

        var response = await SendAsync(connectionString, HttpMethod.Post, "/api/me/checkout", Noor);

        var order = (await response.Content.ReadFromJsonAsync<OrderDto>(TestContext.Current.CancellationToken))!;
        Assert.Equal([ThreeWeeknights, BreadBox], order.Items.Select(i => i.ProductId));
        Assert.Equal(1798, order.TotalCents);
        Assert.Equal("1", await ScalarAsync(connectionString, $"SELECT COUNT(*) FROM orders WHERE user_id = {Noor}"));
        // Priya's cart, which also holds The Bread Box, is hers still.
        Assert.Equal("1", await ScalarAsync(connectionString, $"SELECT COUNT(*) FROM cart_items WHERE user_id = {Priya}"));
    }

    [Fact]
    public async Task A_line_that_went_off_sale_is_left_out_of_the_order_and_the_cart_is_still_emptied()
    {
        var connectionString = await OwnDatabaseAsync("checkout_retired_line");
        await SendAsync(connectionString, HttpMethod.Put, $"/api/me/cart/{ThreeWeeknights}", Noor);
        await SendAsync(connectionString, HttpMethod.Put, $"/api/me/cart/{BreadBox}", Noor);
        await Sql.ExecuteAsync(connectionString, $"UPDATE products SET is_active = false WHERE id = {BreadBox}");

        var response = await SendAsync(connectionString, HttpMethod.Post, "/api/me/checkout", Noor);

        var order = (await response.Content.ReadFromJsonAsync<OrderDto>(TestContext.Current.CancellationToken))!;
        Assert.Equal([ThreeWeeknights], order.Items.Select(i => i.ProductId));
        Assert.Equal(1299, order.TotalCents);
        Assert.Equal("0", await ScalarAsync(connectionString, $"SELECT COUNT(*) FROM cart_items WHERE user_id = {Noor}"));
    }

    [Fact]
    public async Task A_cart_with_nothing_left_to_buy_is_a_400_and_nothing_is_written()
    {
        var connectionString = await OwnDatabaseAsync("checkout_nothing_left");
        await Sql.ExecuteAsync(connectionString, $"UPDATE products SET is_active = false WHERE id = {BreadBox}");
        var orders = await ScalarAsync(connectionString, "SELECT COUNT(*) FROM orders");

        var response = await SendAsync(connectionString, HttpMethod.Post, "/api/me/checkout", Priya);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(orders, await ScalarAsync(connectionString, "SELECT COUNT(*) FROM orders"));
        Assert.Equal("1", await ScalarAsync(connectionString, $"SELECT COUNT(*) FROM cart_items WHERE user_id = {Priya}"));
    }

    [Fact]
    public async Task An_empty_cart_is_a_400_and_a_second_checkout_finds_it_empty()
    {
        var connectionString = await OwnDatabaseAsync("checkout_twice");

        var empty = await SendAsync(connectionString, HttpMethod.Post, "/api/me/checkout", Sam);
        var first = await SendAsync(connectionString, HttpMethod.Post, "/api/me/checkout", Priya);
        var second = await SendAsync(connectionString, HttpMethod.Post, "/api/me/checkout", Priya);

        Assert.Equal(HttpStatusCode.BadRequest, empty.StatusCode);
        Assert.Equal("application/problem+json", empty.Content.Headers.ContentType?.MediaType);
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, second.StatusCode);
        Assert.Equal("1", await ScalarAsync(connectionString,
            $"SELECT COUNT(*) FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.user_id = {Priya} AND oi.product_id = {BreadBox}"));
    }

    [Fact]
    public async Task The_admin_cannot_check_out()
    {
        var response = await SendAsync(await databases.EfWithDbSeederAsync(), HttpMethod.Post, "/api/me/checkout", Admin);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task A_new_order_gets_an_id_after_the_seeded_ones()
    {
        var connectionString = await OwnDatabaseAsync("checkout_id");
        var highest = int.Parse((await ScalarAsync(connectionString, "SELECT MAX(id) FROM orders"))!);

        var response = await SendAsync(connectionString, HttpMethod.Post, "/api/me/checkout", Priya);

        var order = (await response.Content.ReadFromJsonAsync<OrderDto>(TestContext.Current.CancellationToken))!;
        Assert.Equal(highest + 1, order.Id);
    }

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
