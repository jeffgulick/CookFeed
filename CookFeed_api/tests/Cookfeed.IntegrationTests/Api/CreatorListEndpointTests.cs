using System.Net;
using System.Net.Http.Json;
using Cookfeed.Contracts.Storefront;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// <c>GET /api/creators</c> over HTTP: every creator, as the tiles at the foot of Discover show them (the
/// prototype's <c>renderCreators</c>): picture, name, the verified mark and the handle that links to the storefront.
/// The test that changes rows builds its own database.
/// </summary>
public sealed class CreatorListEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    private const int Dan = 5;
    private readonly List<CookfeedApiFactory> _apis = [];

    [Fact]
    public async Task Lists_every_creator_in_the_order_they_joined_with_each_tiles_fields()
    {
        var connection = await databases.EfWithDbSeederAsync();
        var expected = await Sql.QueryLinesAsync(connection, """
            SELECT c.handle, u.display_name, c.avatar_url, c.is_verified
            FROM creator_profiles c JOIN users u ON u.id = c.user_id
            ORDER BY c.user_id
            """);

        var creators = await GetCreatorsAsync(connection);

        Assert.Equal(3, expected.Count);
        Assert.Equal(expected, creators.Select(c => string.Join(" | ", c.Handle, c.DisplayName, c.AvatarUrl,
            c.IsVerified ? "True" : "False")));
    }

    [Fact]
    public async Task A_suspended_creator_is_still_listed()
    {
        // The prototype lists every creator. A suspended creator's storefront still opens and says so; only their
        // products leave the store (DesignDocument.md §3.8).
        var connection = await databases.CreateMigratedDatabaseAsync("creatorlist");
        await DatabaseFixture.SeedWithDbSeederAsync(connection);
        await Sql.ExecuteAsync(connection, $"UPDATE creator_profiles SET suspended_at = now() WHERE user_id = {Dan}");

        var creators = await GetCreatorsAsync(connection);

        Assert.Equal(["maria-cooks", "kenji-kitchen", "dan-meal-preps"], creators.Select(c => c.Handle));
    }

    [Fact]
    public async Task Sends_no_email_address()
    {
        var response = await SendAsync(await databases.EfWithDbSeederAsync());
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.DoesNotContain("@", body);
        Assert.DoesNotContain("email", body, StringComparison.OrdinalIgnoreCase);
    }

    private async Task<List<CreatorTileDto>> GetCreatorsAsync(string connection)
    {
        var response = await SendAsync(connection);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<List<CreatorTileDto>>(TestContext.Current.CancellationToken))!;
    }

    private async Task<HttpResponseMessage> SendAsync(string connection)
    {
        var api = new CookfeedApiFactory(connection);
        _apis.Add(api);
        return await api.CreateClient().GetAsync("/api/creators", TestContext.Current.CancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var api in _apis)
        {
            await api.DisposeAsync();
        }
    }
}
