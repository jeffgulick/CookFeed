using System.Net;
using System.Net.Http.Json;
using Cookfeed.Contracts.Feed;
using Cookfeed.Contracts.Recipes;
using Cookfeed.Contracts.Saves;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// The caller's saved recipes over HTTP: <c>GET /api/me/saves</c>, and <c>PUT</c> and <c>DELETE
/// /api/me/saves/{recipeId}</c>. Saving needs the same access as opening the recipe, and the
/// <c>saved_recipes_save_count</c> trigger keeps <c>recipes.save_count</c> right, which <c>queries.sql</c> Q16 checks.
/// Tests that only read, or are refused before anything is written, use the shared seeded database; each test that
/// changes rows builds its own.
/// </summary>
public sealed class SavesEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    private const int Caprese = 15, ChickenTeriyaki = 5, MisoSoupDraft = 13;
    private const int Alex = 1, Priya = 2, Kenji = 4, Admin = 6, Sam = 7, Tomas = 9;
    private readonly Dictionary<string, CookfeedApiFactory> _apis = [];

    [Fact]
    public async Task The_list_is_the_callers_saves_newest_first_with_what_a_card_shows()
    {
        var connectionString = await databases.EfWithDbSeederAsync();
        var expected = await Sql.QueryLinesAsync(connectionString, $"""
            SELECT r.id, r.title, r.thumbnail_url, r.servings,
                   CASE WHEN r.prep_minutes IS NULL AND r.cook_minutes IS NULL THEN NULL
                        ELSE COALESCE(r.prep_minutes, 0) + COALESCE(r.cook_minutes, 0) END,
                   r.save_count, c.handle, c.is_verified, r.visibility
            FROM saved_recipes s
            JOIN recipes r ON r.id = s.recipe_id
            JOIN creator_profiles c ON c.user_id = r.creator_id
            WHERE s.user_id = {Alex}
            ORDER BY s.saved_at DESC, r.id DESC
            """);

        var saved = await GetSavedAsync(connectionString, Alex);

        Assert.NotEmpty(expected);
        Assert.Equal(expected, saved.Select(r => string.Join(" | ", r.Id, r.Title, r.ThumbnailUrl, r.Servings,
            r.TotalMinutes, r.SaveCount, r.CreatorHandle, r.CreatorIsVerified ? "True" : "False", r.Visibility)));
    }

    [Fact]
    public async Task The_list_holds_the_recipes_of_Q6()
    {
        // Q6 is written for alex@example.com: title, handle and the day saved, oldest first.
        var connectionString = await databases.EfWithDbSeederAsync();
        var q6 = await Sql.QueryAsync(connectionString, SqlFiles.Query(6));

        var saved = await GetSavedAsync(connectionString, Alex);

        Assert.Equal(q6.Select(row => $"{row[0]} | {row[1]}").Reverse(),
            saved.Select(r => $"{r.Title} | {r.CreatorHandle}"));
    }

    [Fact]
    public async Task Saving_adds_one_row_however_often_it_is_asked_and_the_count_follows()
    {
        var connectionString = await OwnDatabaseAsync("saves_add");
        var before = int.Parse((await ScalarAsync(connectionString, $"SELECT save_count FROM recipes WHERE id = {Caprese}"))!);

        var first = await SendAsync(connectionString, HttpMethod.Put, $"/api/me/saves/{Caprese}", Tomas);
        var second = await SendAsync(connectionString, HttpMethod.Put, $"/api/me/saves/{Caprese}", Tomas);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(new SaveStateDto(Caprese, Saved: true, SaveCount: before + 1), await ReadStateAsync(first));
        Assert.Equal(new SaveStateDto(Caprese, Saved: true, SaveCount: before + 1), await ReadStateAsync(second));
        Assert.Equal("1", await ScalarAsync(connectionString,
            $"SELECT COUNT(*) FROM saved_recipes WHERE user_id = {Tomas} AND recipe_id = {Caprese}"));
        // The counter the trigger keeps equals the rows (Q16 returns nothing).
        Assert.Empty(await Sql.QueryAsync(connectionString, SqlFiles.Query(16)));
    }

    [Fact]
    public async Task A_saved_recipe_leads_the_list_and_is_marked_saved_wherever_it_is_shown()
    {
        var connectionString = await OwnDatabaseAsync("saves_shown");

        await SendAsync(connectionString, HttpMethod.Put, $"/api/me/saves/{Caprese}", Tomas);

        Assert.Equal(Caprese, (await GetSavedAsync(connectionString, Tomas))[0].Id);
        var feed = await (await SendAsync(connectionString, HttpMethod.Get, "/api/feed?pageSize=50", Tomas))
            .Content.ReadFromJsonAsync<FeedPageDto>(TestContext.Current.CancellationToken);
        Assert.True(feed!.Items.Single(i => i.Id == Caprese).SavedByViewer);
        var recipe = await (await SendAsync(connectionString, HttpMethod.Get, $"/api/recipes/{Caprese}", Tomas))
            .Content.ReadFromJsonAsync<RecipeDetailDto>(TestContext.Current.CancellationToken);
        Assert.True(recipe!.SavedByViewer);
    }

    [Fact]
    public async Task Unsaving_removes_the_row_and_the_count_follows_and_asking_again_changes_nothing()
    {
        // The seed has Caprese Salad saved by Sam.
        var connectionString = await OwnDatabaseAsync("saves_remove");
        var before = int.Parse((await ScalarAsync(connectionString, $"SELECT save_count FROM recipes WHERE id = {Caprese}"))!);

        var first = await SendAsync(connectionString, HttpMethod.Delete, $"/api/me/saves/{Caprese}", Sam);
        var second = await SendAsync(connectionString, HttpMethod.Delete, $"/api/me/saves/{Caprese}", Sam);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(new SaveStateDto(Caprese, Saved: false, SaveCount: before - 1), await ReadStateAsync(first));
        Assert.Equal(new SaveStateDto(Caprese, Saved: false, SaveCount: before - 1), await ReadStateAsync(second));
        Assert.Equal("0", await ScalarAsync(connectionString,
            $"SELECT COUNT(*) FROM saved_recipes WHERE user_id = {Sam} AND recipe_id = {Caprese}"));
        Assert.Empty(await Sql.QueryAsync(connectionString, SqlFiles.Query(16)));
        Assert.DoesNotContain(await GetSavedAsync(connectionString, Sam), r => r.Id == Caprese);
    }

    [Fact]
    public async Task A_premium_recipe_can_be_saved_by_a_cook_who_bought_it()
    {
        // A recipe in one of Priya's paid purchases that she has not saved yet.
        var connectionString = await OwnDatabaseAsync("saves_premium");
        var owned = await ScalarAsync(connectionString, $"""
            SELECT oir.recipe_id
            FROM order_item_recipes oir
            JOIN order_items oi ON oi.id = oir.order_item_id
            JOIN orders o ON o.id = oi.order_id
            JOIN recipes r ON r.id = oir.recipe_id
            WHERE o.user_id = {Priya} AND o.status = 'Paid' AND r.visibility = 'ProductOnly'
              AND NOT EXISTS (SELECT 1 FROM saved_recipes s WHERE s.user_id = {Priya} AND s.recipe_id = oir.recipe_id)
            ORDER BY oir.recipe_id LIMIT 1
            """);

        var response = await SendAsync(connectionString, HttpMethod.Put, $"/api/me/saves/{owned}", Priya);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True((await ReadStateAsync(response)).Saved);
    }

    [Theory]
    [InlineData(Sam, ChickenTeriyaki, HttpStatusCode.NotFound)]   // premium, and Sam has bought nothing
    [InlineData(Sam, MisoSoupDraft, HttpStatusCode.NotFound)]     // a draft
    [InlineData(Kenji, MisoSoupDraft, HttpStatusCode.NotFound)]   // his own draft: he can open it, not save it
    [InlineData(Sam, 999, HttpStatusCode.NotFound)]               // no such recipe
    [InlineData(Admin, Caprese, HttpStatusCode.Forbidden)]        // the admin does not save
    [InlineData(999, Caprese, HttpStatusCode.Forbidden)]          // no such account
    public async Task A_recipe_the_caller_may_not_save_is_refused_and_nothing_is_written(int caller, int recipeId,
        HttpStatusCode expected)
    {
        var connectionString = await databases.EfWithDbSeederAsync();
        var before = await ScalarAsync(connectionString, "SELECT COUNT(*) FROM saved_recipes");

        var response = await SendAsync(connectionString, HttpMethod.Put, $"/api/me/saves/{recipeId}", caller);

        Assert.Equal(expected, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal(before, await ScalarAsync(connectionString, "SELECT COUNT(*) FROM saved_recipes"));
    }

    [Theory]
    [InlineData("GET", "/api/me/saves")]
    [InlineData("DELETE", "/api/me/saves/15")]
    public async Task The_admin_has_no_saves(string method, string url)
    {
        var response = await SendAsync(await databases.EfWithDbSeederAsync(), new HttpMethod(method), url, Admin);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Unsaving_a_recipe_that_does_not_exist_is_a_404()
    {
        var response = await SendAsync(await databases.EfWithDbSeederAsync(), HttpMethod.Delete, "/api/me/saves/999", Sam);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private async Task<List<SavedRecipeDto>> GetSavedAsync(string connectionString, int caller)
    {
        var response = await SendAsync(connectionString, HttpMethod.Get, "/api/me/saves", caller);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<List<SavedRecipeDto>>(TestContext.Current.CancellationToken))!;
    }

    private static async Task<SaveStateDto> ReadStateAsync(HttpResponseMessage response) =>
        (await response.Content.ReadFromJsonAsync<SaveStateDto>(TestContext.Current.CancellationToken))!;

    private async Task<HttpResponseMessage> SendAsync(string connectionString, HttpMethod method, string url, int caller)
    {
        if (!_apis.TryGetValue(connectionString, out var api))
        {
            _apis[connectionString] = api = new CookfeedApiFactory(connectionString);
        }

        using var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-User-Id", caller.ToString());
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
