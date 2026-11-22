using System.Net;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// <c>POST /api/dev/reset</c>: puts the database back to the seed, so a demonstration or a run of the browser tests
/// starts from the same rows every time. It exists only in Development; anywhere else the address is a 404.
/// </summary>
public sealed class DevResetEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    private const int Noor = 8;
    private readonly List<CookfeedApiFactory> _apis = [];

    [Fact]
    public async Task In_Development_it_puts_every_table_back_to_the_seed()
    {
        var connectionString = await databases.CreateMigratedDatabaseAsync("dev_reset");
        var api = Api(connectionString, "Development");   // Development seeds the empty database at startup
        var client = api.CreateClient();
        client.DefaultRequestHeaders.Add("X-User-Id", Noor.ToString());
        var seeded = await TableData.RowsAsync(connectionString);

        // Noor buys a plan: a cart row comes and goes, and an order, a line and its recipes are written.
        await client.PutAsync("/api/me/cart/3", null, TestContext.Current.CancellationToken);
        var placed = await client.PostAsync("/api/me/checkout", null, TestContext.Current.CancellationToken);
        Assert.Equal(HttpStatusCode.Created, placed.StatusCode);
        Assert.NotEqual(seeded, await TableData.RowsAsync(connectionString));

        var reset = await client.PostAsync("/api/dev/reset", null, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
        Assert.Equal(seeded, await TableData.RowsAsync(connectionString));
        // The id sequences start over too: the next order gets the id the first one got.
        await client.PutAsync("/api/me/cart/3", null, TestContext.Current.CancellationToken);
        var again = await client.PostAsync("/api/me/checkout", null, TestContext.Current.CancellationToken);
        Assert.Equal(IdOf(await placed.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)),
            IdOf(await again.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)));
    }

    [Fact]
    public async Task Outside_Development_there_is_no_such_address()
    {
        var api = Api(await databases.EfWithDbSeederAsync(), "Testing");

        var response = await api.CreateClient().PostAsync("/api/dev/reset", null, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static int IdOf(string orderJson) =>
        System.Text.Json.JsonDocument.Parse(orderJson).RootElement.GetProperty("id").GetInt32();

    private CookfeedApiFactory Api(string connectionString, string environment)
    {
        var api = new CookfeedApiFactory(connectionString, environment);
        _apis.Add(api);
        return api;
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var api in _apis)
        {
            await api.DisposeAsync();
        }
    }
}
