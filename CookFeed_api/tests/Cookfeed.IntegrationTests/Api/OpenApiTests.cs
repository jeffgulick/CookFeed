using System.Net;
using System.Text.Json.Nodes;
using Cookfeed.IntegrationTests.Support;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// The OpenAPI description at <c>/openapi/v1.json</c>: every endpoint, its parameters and its response shapes, from
/// which the Angular client's types can be generated. It is served only where <c>OpenApi:Enabled</c> is true, which
/// <c>appsettings.Development.json</c> sets; elsewhere the address is a 404.
/// </summary>
public sealed class OpenApiTests(DatabaseFixture databases) : IAsyncDisposable
{
    private const string DocumentPath = "/openapi/v1.json";
    private readonly List<WebApplicationFactory<Program>> _factories = [];

    public static TheoryData<string> Routes =>
        ["/api/feed", "/api/creators/{handle}", "/api/me/orders", "/api/me/shopping-list"];

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task The_document_describes_each_endpoint_with_its_success_response(string route)
    {
        var document = await DocumentAsync();

        var get = document["paths"]?[route]?["get"];
        Assert.NotNull(get);
        Assert.NotNull(get["responses"]?["200"]?["content"]?["application/json"]?["schema"]);
    }

    [Theory]
    [InlineData("/api/me/orders", true)]
    [InlineData("/api/me/shopping-list", true)]
    [InlineData("/api/feed", false)]
    [InlineData("/api/creators/{handle}", false)]
    public async Task The_caller_header_is_required_under_me_and_optional_on_public_routes(string route, bool required)
    {
        var document = await DocumentAsync();

        var header = Parameters(document, route).SingleOrDefault(p =>
            (string?)p["in"] == "header" && (string?)p["name"] == "X-User-Id");
        Assert.NotNull(header);
        Assert.Equal(required, (bool?)header["required"] ?? false);
        Assert.False(string.IsNullOrWhiteSpace((string?)header["description"]));
    }

    [Fact]
    public async Task Without_the_setting_the_document_is_not_served()
    {
        var response = await (await ApiAsync(enabled: false)).CreateClient()
            .GetAsync(DocumentPath, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static IEnumerable<JsonNode> Parameters(JsonNode document, string route) =>
        document["paths"]?[route]?["get"]?["parameters"]?.AsArray().OfType<JsonNode>() ?? [];

    private async Task<JsonNode> DocumentAsync()
    {
        var response = await (await ApiAsync(enabled: true)).CreateClient()
            .GetAsync(DocumentPath, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return JsonNode.Parse(await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken))!;
    }

    private async Task<WebApplicationFactory<Program>> ApiAsync(bool enabled)
    {
        WebApplicationFactory<Program> api = new CookfeedApiFactory(await databases.EfWithDbSeederAsync());
        _factories.Add(api);
        if (enabled)
        {
            // The setting appsettings.Development.json makes; the tests run in the Testing environment.
            api = api.WithWebHostBuilder(builder => builder.UseSetting("OpenApi:Enabled", "true"));
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
