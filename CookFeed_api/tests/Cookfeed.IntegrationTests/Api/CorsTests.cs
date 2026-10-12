using System.Net;
using Cookfeed.IntegrationTests.Support;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// CORS: which web origins a browser lets call the API. The Angular dev server (<c>http://localhost:4200</c>) is a
/// different origin from the API, and the <c>X-User-Id</c> and <c>Authorization</c> headers and the <c>PUT</c> and
/// <c>DELETE</c> methods make the browser ask first with a preflight <c>OPTIONS</c> request. The allowed origins
/// come from configuration (<c>Cors:AllowedOrigins</c>); with none configured, no origin is allowed.
/// </summary>
public sealed class CorsTests(DatabaseFixture databases) : IAsyncDisposable
{
    private const string Angular = "http://localhost:4200";
    private readonly List<WebApplicationFactory<Program>> _factories = [];

    [Fact]
    public async Task A_preflight_from_the_allowed_origin_for_PUT_with_the_caller_and_token_headers_is_allowed()
    {
        var response = await PreflightAsync(await ApiAsync(allowAngular: true), Angular);

        Assert.Equal(Angular, AllowedOrigin(response));
        Assert.Contains("PUT", Values(response, "Access-Control-Allow-Methods"));
        Assert.Contains("x-user-id", Values(response, "Access-Control-Allow-Headers"), StringComparer.OrdinalIgnoreCase);
        Assert.Contains("authorization", Values(response, "Access-Control-Allow-Headers"), StringComparer.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task A_preflight_from_another_origin_is_not_allowed()
    {
        var response = await PreflightAsync(await ApiAsync(allowAngular: true), "http://evil.example");

        Assert.Null(AllowedOrigin(response));
    }

    [Fact]
    public async Task A_request_from_the_allowed_origin_is_answered_with_its_origin()
    {
        var response = await GetAsync(await ApiAsync(allowAngular: true), "/api/feed", Angular);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(Angular, AllowedOrigin(response));
    }

    [Fact]
    public async Task An_error_response_carries_it_too_so_the_browser_lets_the_app_read_the_problem()
    {
        // /api/me without X-User-Id is a 400 ProblemDetails. Without the CORS header the browser would hide its body
        // from the app and report only a network error.
        var response = await GetAsync(await ApiAsync(allowAngular: true), "/api/me/orders", Angular);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(Angular, AllowedOrigin(response));
    }

    [Fact]
    public async Task With_no_origins_configured_no_origin_is_allowed()
    {
        var response = await PreflightAsync(await ApiAsync(allowAngular: false), Angular);

        Assert.Null(AllowedOrigin(response));
    }

    private static async Task<HttpResponseMessage> PreflightAsync(WebApplicationFactory<Program> api, string origin)
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, "/api/me/orders");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "PUT");
        request.Headers.Add("Access-Control-Request-Headers", "x-user-id,authorization");
        return await api.CreateClient().SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static async Task<HttpResponseMessage> GetAsync(WebApplicationFactory<Program> api, string route, string origin)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, route);
        request.Headers.Add("Origin", origin);
        return await api.CreateClient().SendAsync(request, TestContext.Current.CancellationToken);
    }

    private static string? AllowedOrigin(HttpResponseMessage response) =>
        response.Headers.TryGetValues("Access-Control-Allow-Origin", out var values) ? values.Single() : null;

    // A preflight answer lists methods and headers comma-separated in one header value.
    private static string[] Values(HttpResponseMessage response, string header) =>
        response.Headers.TryGetValues(header, out var values)
            ? values.SelectMany(v => v.Split(',', StringSplitOptions.TrimEntries)).ToArray()
            : [];

    private async Task<WebApplicationFactory<Program>> ApiAsync(bool allowAngular)
    {
        WebApplicationFactory<Program> api = new CookfeedApiFactory(await databases.EfWithDbSeederAsync());
        _factories.Add(api);
        if (allowAngular)
        {
            // The same setting appsettings.Development.json makes; the tests run in the Testing environment.
            api = api.WithWebHostBuilder(builder => builder.UseSetting("Cors:AllowedOrigins:0", Angular));
            _factories.Add(api);
        }
        return api;
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var factory in _factories)
        {
            await factory.DisposeAsync();
        }
    }
}
