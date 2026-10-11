using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Cookfeed.Contracts.Orders;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// <c>GET /api/me/orders</c> over HTTP. The caller is the <c>X-User-Id</c> header until login exists
/// (DesignDocument.md §9); no route takes a user id, so a caller can only read their own orders. Lines are held
/// to <c>docs/sql/queries.sql</c> Q9 run on the same database. Every test but the snapshot one only reads the
/// shared DbSeeder database; that one changes a product, so it builds a database of its own.
/// </summary>
public sealed class OrderHistoryEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    // One in-memory API per database: the shared seeded one, plus the snapshot test's own.
    private readonly Dictionary<string, CookfeedApiFactory> _apis = [];

    [Fact]
    public async Task Alexs_history_matches_Q9_line_for_line()
    {
        // Q9 is written for alex@example.com, user 1: two paid orders and a cancelled one.
        var connectionString = await databases.EfWithDbSeederAsync();
        var expected = await Sql.QueryLinesAsync(connectionString, SqlFiles.Query(9));

        var orders = await GetOrdersAsync(connectionString, callerId: 1);

        var actual = orders.SelectMany(o => o.Items.Select(i => string.Join(" | ",
            o.Id, o.Status, Q9Date(o.PlacedAt), Usd(o.TotalCents), i.ProductTitle, Usd(i.UnitPriceCents), i.SellerHandle)));
        Assert.Equal(expected, actual);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(5)]   // Dan is a creator who also buys (from Kenji)
    public async Task A_caller_sees_exactly_their_own_orders_newest_first(int callerId)
    {
        var connectionString = await databases.EfWithDbSeederAsync();
        var expected = await Sql.QueryAsync(connectionString,
            $"SELECT id FROM orders WHERE user_id = {callerId} ORDER BY placed_at DESC, id DESC");

        var orders = await GetOrdersAsync(connectionString, callerId);

        Assert.NotEmpty(expected);
        Assert.Equal(expected.Select(row => int.Parse(row[0]!)), orders.Select(o => o.Id));
    }

    [Theory]
    [InlineData(7)]     // Sam has never ordered
    [InlineData(999)]   // no such user: simply a caller with no orders, until login exists
    public async Task A_caller_with_no_orders_gets_an_empty_list(int callerId)
    {
        var orders = await GetOrdersAsync(await databases.EfWithDbSeederAsync(), callerId);

        Assert.Empty(orders);
    }

    [Fact]
    public async Task Every_order_total_equals_the_sum_of_its_items()
    {
        // DesignDocument.md §6: total_cents is stored, written once at checkout, and must equal its lines.
        var connectionString = await databases.EfWithDbSeederAsync();
        var buyers = await Sql.QueryAsync(connectionString, "SELECT DISTINCT user_id FROM orders");

        foreach (var buyer in buyers.Select(row => int.Parse(row[0]!)))
        {
            Assert.All(await GetOrdersAsync(connectionString, buyer),
                o => Assert.Equal(o.TotalCents, o.Items.Sum(i => i.UnitPriceCents)));
        }
    }

    [Fact]
    public async Task History_shows_the_title_and_price_paid_even_after_the_product_changes()
    {
        // The snapshot rule (DesignDocument.md §6): renaming or repricing a product must not rewrite history.
        var connectionString = await databases.CreateMigratedDatabaseAsync("order_snapshot");
        await DatabaseFixture.SeedWithDbSeederAsync(connectionString);
        await Sql.ExecuteAsync(connectionString,
            "UPDATE products SET title = 'Roman Pasta, Revised', price_cents = 1499 WHERE id = 1");

        var orders = await GetOrdersAsync(connectionString, callerId: 1);

        var item = Assert.Single(orders.SelectMany(o => o.Items), i => i.ProductId == 1);
        Assert.Equal("Roman Pasta Collection", item.ProductTitle);
        Assert.Equal(799, item.UnitPriceCents);
    }

    [Fact]
    public async Task Status_is_sent_as_its_name()
    {
        var response = await SendAsync(await databases.EfWithDbSeederAsync(), "1");

        Assert.Contains("\"status\":\"Cancelled\"", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("alex")]
    [InlineData("0")]
    public async Task A_missing_or_invalid_caller_is_refused_with_400(string? header)
    {
        var response = await SendAsync(await databases.EfWithDbSeederAsync(), header);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // Q9 prints placed_at::date and amounts as ROUND(cents / 100.0, 2); format the API's values the same way.
    private static string Q9Date(DateTimeOffset placedAt) =>
        Convert.ToString(DateOnly.FromDateTime(placedAt.UtcDateTime), CultureInfo.InvariantCulture)!;

    private static string Usd(int cents) => (cents / 100m).ToString("0.00", CultureInfo.InvariantCulture);

    private async Task<List<OrderDto>> GetOrdersAsync(string connectionString, int callerId)
    {
        var response = await SendAsync(connectionString, callerId.ToString(CultureInfo.InvariantCulture));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<List<OrderDto>>(TestContext.Current.CancellationToken))!;
    }

    private async Task<HttpResponseMessage> SendAsync(string connectionString, string? callerHeader)
    {
        if (!_apis.TryGetValue(connectionString, out var api))
        {
            _apis[connectionString] = api = new CookfeedApiFactory(connectionString);
        }
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/me/orders");
        if (callerHeader is not null)
        {
            request.Headers.Add("X-User-Id", callerHeader);
        }
        return await api.CreateClient().SendAsync(request, TestContext.Current.CancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var api in _apis.Values)
        {
            await api.DisposeAsync();
        }
    }
}
