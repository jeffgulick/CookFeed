using System.Net;
using Cookfeed.IntegrationTests.Support;
using Microsoft.AspNetCore.Http;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// The <c>X-User-Id</c> header, the caller until login exists (DesignDocument.md §9), means the same on every
/// route: a whole number of 1 or more, written in plain digits. Optional on the public routes (the feed,
/// storefronts and recipe detail), required under <c>/api/me</c>; anything else is a 400 everywhere, never silently
/// "anonymous" and never read in another number format.
/// </summary>
public sealed class CallerHeaderTests(DatabaseFixture databases) : IAsyncDisposable
{
    private CookfeedApiFactory? _api;

    public static TheoryData<string> Routes =>
        ["/api/feed", "/api/creators/maria-cooks", "/api/recipes/14", "/api/me/orders", "/api/me/shopping-list"];

    public static TheoryData<string, string> BadValues
    {
        get
        {
            var data = new TheoryData<string, string>();
            foreach (var route in Routes)
            {
                foreach (var value in new[] { "0", "-3", "0x1", "+1", "1.5", "1e2", "alex", "99999999999" })
                {
                    data.Add(route, value);
                }
            }
            return data;
        }
    }

    [Theory]
    [MemberData(nameof(BadValues))]
    public async Task A_value_that_is_not_a_plain_positive_number_is_refused_with_400(string route, string value)
    {
        var response = await SendAsync(route, value);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task An_empty_header_is_refused_with_400_not_read_as_anonymous(string route)
    {
        // HttpClient drops a header whose value is empty, so this request is built on the in-memory server
        // directly, the way a client such as curl -H "X-User-Id;" would send it.
        _api ??= new CookfeedApiFactory(await databases.EfWithDbSeederAsync());

        var context = await _api.Server.SendAsync(c =>
        {
            c.Request.Method = HttpMethods.Get;
            c.Request.Path = route;
            c.Request.Headers["X-User-Id"] = "";
        }, TestContext.Current.CancellationToken);

        Assert.Equal(StatusCodes.Status400BadRequest, context.Response.StatusCode);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task A_plain_positive_number_is_accepted(string route)
    {
        var response = await SendAsync(route, "1");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData("/api/feed", HttpStatusCode.OK)]
    [InlineData("/api/creators/maria-cooks", HttpStatusCode.OK)]
    [InlineData("/api/recipes/14", HttpStatusCode.OK)]
    [InlineData("/api/me/orders", HttpStatusCode.BadRequest)]
    [InlineData("/api/me/shopping-list", HttpStatusCode.BadRequest)]
    public async Task Without_the_header_public_routes_serve_an_anonymous_viewer_and_me_routes_refuse(
        string route, HttpStatusCode expected)
    {
        var response = await SendAsync(route, value: null);

        Assert.Equal(expected, response.StatusCode);
    }

    private async Task<HttpResponseMessage> SendAsync(string route, string? value)
    {
        _api ??= new CookfeedApiFactory(await databases.EfWithDbSeederAsync());
        using var request = new HttpRequestMessage(HttpMethod.Get, route);
        if (value is not null)
        {
            request.Headers.TryAddWithoutValidation("X-User-Id", value);
        }
        return await _api.CreateClient().SendAsync(request, TestContext.Current.CancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        if (_api is not null)
        {
            await _api.DisposeAsync();
        }
    }
}
