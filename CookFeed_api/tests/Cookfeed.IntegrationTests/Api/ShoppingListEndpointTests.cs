using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Cookfeed.Contracts.ShoppingList;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// <c>GET /api/me/shopping-list</c> over HTTP. The API splits the work between SQL (recipes, scale, sums per unit
/// category) and <c>ShoppingListAggregator</c> (conversion and presentation); <c>docs/sql/queries.sql</c> Q8 does
/// all of it in SQL. These tests hold the two to the same answer: every line the API returns, merged or not, must
/// be a line of Q8 run on the same database, and the other way round.
/// </summary>
public sealed class ShoppingListEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    // One in-memory API per database: the shared seeded one, plus the planned-twice test's own.
    private readonly Dictionary<string, CookfeedApiFactory> _apis = [];

    [Fact]
    public async Task Alexs_list_matches_Q8_line_for_line()
    {
        // Q8 is written for alex@example.com, user 1, over every plan he has.
        var connectionString = await databases.EfWithDbSeederAsync();
        var expected = await Sql.QueryLinesAsync(connectionString, SqlFiles.Query(8));

        var list = await GetListAsync(connectionString, callerId: 1);

        Assert.Equal(41, expected.Count);
        AssertSame.Lines(expected, AllLines(list), "Shopping list", expectedSource: "Q8", actualSource: "API response");
    }

    [Fact]
    public async Task Flour_adds_up_in_grams_and_milk_stays_in_millilitres()
    {
        // The two lines DesignDocument.md §7.3–7.4 works through by hand.
        var list = await GetListAsync(await databases.EfWithDbSeederAsync(), callerId: 1);

        Assert.Contains("Pantry | all-purpose flour | 1032.91 | g", AllLines(list));
        Assert.Contains("Dairy | whole milk | 946.35 | ml", AllLines(list));
    }

    [Theory]
    [InlineData("2026-09-21")]   // Alex's one plan: the same list as every plan
    [InlineData("2026-09-28")]   // a week with no plan: saved recipes only
    public async Task A_week_limits_the_planned_recipes_and_keeps_the_saved_ones(string weekStart)
    {
        var connectionString = await databases.EfWithDbSeederAsync();
        var expected = await Sql.QueryLinesAsync(connectionString, Q8ForWeek(weekStart));

        var list = await GetListAsync(connectionString, callerId: 1, weekStart);

        Assert.NotEmpty(expected);
        AssertSame.Lines(expected, AllLines(list), "Shopping list", expectedSource: $"Q8 for {weekStart}", actualSource: "API response");
    }

    [Fact]
    public async Task A_recipe_planned_on_two_nights_counts_twice()
    {
        // §7.6: cooking tacos twice means buying for tacos twice. Built on a database of its own, since it adds a row.
        var connectionString = await databases.CreateMigratedDatabaseAsync("taco_twice");
        await DatabaseFixture.SeedWithDbSeederAsync(connectionString);
        await Sql.ExecuteAsync(connectionString, """
            INSERT INTO meal_plan_entries (meal_plan_id, recipe_id, planned_date, slot)
            VALUES (1, 10, '2026-09-25', 'Dinner')
            """);
        var expected = await Sql.QueryLinesAsync(connectionString, SqlFiles.Query(8));

        var once = await GetListAsync(await databases.EfWithDbSeederAsync(), callerId: 1);
        var twice = await GetListAsync(connectionString, callerId: 1);

        AssertSame.Lines(expected, AllLines(twice), "Shopping list", expectedSource: "Q8", actualSource: "API response");
        Assert.Equal(2 * Tortillas(once), Tortillas(twice));
    }

    [Fact]
    public async Task A_caller_with_nothing_saved_or_planned_gets_an_empty_list()
    {
        // The admin (user 6) is the one seeded account that saves and plans nothing.
        var connectionString = await databases.EfWithDbSeederAsync();
        var activity = await Sql.QueryAsync(connectionString, """
            SELECT (SELECT count(*) FROM saved_recipes WHERE user_id = 6)
                 + (SELECT count(*) FROM meal_plans WHERE user_id = 6)
            """);
        Assert.Equal("0", activity[0][0]);

        var list = await GetListAsync(connectionString, callerId: 6);

        Assert.Empty(list.Lines);
        Assert.Empty(list.Unmerged);
    }

    [Theory]
    [InlineData(null, null)]
    [InlineData("alex", null)]
    [InlineData("1", "next-week")]
    public async Task A_missing_caller_or_a_bad_week_is_refused_with_400(string? callerHeader, string? weekStart)
    {
        var response = await SendAsync(await databases.EfWithDbSeederAsync(), callerHeader, weekStart);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // Q8 with its planned recipes limited to one week. It is the reference query with one condition added, so the
    // expectation is still the reviewed SQL, not a second implementation.
    private static string Q8ForWeek(string weekStart)
    {
        const string plannedFilter = "    WHERE u.email = 'alex@example.com'\n),\nsaved_not_planned AS";
        var q8 = SqlFiles.Query(8).ReplaceLineEndings("\n");
        Assert.Contains(plannedFilter, q8);
        return q8.Replace(plannedFilter,
            $"    WHERE u.email = 'alex@example.com' AND mp.week_start = DATE '{weekStart}'\n),\nsaved_not_planned AS");
    }

    // Formatted as Q8 prints its rows: aisle | ingredient | quantity to 2 places | unit.
    private static List<string> AllLines(ShoppingListDto list) =>
        [.. list.Lines.Concat(list.Unmerged).Select(l => string.Join(" | ",
            l.Aisle, l.Ingredient, l.Quantity.ToString("0.00", CultureInfo.InvariantCulture), l.Unit))];

    private static decimal Tortillas(ShoppingListDto list) =>
        list.Lines.Concat(list.Unmerged).Single(l => l.Ingredient == "flour tortilla").Quantity;

    private async Task<ShoppingListDto> GetListAsync(string connectionString, int callerId, string? weekStart = null)
    {
        var response = await SendAsync(connectionString, callerId.ToString(CultureInfo.InvariantCulture), weekStart);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ShoppingListDto>(TestContext.Current.CancellationToken))!;
    }

    private async Task<HttpResponseMessage> SendAsync(string connectionString, string? callerHeader, string? weekStart)
    {
        if (!_apis.TryGetValue(connectionString, out var api))
        {
            _apis[connectionString] = api = new CookfeedApiFactory(connectionString);
        }
        var url = weekStart is null ? "/api/me/shopping-list" : $"/api/me/shopping-list?weekStart={weekStart}";
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (callerHeader is not null)
        {
            request.Headers.Add("X-User-Id", callerHeader);
        }
        return await api.CreateClient().SendAsync(request, TestContext.Current.CancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        foreach (var api in _apis.Values)
        {
            await api.DisposeAsync();
        }
    }
}
