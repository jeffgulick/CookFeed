using System.Net;
using System.Net.Http.Json;
using Cookfeed.Application.Feed;
using Cookfeed.Contracts.Feed;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// <c>GET /api/feed</c> over HTTP, against the database <c>DbSeeder</c> builds. The expected recipes come from
/// running the reference queries in <c>docs/sql/queries.sql</c> (Q1, Q3) on the same database, so the API is
/// held to the SQL that was designed and reviewed for it, not to a hand-typed list. These tests only read.
/// </summary>
public sealed class FeedEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    private CookfeedApiFactory? _api;

    [Fact]
    public async Task Newest_lists_public_published_recipes_in_the_order_of_Q1()
    {
        var q1 = await Sql.QueryAsync(await ConnectionStringAsync(), SqlFiles.Query(1));

        var page = await GetFeedAsync("/api/feed");

        Assert.Equal(q1.Select(row => int.Parse(row[0]!)), page.Items.Select(i => i.Id));
        Assert.Equal(1, page.Page);
        Assert.Equal(20, page.PageSize);
        Assert.False(page.HasMore);
    }

    [Fact]
    public async Task Trending_starts_with_the_five_recipes_of_Q3()
    {
        var q3 = await Sql.QueryAsync(await ConnectionStringAsync(), SqlFiles.Query(3));

        var page = await GetFeedAsync("/api/feed?sort=Trending");

        Assert.Equal(q3.Select(row => row[0]), page.Items.Take(5).Select(i => i.Title));
    }

    [Fact]
    public async Task Each_card_carries_the_recipe_and_creator_as_stored()
    {
        var expected = await Sql.QueryLinesAsync(await ConnectionStringAsync(), """
            SELECT r.id, r.title, r.video_url, r.thumbnail_url, r.servings,
                   CASE WHEN r.prep_minutes IS NULL AND r.cook_minutes IS NULL THEN NULL
                        ELSE COALESCE(r.prep_minutes, 0) + COALESCE(r.cook_minutes, 0) END,
                   r.save_count, c.handle, u.display_name, c.is_verified
            FROM recipes r
            JOIN creator_profiles c ON r.creator_id = c.user_id
            JOIN users u ON c.user_id = u.id
            WHERE r.is_published AND r.visibility = 'Public'
            """);

        var page = await GetFeedAsync("/api/feed");

        var actual = page.Items.Select(i => string.Join(" | ", i.Id, i.Title, i.VideoUrl, i.ThumbnailUrl, i.Servings,
            i.TotalMinutes, i.SaveCount, i.CreatorHandle, i.CreatorDisplayName, i.CreatorIsVerified ? "True" : "False"));
        AssertSame.Lines(expected, actual, "Feed cards", expectedSource: "database", actualSource: "API response");
    }

    [Theory]
    [InlineData("Newest")]
    [InlineData("Trending")]
    public async Task Product_only_recipes_and_drafts_never_appear(string sort)
    {
        var hidden = await Sql.QueryAsync(await ConnectionStringAsync(),
            "SELECT id FROM recipes WHERE NOT is_published OR visibility <> 'Public'");
        Assert.NotEmpty(hidden);

        var page = await GetFeedAsync($"/api/feed?sort={sort}&pageSize={FeedService.MaxPageSize}");

        Assert.Empty(page.Items.Select(i => i.Id).Intersect(hidden.Select(row => int.Parse(row[0]!))));
    }

    [Fact]
    public async Task Pages_of_two_join_up_to_the_whole_feed_and_only_the_last_says_no_more()
    {
        var q1 = await Sql.QueryAsync(await ConnectionStringAsync(), SqlFiles.Query(1));
        var pages = new List<FeedPageDto>();
        do
        {
            pages.Add(await GetFeedAsync($"/api/feed?page={pages.Count + 1}&pageSize=2"));
        }
        while (pages[^1].HasMore && pages.Count < 10);

        Assert.Equal(q1.Select(row => int.Parse(row[0]!)), pages.SelectMany(p => p.Items).Select(i => i.Id));
        Assert.All(pages[..^1], p => Assert.Equal(2, p.Items.Count));
        Assert.Equal([1, 2, 3], pages.Select(p => p.Page).Take(3));
    }

    [Fact]
    public async Task A_named_viewer_sees_exactly_their_own_saves_marked()
    {
        // Sam has bought nothing, so every recipe he saved is a free one, and the feed holds them all.
        const int viewer = 7;
        var saved = await Sql.QueryAsync(await ConnectionStringAsync(),
            $"SELECT recipe_id FROM saved_recipes WHERE user_id = {viewer}");

        var page = await GetFeedAsync("/api/feed", viewerId: viewer);

        Assert.NotEmpty(saved);
        Assert.Equal(saved.Select(row => int.Parse(row[0]!)).Order(),
            page.Items.Where(i => i.SavedByViewer).Select(i => i.Id).Order());
    }

    [Fact]
    public async Task Without_a_viewer_nothing_is_marked_saved()
    {
        var page = await GetFeedAsync("/api/feed");

        Assert.NotEmpty(page.Items);
        Assert.DoesNotContain(page.Items, i => i.SavedByViewer);
    }

    [Theory]
    [InlineData("/api/feed?page=0")]
    [InlineData("/api/feed?page=2147483647&pageSize=50")]   // (page - 1) * pageSize would overflow an int
    [InlineData("/api/feed?pageSize=0")]
    [InlineData("/api/feed?pageSize=51")]
    [InlineData("/api/feed?sort=Popular")]
    public async Task A_page_request_out_of_range_is_refused_with_400(string url)
    {
        var response = await (await ClientAsync()).GetAsync(url, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_viewer_id_that_is_not_a_number_is_refused_with_400()
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/feed");
        request.Headers.Add("X-User-Id", "alex");

        var response = await (await ClientAsync()).SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task<FeedPageDto> GetFeedAsync(string url, int? viewerId = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (viewerId is not null)
        {
            request.Headers.Add("X-User-Id", viewerId.Value.ToString());
        }

        var response = await (await ClientAsync()).SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<FeedPageDto>(TestContext.Current.CancellationToken))!;
    }

    private async Task<HttpClient> ClientAsync()
    {
        _api ??= new CookfeedApiFactory(await ConnectionStringAsync());
        return _api.CreateClient();
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
