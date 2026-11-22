using System.Net;
using System.Net.Http.Json;
using Cookfeed.Contracts.Reviews;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// <c>POST /api/products/{id}/reviews</c> and <c>DELETE /api/products/{id}/reviews/mine</c> over HTTP
/// (DesignDocument.md §3.5): only a cook with a Paid order for the product reviews it, once, never their own, under
/// their account name; and an author may delete their review unless the admin hid it. Each answers with the reviews
/// page as the caller now sees it. Seed: Three Weeknights in Japan (3) is reviewed by Alex, Priya and Dan; Family
/// Week on a Budget (4) is owned by Alex and Priya and not reviewed. Tests that write build their own database.
/// </summary>
public sealed class ReviewWriteEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    private const int ThreeWeeknights = 3, FamilyWeek = 4;
    private const int Alex = 1, Priya = 2, Dan = 5, Admin = 6, Sam = 7;
    private const string Words = "One trip covered the whole week.";
    private readonly Dictionary<string, CookfeedApiFactory> _apis = [];

    [Fact]
    public async Task A_buyer_posts_a_review_under_their_account_name_and_it_leads_the_page()
    {
        var connectionString = await OwnDatabaseAsync("review_post");
        var before = DateTimeOffset.UtcNow.AddSeconds(-5);

        var response = await PostAsync(connectionString, FamilyWeek, Priya, new { rating = 5, recommends = true, body = $"  {Words}  " });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal($"/api/products/{FamilyWeek}/reviews", response.Headers.Location?.OriginalString);
        var page = await ReadPageAsync(response);
        var review = Assert.Single(page.Reviews);
        Assert.Equal(("Priya Shah", 5, true, Words, true, true),
            (review.ReviewerName, review.Rating, review.Recommends, review.Body, review.IsMine, review.Counts));
        Assert.InRange(review.CreatedAt, before, DateTimeOffset.UtcNow.AddSeconds(5));
        Assert.Equal((1, 5.0m, 100), (page.Summary.ReviewCount, page.Summary.Average, page.Summary.PercentRecommend));
        Assert.Equal(ReviewFormState.AlreadyReviewed, page.FormState);
        Assert.Equal([$"{FamilyWeek} | {Priya} | 5 | True | {Words}"], await Sql.QueryLinesAsync(connectionString,
            $"SELECT product_id, user_id, rating, recommends, body FROM reviews WHERE product_id = {FamilyWeek}"));
    }

    [Fact]
    public async Task Everyone_then_sees_the_review_and_the_plans_rating()
    {
        var connectionString = await OwnDatabaseAsync("review_seen");

        await PostAsync(connectionString, FamilyWeek, Priya, new { rating = 4, recommends = false, body = Words });

        var page = await ReadPageAsync(await SendAsync(connectionString, HttpMethod.Get, $"/api/products/{FamilyWeek}/reviews", null));
        Assert.Equal("Priya Shah", Assert.Single(page.Reviews).ReviewerName);
        Assert.False(page.Reviews[0].IsMine);
        Assert.Equal((1, 4.0m, 0), (page.Summary.ReviewCount, page.Summary.Average, page.Summary.PercentRecommend));
    }

    [Fact]
    public async Task A_second_review_of_the_same_product_is_a_409_and_writes_nothing()
    {
        var connectionString = await databases.EfWithDbSeederAsync();
        var before = await ScalarAsync(connectionString, "SELECT COUNT(*) FROM reviews");

        var response = await PostAsync(connectionString, ThreeWeeknights, Alex, new { rating = 1, recommends = false, body = Words });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(before, await ScalarAsync(connectionString, "SELECT COUNT(*) FROM reviews"));
    }

    [Theory]
    [InlineData(Sam, FamilyWeek, HttpStatusCode.Forbidden)]     // has not bought it
    [InlineData(Dan, FamilyWeek, HttpStatusCode.Forbidden)]     // his own plan
    [InlineData(Admin, FamilyWeek, HttpStatusCode.Forbidden)]   // the admin does not review
    [InlineData(Priya, 999, HttpStatusCode.NotFound)]           // no such product
    public async Task Someone_who_may_not_review_is_refused_and_nothing_is_written(int caller, int productId,
        HttpStatusCode expected)
    {
        var connectionString = await databases.EfWithDbSeederAsync();
        var before = await ScalarAsync(connectionString, "SELECT COUNT(*) FROM reviews");

        var response = await PostAsync(connectionString, productId, caller, new { rating = 5, recommends = true, body = Words });

        Assert.Equal(expected, response.StatusCode);
        Assert.Equal(before, await ScalarAsync(connectionString, "SELECT COUNT(*) FROM reviews"));
    }

    [Theory]
    [InlineData(0, Words)]
    [InlineData(6, Words)]
    [InlineData(5, "Too short.")]
    [InlineData(5, "              x              ")]   // long enough only with the spaces around it
    public async Task A_rating_outside_1_to_5_or_a_body_under_15_characters_is_a_400(int rating, string body)
    {
        var connectionString = await databases.EfWithDbSeederAsync();

        var response = await PostAsync(connectionString, FamilyWeek, Priya, new { rating, recommends = true, body });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("0", await ScalarAsync(connectionString, $"SELECT COUNT(*) FROM reviews WHERE product_id = {FamilyWeek}"));
    }

    [Fact]
    public async Task A_body_over_2000_characters_is_a_400()
    {
        var response = await PostAsync(await databases.EfWithDbSeederAsync(), FamilyWeek, Priya,
            new { rating = 5, recommends = true, body = new string('a', 2001) });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Without_a_caller_a_review_cannot_be_posted()
    {
        var response = await SendAsync(await databases.EfWithDbSeederAsync(), HttpMethod.Post,
            $"/api/products/{FamilyWeek}/reviews", null, new { rating = 5, recommends = true, body = Words });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task An_author_deletes_their_review_and_may_then_write_another()
    {
        var connectionString = await OwnDatabaseAsync("review_delete");

        var deleted = await SendAsync(connectionString, HttpMethod.Delete, $"/api/products/{ThreeWeeknights}/reviews/mine", Alex);

        Assert.Equal(HttpStatusCode.OK, deleted.StatusCode);
        var page = await ReadPageAsync(deleted);
        Assert.DoesNotContain(page.Reviews, r => r.ReviewerName == "Alex Rivera");
        Assert.Equal(2, page.Summary.ReviewCount);
        Assert.Equal(ReviewFormState.CanReview, page.FormState);
        Assert.Equal("0", await ScalarAsync(connectionString,
            $"SELECT COUNT(*) FROM reviews WHERE product_id = {ThreeWeeknights} AND user_id = {Alex}"));
        // Nobody else's review went with it.
        Assert.Equal("2", await ScalarAsync(connectionString, $"SELECT COUNT(*) FROM reviews WHERE product_id = {ThreeWeeknights}"));

        var again = await PostAsync(connectionString, ThreeWeeknights, Alex, new { rating = 3, recommends = true, body = Words });
        Assert.Equal(HttpStatusCode.Created, again.StatusCode);
    }

    [Fact]
    public async Task A_review_the_admin_hid_cannot_be_deleted()
    {
        var connectionString = await OwnDatabaseAsync("review_hidden");
        await Sql.ExecuteAsync(connectionString,
            $"UPDATE reviews SET hidden_at = now() WHERE product_id = {ThreeWeeknights} AND user_id = {Alex}");

        var response = await SendAsync(connectionString, HttpMethod.Delete, $"/api/products/{ThreeWeeknights}/reviews/mine", Alex);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("1", await ScalarAsync(connectionString,
            $"SELECT COUNT(*) FROM reviews WHERE product_id = {ThreeWeeknights} AND user_id = {Alex}"));
    }

    [Theory]
    [InlineData(Sam, ThreeWeeknights)]   // never reviewed it
    [InlineData(Alex, FamilyWeek)]       // owns it, has not reviewed it
    [InlineData(Alex, 999)]              // no such product
    public async Task Deleting_when_there_is_no_review_of_ones_own_is_a_404(int caller, int productId)
    {
        var connectionString = await databases.EfWithDbSeederAsync();
        var before = await ScalarAsync(connectionString, "SELECT COUNT(*) FROM reviews");

        var response = await SendAsync(connectionString, HttpMethod.Delete, $"/api/products/{productId}/reviews/mine", caller);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        Assert.Equal(before, await ScalarAsync(connectionString, "SELECT COUNT(*) FROM reviews"));
    }

    private Task<HttpResponseMessage> PostAsync(string connectionString, int productId, int caller, object body) =>
        SendAsync(connectionString, HttpMethod.Post, $"/api/products/{productId}/reviews", caller, body);

    private static async Task<ProductReviewsDto> ReadPageAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<ProductReviewsDto>(TestContext.Current.CancellationToken))!;

    private async Task<HttpResponseMessage> SendAsync(string connectionString, HttpMethod method, string url, int? caller,
        object? body = null)
    {
        if (!_apis.TryGetValue(connectionString, out var api))
        {
            _apis[connectionString] = api = new CookfeedApiFactory(connectionString);
        }

        using var request = new HttpRequestMessage(method, url);
        if (caller is not null)
        {
            request.Headers.Add("X-User-Id", caller.Value.ToString());
        }
        if (body is not null)
        {
            request.Content = JsonContent.Create(body);
        }
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
