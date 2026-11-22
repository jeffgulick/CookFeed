using System.Net;
using System.Net.Http.Json;
using Cookfeed.Contracts.Trips;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// The caller's shopping lists over HTTP (<c>/api/me/trips</c>, DesignDocument.md §3.9): one list at a time, made
/// the first time a recipe or a plan is shopped; its lines computed from the recipes on it with the arithmetic of
/// the shopping list (§7.5), never stored; "Have it" takes a line off; and the list moves from Building to Shopping
/// to Done. The seed has no lists. Every test that writes builds its own database.
/// </summary>
public sealed class TripsEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    private const int SheetPanChicken = 18, Caprese = 15, ChickenTeriyaki = 5, MisoSoupDraft = 13, FamilyWeek = 4;
    private const int Alex = 1, Priya = 2, Admin = 6, Sam = 7;
    private readonly Dictionary<string, CookfeedApiFactory> _apis = [];

    [Fact]
    public async Task A_cook_with_no_list_has_none_and_no_past_lists()
    {
        var trips = await GetAsync<TripsDto>(await databases.EfWithDbSeederAsync(), "/api/me/trips", Sam);

        Assert.Null(trips.Active);
        Assert.Empty(trips.Past);
    }

    [Fact]
    public async Task Shopping_a_recipe_makes_the_list_and_puts_the_recipe_on_it_for_the_people_asked()
    {
        var connectionString = await OwnDatabaseAsync("trip_shop");

        var response = await SendAsync(connectionString, HttpMethod.Post, "/api/me/trips/items", Sam,
            new { recipeId = SheetPanChicken, servings = 6 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var result = (await response.Content.ReadFromJsonAsync<ShopResultDto>(TestContext.Current.CancellationToken))!;
        Assert.True(result.Created);
        Assert.Equal((1, 0), (result.Added, result.AlreadyOnList));
        Assert.StartsWith("Shopping list, ", result.TripName);

        var trip = await GetAsync<TripDto>(connectionString, $"/api/me/trips/{result.TripId}", Sam);
        Assert.Equal(TripStatus.Building, trip.Status);
        Assert.True(trip.CanChange);
        var item = Assert.Single(trip.Items);
        Assert.Equal((SheetPanChicken, "Sheet-Pan Chicken and Vegetables", 6), (item.RecipeId, item.Title, item.Servings));
        var trips = await GetAsync<TripsDto>(connectionString, "/api/me/trips", Sam);
        Assert.Equal((result.TripId, 1), (trips.Active!.Id, trips.Active.RecipeCount));
    }

    [Theory]
    [InlineData(-1, true)]     // yesterday where the server is: evening for a cook west of UTC
    [InlineData(1, true)]      // tomorrow where the server is: morning for a cook east of UTC
    [InlineData(-40, false)]   // not a date it can be for anyone today: the server's own day is used
    public async Task A_new_list_is_named_for_the_cooks_own_day_when_the_app_sends_it(int daysFromUtcToday, bool used)
    {
        var connectionString = await OwnDatabaseAsync("trip_name");
        var utcToday = DateOnly.FromDateTime(DateTime.UtcNow);
        var sent = utcToday.AddDays(daysFromUtcToday);

        var result = await ShopAsync(connectionString, Sam, new { recipeId = Caprese, today = sent.ToString("yyyy-MM-dd") });

        var expected = (used ? sent : utcToday).ToString("MMMM d", System.Globalization.CultureInfo.InvariantCulture);
        Assert.Equal($"Shopping list, {expected}", result.TripName);
    }

    [Fact]
    public async Task A_second_recipe_goes_on_the_same_list_and_a_recipe_is_never_on_it_twice()
    {
        var connectionString = await OwnDatabaseAsync("trip_one_list");
        var first = await ShopAsync(connectionString, Sam, new { recipeId = SheetPanChicken });

        var second = await ShopAsync(connectionString, Sam, new { recipeId = Caprese });
        var again = await ShopAsync(connectionString, Sam, new { recipeId = Caprese });

        Assert.False(second.Created);
        Assert.Equal(first.TripId, second.TripId);
        Assert.Equal((0, 1), (again.Added, again.AlreadyOnList));
        var trip = await GetAsync<TripDto>(connectionString, $"/api/me/trips/{first.TripId}", Sam);
        Assert.Equal([SheetPanChicken, Caprese], trip.Items.Select(i => i.RecipeId));
        Assert.Equal("1", await ScalarAsync(connectionString, $"SELECT COUNT(*) FROM shopping_trips WHERE user_id = {Sam}"));
    }

    [Fact]
    public async Task With_no_people_given_a_recipe_goes_on_for_the_people_it_is_written_for()
    {
        var connectionString = await OwnDatabaseAsync("trip_default_people");
        var written = int.Parse((await ScalarAsync(connectionString, $"SELECT servings FROM recipes WHERE id = {Caprese}"))!);

        var result = await ShopAsync(connectionString, Sam, new { recipeId = Caprese });

        var trip = await GetAsync<TripDto>(connectionString, $"/api/me/trips/{result.TripId}", Sam);
        Assert.Equal(written, Assert.Single(trip.Items).Servings);
    }

    [Fact]
    public async Task The_lines_are_the_recipes_ingredients_and_double_when_the_people_double()
    {
        var connectionString = await OwnDatabaseAsync("trip_lines");
        var written = int.Parse((await ScalarAsync(connectionString, $"SELECT servings FROM recipes WHERE id = {SheetPanChicken}"))!);
        var ingredients = await Sql.QueryAsync(connectionString, $"""
            SELECT DISTINCT ingredient_id FROM recipe_ingredients
            WHERE recipe_id = {SheetPanChicken} AND NOT is_optional ORDER BY 1
            """);
        var result = await ShopAsync(connectionString, Sam, new { recipeId = SheetPanChicken });

        var once = await GetAsync<TripDto>(connectionString, $"/api/me/trips/{result.TripId}", Sam);
        var doubled = await ReadAsync<TripDto>(await SendAsync(connectionString, HttpMethod.Put,
            $"/api/me/trips/{result.TripId}/items/{SheetPanChicken}", Sam, new { servings = written * 2 }));

        Assert.NotEmpty(ingredients);
        Assert.Equal(ingredients.Select(row => int.Parse(row[0]!)), once.Lines.Select(l => l.IngredientId).Distinct().Order());
        Assert.All(once.Lines, line => Assert.True(line.Quantity > 0));
        Assert.Equal(once.Lines.Select(l => (l.IngredientId, l.Unit, Quantity: Math.Round(l.Quantity * 2, 1))),
            doubled.Lines.Select(l => (l.IngredientId, l.Unit, Quantity: Math.Round(l.Quantity, 1))));
        // Sorted by aisle, then by name, the way the store is walked.
        Assert.Equal(once.Lines.OrderBy(l => l.Aisle, StringComparer.Ordinal).ThenBy(l => l.Ingredient, StringComparer.Ordinal)
            .Select(l => l.IngredientId), once.Lines.Select(l => l.IngredientId));
    }

    [Fact]
    public async Task Have_it_takes_a_line_off_the_list_and_putting_it_back_returns_it()
    {
        var connectionString = await OwnDatabaseAsync("trip_skip");
        var result = await ShopAsync(connectionString, Sam, new { recipeId = SheetPanChicken });
        var before = await GetAsync<TripDto>(connectionString, $"/api/me/trips/{result.TripId}", Sam);
        var have = before.Lines[0];

        var skipped = await ReadAsync<TripDto>(await SendAsync(connectionString, HttpMethod.Put,
            $"/api/me/trips/{result.TripId}/skips/{have.IngredientId}", Sam));
        var back = await ReadAsync<TripDto>(await SendAsync(connectionString, HttpMethod.Delete,
            $"/api/me/trips/{result.TripId}/skips/{have.IngredientId}", Sam));

        Assert.DoesNotContain(skipped.Lines, l => l.IngredientId == have.IngredientId);
        Assert.Equal((have.IngredientId, have.Ingredient), (skipped.Skipped.Single().IngredientId, skipped.Skipped.Single().Ingredient));
        Assert.Equal(before.Lines.Count, back.Lines.Count);
        Assert.Empty(back.Skipped);
    }

    [Fact]
    public async Task Shopping_a_plan_puts_every_recipe_of_the_purchase_on_the_list_a_repeated_one_for_both_meals()
    {
        // Family Week on a Budget has the oats on two mornings: 5 recipes, 6 meals.
        var connectionString = await OwnDatabaseAsync("trip_plan");
        var expected = await Sql.QueryLinesAsync(connectionString, $"""
            SELECT oir.recipe_id, SUM(r.servings)
            FROM order_item_recipes oir
            JOIN order_items oi ON oi.id = oir.order_item_id
            JOIN orders o ON o.id = oi.order_id
            JOIN recipes r ON r.id = oir.recipe_id
            WHERE o.user_id = {Priya} AND o.status = 'Paid' AND oi.product_id = {FamilyWeek}
            GROUP BY oir.recipe_id ORDER BY MIN(oir.sort_order)
            """);

        var result = await ShopAsync(connectionString, Priya, new { productId = FamilyWeek });

        var trip = await GetAsync<TripDto>(connectionString, $"/api/me/trips/{result.TripId}", Priya);
        Assert.Equal(5, expected.Count);
        Assert.Equal(expected, trip.Items.Select(i => $"{i.RecipeId} | {i.Servings}"));
        Assert.Equal(5, result.Added);
    }

    [Theory]
    [InlineData(Sam, "recipeId", ChickenTeriyaki, HttpStatusCode.NotFound)]   // premium, not bought
    [InlineData(Sam, "recipeId", MisoSoupDraft, HttpStatusCode.NotFound)]     // a draft
    [InlineData(Sam, "recipeId", 999, HttpStatusCode.NotFound)]               // no such recipe
    [InlineData(Sam, "productId", FamilyWeek, HttpStatusCode.NotFound)]       // a plan Sam does not own
    [InlineData(Admin, "recipeId", Caprese, HttpStatusCode.Forbidden)]        // the admin does not shop
    public async Task What_the_caller_may_not_cook_from_is_refused_and_no_empty_list_is_left_behind(int caller,
        string field, int id, HttpStatusCode expected)
    {
        var connectionString = await databases.EfWithDbSeederAsync();

        var response = await SendAsync(connectionString, HttpMethod.Post, "/api/me/trips/items", caller,
            new Dictionary<string, int> { [field] = id });

        Assert.Equal(expected, response.StatusCode);
        Assert.Equal("0", await ScalarAsync(connectionString, "SELECT COUNT(*) FROM shopping_trips"));
    }

    [Theory]
    [InlineData("{}")]                                        // neither a recipe nor a plan
    [InlineData("{\"recipeId\":15,\"productId\":4}")]         // both
    [InlineData("{\"recipeId\":15,\"servings\":0}")]
    [InlineData("{\"recipeId\":15,\"servings\":51}")]
    public async Task A_request_that_names_no_one_thing_or_an_impossible_number_of_people_is_a_400(string json)
    {
        var connectionString = await databases.EfWithDbSeederAsync();
        _apis.TryAdd(connectionString, new CookfeedApiFactory(connectionString));
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/me/trips/items")
        {
            Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json"),
        };
        request.Headers.Add("X-User-Id", Sam.ToString());

        var response = await _apis[connectionString].CreateClient().SendAsync(request, TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task A_list_goes_from_building_to_shopping_to_done_and_then_it_is_history()
    {
        var connectionString = await OwnDatabaseAsync("trip_life");
        var result = await ShopAsync(connectionString, Sam, new { recipeId = SheetPanChicken });
        var trip = $"/api/me/trips/{result.TripId}";

        // Not yet started, so it cannot be finished.
        Assert.Equal(HttpStatusCode.Conflict, (await SendAsync(connectionString, HttpMethod.Post, $"{trip}/done", Sam)).StatusCode);

        var shopping = await ReadAsync<TripDto>(await SendAsync(connectionString, HttpMethod.Post, $"{trip}/start", Sam));
        Assert.Equal(TripStatus.Shopping, shopping.Status);
        Assert.True(shopping.CanChange);
        Assert.Equal(HttpStatusCode.Conflict, (await SendAsync(connectionString, HttpMethod.Post, $"{trip}/start", Sam)).StatusCode);

        var done = await ReadAsync<TripDto>(await SendAsync(connectionString, HttpMethod.Post, $"{trip}/done", Sam));
        Assert.Equal(TripStatus.Done, done.Status);
        Assert.False(done.CanChange);
        Assert.NotNull(done.CompletedAt);

        // A done list is kept, read-only, and is no longer the list in use.
        var trips = await GetAsync<TripsDto>(connectionString, "/api/me/trips", Sam);
        Assert.Null(trips.Active);
        Assert.Equal(result.TripId, Assert.Single(trips.Past).Id);
        Assert.Equal(HttpStatusCode.Conflict, (await SendAsync(connectionString, HttpMethod.Delete,
            $"{trip}/items/{SheetPanChicken}", Sam)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await SendAsync(connectionString, HttpMethod.Put,
            $"{trip}/items/{SheetPanChicken}", Sam, new { servings = 2 })).StatusCode);

        // The next recipe shopped starts a new list.
        var next = await ShopAsync(connectionString, Sam, new { recipeId = Caprese });
        Assert.True(next.Created);
        Assert.NotEqual(result.TripId, next.TripId);
    }

    [Fact]
    public async Task A_recipe_is_taken_off_and_a_list_is_deleted_with_everything_on_it()
    {
        var connectionString = await OwnDatabaseAsync("trip_delete");
        var result = await ShopAsync(connectionString, Sam, new { recipeId = SheetPanChicken });
        await ShopAsync(connectionString, Sam, new { recipeId = Caprese });
        var trip = $"/api/me/trips/{result.TripId}";

        var without = await ReadAsync<TripDto>(await SendAsync(connectionString, HttpMethod.Delete, $"{trip}/items/{Caprese}", Sam));
        Assert.Equal([SheetPanChicken], without.Items.Select(i => i.RecipeId));

        var deleted = await SendAsync(connectionString, HttpMethod.Delete, trip, Sam);

        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        Assert.Equal("0", await ScalarAsync(connectionString, "SELECT COUNT(*) FROM shopping_trips"));
        Assert.Equal("0", await ScalarAsync(connectionString, "SELECT COUNT(*) FROM shopping_trip_items"));
        Assert.Equal(HttpStatusCode.NotFound, (await SendAsync(connectionString, HttpMethod.Get, trip, Sam)).StatusCode);
    }

    [Fact]
    public async Task Nobody_reads_or_changes_another_cooks_list()
    {
        var connectionString = await OwnDatabaseAsync("trip_private");
        var result = await ShopAsync(connectionString, Sam, new { recipeId = SheetPanChicken });
        var trip = $"/api/me/trips/{result.TripId}";

        Assert.Equal(HttpStatusCode.NotFound, (await SendAsync(connectionString, HttpMethod.Get, trip, Alex)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await SendAsync(connectionString, HttpMethod.Post, $"{trip}/start", Alex)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await SendAsync(connectionString, HttpMethod.Delete, trip, Alex)).StatusCode);
        Assert.Equal("1", await ScalarAsync(connectionString, "SELECT COUNT(*) FROM shopping_trips"));
        // Alex shopping a recipe makes a list of his own.
        var own = await ShopAsync(connectionString, Alex, new { recipeId = Caprese });
        Assert.NotEqual(result.TripId, own.TripId);
    }

    [Fact]
    public async Task The_admin_has_no_lists()
    {
        var response = await SendAsync(await databases.EfWithDbSeederAsync(), HttpMethod.Get, "/api/me/trips", Admin);

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    private async Task<ShopResultDto> ShopAsync(string connectionString, int caller, object body)
    {
        var response = await SendAsync(connectionString, HttpMethod.Post, "/api/me/trips/items", caller, body);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadAsync<ShopResultDto>(response);
    }

    private async Task<T> GetAsync<T>(string connectionString, string url, int caller)
    {
        var response = await SendAsync(connectionString, HttpMethod.Get, url, caller);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await ReadAsync<T>(response);
    }

    private static async Task<T> ReadAsync<T>(HttpResponseMessage response)
    {
        Assert.True(response.IsSuccessStatusCode, $"Expected success, got {(int)response.StatusCode}.");
        return (await response.Content.ReadFromJsonAsync<T>(TestContext.Current.CancellationToken))!;
    }

    private async Task<HttpResponseMessage> SendAsync(string connectionString, HttpMethod method, string url, int caller,
        object? body = null)
    {
        if (!_apis.TryGetValue(connectionString, out var api))
        {
            _apis[connectionString] = api = new CookfeedApiFactory(connectionString);
        }

        using var request = new HttpRequestMessage(method, url);
        request.Headers.Add("X-User-Id", caller.ToString());
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
