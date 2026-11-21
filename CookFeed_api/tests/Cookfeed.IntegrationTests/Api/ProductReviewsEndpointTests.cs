using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Cookfeed.Contracts.Reviews;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// <c>GET /api/products/{id}/reviews</c> over HTTP: a product's reviews, their summary, and what the review form
/// shows this viewer (the prototype's <c>reviews.html</c>), against the database <c>DbSeeder</c> builds. The list is
/// held to <c>queries.sql</c> Q12 and the summary to Q13. A review the admin hid, or whose author was refunded, does
/// not count (DesignDocument.md §3.5, §3.8). The test that changes rows builds its own database.
/// </summary>
public sealed class ProductReviewsEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    private const int RomanPasta = 1, ThreeWeeknights = 3, FamilyWeek = 4, RetiredGrilling = 5;
    private const int Alex = 1, Priya = 2, Kenji = 4, Dan = 5, Admin = 6, Sam = 7;
    private CookfeedApiFactory? _api;

    [Theory]
    [InlineData("/api/products/999/reviews")]
    [InlineData("/api/products/0/reviews")]
    [InlineData("/api/products/family-week/reviews")]
    public async Task An_id_that_names_no_product_is_404(string route)
    {
        var response = await SendAsync(route);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task The_reviews_match_Q12_newest_first()
    {
        // Q12 is written for Three Weeknights in Japan: reviewer, rating, recommends, date posted, body.
        var q12 = await Sql.QueryAsync(await ConnectionStringAsync(), SqlFiles.Query(12));
        var newestFirst = await Sql.QueryAsync(await ConnectionStringAsync(), $"""
            SELECT id FROM reviews WHERE product_id = {ThreeWeeknights} ORDER BY created_at DESC, id DESC
            """);

        var page = await GetReviewsAsync(ThreeWeeknights);

        Assert.Equal(3, q12.Count);
        Assert.Equal(q12.Select(row => $"{row[0]} | {row[1]} | {row[2]} | {row[4]}"),
            page.Reviews.Select(r => $"{r.ReviewerName} | {r.Rating} | {r.Recommends} | {r.Body}"));
        Assert.Equal(newestFirst.Select(row => row[0]),
            page.Reviews.Select(r => r.Id.ToString(CultureInfo.InvariantCulture)));
    }

    [Fact]
    public async Task The_summary_matches_Q13_and_counts_each_star()
    {
        var q13 = Assert.Single(await Sql.QueryAsync(await ConnectionStringAsync(), SqlFiles.Query(13)));
        var perStar = await Sql.QueryAsync(await ConnectionStringAsync(), $"""
            SELECT s, (SELECT count(*) FROM reviews rv WHERE rv.product_id = {ThreeWeeknights} AND rv.rating = s)
            FROM generate_series(1, 5) AS s ORDER BY s
            """);

        var summary = (await GetReviewsAsync(ThreeWeeknights)).Summary;

        Assert.Equal((q13[1], q13[2], q13[3]), (summary.ReviewCount.ToString(CultureInfo.InvariantCulture),
            summary.Average?.ToString("0.0", CultureInfo.InvariantCulture),
            summary.PercentRecommend?.ToString(CultureInfo.InvariantCulture)));
        Assert.Equal(perStar.Select(row => row[1]), summary.StarCounts.Select(c => c.ToString(CultureInfo.InvariantCulture)));
    }

    [Theory]
    [InlineData(RomanPasta)]
    [InlineData(RetiredGrilling)]   // a retired product still has its reviews page
    public async Task A_product_with_no_reviews_has_an_empty_list_and_no_average(int productId)
    {
        var page = await GetReviewsAsync(productId);

        Assert.Empty(page.Reviews);
        Assert.Equal((0, null, null), (page.Summary.ReviewCount, page.Summary.Average, page.Summary.PercentRecommend));
        Assert.Equal([0, 0, 0, 0, 0], page.Summary.StarCounts);
    }

    [Fact]
    public async Task The_header_names_the_product_and_its_creator()
    {
        var expected = await Sql.QueryLinesAsync(await ConnectionStringAsync(), $"""
            SELECT p.id, p.type, p.title, c.handle, u.display_name, c.is_verified
            FROM products p JOIN creator_profiles c ON c.user_id = p.creator_id JOIN users u ON u.id = c.user_id
            WHERE p.id = {ThreeWeeknights}
            """);

        var page = await GetReviewsAsync(ThreeWeeknights);

        Assert.Equal(expected, [string.Join(" | ", page.ProductId, page.Type, page.Title, page.Creator.Handle,
            page.Creator.DisplayName, page.Creator.IsVerified)]);
    }

    [Theory]
    [InlineData(null, ThreeWeeknights, ReviewFormState.SignIn)]
    [InlineData(Admin, ThreeWeeknights, ReviewFormState.NoShop)]
    [InlineData(Kenji, ThreeWeeknights, ReviewFormState.YourOwn)]
    [InlineData(Alex, ThreeWeeknights, ReviewFormState.AlreadyReviewed)]
    [InlineData(Sam, ThreeWeeknights, ReviewFormState.MustBuy)]
    [InlineData(Alex, FamilyWeek, ReviewFormState.CanReview)]        // bought it, has not reviewed it
    [InlineData(Dan, FamilyWeek, ReviewFormState.YourOwn)]
    [InlineData(Kenji, FamilyWeek, ReviewFormState.MustBuy)]         // a creator shops like anyone else
    public async Task The_form_state_says_what_the_review_form_shows_this_viewer(int? viewer, int productId, ReviewFormState expected)
    {
        Assert.Equal(expected, (await GetReviewsAsync(productId, viewer)).FormState);
    }

    [Theory]
    [InlineData(Alex)]
    [InlineData(Priya)]
    [InlineData(Dan)]
    public async Task Exactly_the_viewers_own_review_is_marked_as_theirs(int viewer)
    {
        var mine = await Sql.QueryAsync(await ConnectionStringAsync(),
            $"SELECT id FROM reviews WHERE product_id = {ThreeWeeknights} AND user_id = {viewer}");

        var page = await GetReviewsAsync(ThreeWeeknights, viewer);

        Assert.Equal(mine.Select(row => row[0]),
            page.Reviews.Where(r => r.IsMine).Select(r => r.Id.ToString(CultureInfo.InvariantCulture)));
    }

    [Fact]
    public async Task Without_a_viewer_no_review_is_marked_as_theirs()
    {
        Assert.DoesNotContain((await GetReviewsAsync(ThreeWeeknights)).Reviews, r => r.IsMine);
    }

    [Fact]
    public async Task A_review_says_when_its_author_is_a_creator()
    {
        // Dan Okafor sells his own plans and bought Kenji's; Alex and Priya are home cooks only.
        var page = await GetReviewsAsync(ThreeWeeknights);

        Assert.Equal([("Alex Rivera", false), ("Dan Okafor", true), ("Priya Shah", false)],
            page.Reviews.Select(r => (r.ReviewerName, r.ReviewerIsCreator)).OrderBy(x => x.ReviewerName));
    }

    [Fact]
    public async Task A_hidden_review_and_a_refunded_buyers_review_stop_counting_but_stay_for_their_author_and_the_admin()
    {
        // The seed's reviews of Three Weeknights in Japan: Alex 5, Priya 4, Dan 3.
        var connection = await databases.CreateMigratedDatabaseAsync("reviews");
        await DatabaseFixture.SeedWithDbSeederAsync(connection);
        await Sql.ExecuteAsync(connection, $"""
            UPDATE reviews SET hidden_at = now() WHERE product_id = {ThreeWeeknights} AND user_id = {Priya};
            UPDATE orders SET status = 'Refunded' WHERE user_id = {Dan}
              AND id IN (SELECT order_id FROM order_items WHERE product_id = {ThreeWeeknights});
            """);
        await using var api = new CookfeedApiFactory(connection);

        var asVisitor = await GetReviewsAsync(api, ThreeWeeknights);
        var asPriya = await GetReviewsAsync(api, ThreeWeeknights, Priya);
        var asDan = await GetReviewsAsync(api, ThreeWeeknights, Dan);
        var asAdmin = await GetReviewsAsync(api, ThreeWeeknights, Admin);

        // Everyone else sees only Alex's review, and the summary counts only it.
        Assert.Equal(["Alex Rivera"], asVisitor.Reviews.Select(r => r.ReviewerName));
        Assert.Equal((1, 5.0m, 100), (asVisitor.Summary.ReviewCount, asVisitor.Summary.Average, asVisitor.Summary.PercentRecommend));

        // Priya still sees hers, marked hidden, and is told so.
        var priyas = Assert.Single(asPriya.Reviews, r => r.IsMine);
        Assert.Equal((true, false, ReviewFormState.HiddenReview), (priyas.IsHidden, priyas.Counts, asPriya.FormState));

        // Dan still sees his, not counted, and is told his order was refunded.
        var dans = Assert.Single(asDan.Reviews, r => r.IsMine);
        Assert.Equal((false, false, ReviewFormState.RefundedReview), (dans.IsHidden, dans.Counts, asDan.FormState));

        // The admin sees all three, and the summary still counts one.
        Assert.Equal(3, asAdmin.Reviews.Count);
        Assert.Equal(1, asAdmin.Summary.ReviewCount);
        Assert.Equal(ReviewFormState.NoShop, asAdmin.FormState);
    }

    [Fact]
    public async Task The_form_state_is_sent_as_its_name()
    {
        var response = await SendAsync($"/api/products/{ThreeWeeknights}/reviews");

        Assert.Contains("\"formState\":\"SignIn\"", await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task A_viewer_id_that_is_not_a_number_is_refused_with_400()
    {
        var response = await SendAsync($"/api/products/{ThreeWeeknights}/reviews", "alex");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task<ProductReviewsDto> GetReviewsAsync(int productId, int? viewer = null)
    {
        _api ??= new CookfeedApiFactory(await ConnectionStringAsync());
        return await GetReviewsAsync(_api, productId, viewer);
    }

    private static async Task<ProductReviewsDto> GetReviewsAsync(CookfeedApiFactory api, int productId, int? viewer = null)
    {
        var response = await SendAsync(api, $"/api/products/{productId}/reviews", viewer?.ToString(CultureInfo.InvariantCulture));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ProductReviewsDto>(TestContext.Current.CancellationToken))!;
    }

    private async Task<HttpResponseMessage> SendAsync(string url, string? viewerHeader = null)
    {
        _api ??= new CookfeedApiFactory(await ConnectionStringAsync());
        return await SendAsync(_api, url, viewerHeader);
    }

    private static async Task<HttpResponseMessage> SendAsync(CookfeedApiFactory api, string url, string? viewerHeader)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (viewerHeader is not null)
        {
            request.Headers.Add("X-User-Id", viewerHeader);
        }
        return await api.CreateClient().SendAsync(request, TestContext.Current.CancellationToken);
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
