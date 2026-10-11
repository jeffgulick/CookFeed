using System.Net;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// Every error the API returns has a ProblemDetails body (RFC 9457, <c>application/problem+json</c>), so the
/// Angular client can read one shape: validation errors, unknown routes, and unexpected failures alike. An
/// unexpected failure must not leak its exception text outside Development.
/// </summary>
public sealed class ErrorResponseTests(DatabaseFixture databases)
{
    [Fact]
    public async Task An_unknown_route_is_a_404_problem()
    {
        await using var api = new CookfeedApiFactory(await databases.EfWithDbSeederAsync());

        var response = await api.CreateClient().GetAsync("/api/no-such-thing", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
    }

    [Fact]
    public async Task A_failure_the_API_did_not_expect_is_a_500_problem_without_the_exception_text()
    {
        // Nothing listens on port 1, so the first query throws.
        await using var api = new CookfeedApiFactory(
            "Host=localhost;Port=1;Database=cookfeed;Username=postgres;Password=postgres;Timeout=2");

        var response = await api.CreateClient().GetAsync("/api/feed", TestContext.Current.CancellationToken);
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.InternalServerError, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.DoesNotContain("Npgsql", body);
        Assert.DoesNotContain("Exception", body);
    }
}
