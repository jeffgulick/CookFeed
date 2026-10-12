using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Cookfeed.Contracts.Recipes;
using Cookfeed.Contracts.Storefront;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// <c>GET /api/recipes/{id}</c> over HTTP, against the database <c>DbSeeder</c> builds. The ingredient lines are held to
/// <c>docs/sql/queries.sql</c> Q4 and who may open a ProductOnly recipe to Q14, run on the same database. Anything the
/// viewer may not open is a 404, the same as an id that does not exist. These tests only read.
/// </summary>
public sealed class RecipeDetailEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    private const int Carbonara = 1, Teriyaki = 5, Onigiri = 6, Oats = 9, MisoDraft = 13;
    private const int Alex = 1, Kenji = 4, Sam = 7;
    private CookfeedApiFactory? _api;

    [Fact]
    public async Task The_ingredient_lines_match_Q4_in_display_order()
    {
        // Q4 is written for 15-Minute Spaghetti Carbonara.
        var q4 = await Sql.QueryAsync(await ConnectionStringAsync(), SqlFiles.Query(4));
        var expected = q4.Select(row => (int.Parse(row[0]!, CultureInfo.InvariantCulture),
            decimal.Parse(row[1]!, CultureInfo.InvariantCulture), row[2], row[3], row[4])).ToList();

        var recipe = await GetRecipeAsync(Carbonara);

        Assert.Equal(expected, recipe.Ingredients.Select(i => (i.SortOrder, i.Quantity, (string?)i.Unit,
            (string?)i.Ingredient, i.Preparation)).ToList());
    }

    [Fact]
    public async Task The_steps_come_in_order_with_their_video_timestamps()
    {
        var expected = await Sql.QueryLinesAsync(await ConnectionStringAsync(), $"""
            SELECT step_number, instruction, video_timestamp_seconds FROM recipe_steps
            WHERE recipe_id = {Teriyaki} ORDER BY step_number
            """);

        var recipe = await GetRecipeAsync(Teriyaki);

        Assert.Equal(expected, recipe.Steps.Select(s => string.Join(" | ", s.StepNumber, s.Instruction, s.VideoTimestampSeconds)));
    }

    [Fact]
    public async Task The_header_carries_the_recipe_and_its_creator_as_stored()
    {
        var expected = await Sql.QueryLinesAsync(await ConnectionStringAsync(), $"""
            SELECT r.title, r.servings, r.prep_minutes, r.cook_minutes, r.save_count, r.visibility, c.handle, u.display_name
            FROM recipes r JOIN creator_profiles c ON r.creator_id = c.user_id JOIN users u ON u.id = c.user_id
            WHERE r.id = {Teriyaki}
            """);

        var r = await GetRecipeAsync(Teriyaki);

        Assert.Equal(expected, [string.Join(" | ", r.Title, r.Servings, r.PrepMinutes, r.CookMinutes, r.SaveCount,
            r.Visibility, r.Creator.Handle, r.Creator.DisplayName)]);
        Assert.Equal(r.PrepMinutes + r.CookMinutes, r.TotalMinutes);
        Assert.True(r.IsPublished);
    }

    [Fact]
    public async Task Every_viewer_opens_a_product_only_recipe_exactly_when_Q14_or_authorship_allows()
    {
        var connection = await ConnectionStringAsync();
        var recipeIds = (await Sql.QueryAsync(connection, "SELECT title, id, creator_id FROM recipes"))
            .ToDictionary(row => row[0]!, row => (Id: int.Parse(row[1]!), CreatorId: int.Parse(row[2]!)));
        var userIds = (await Sql.QueryAsync(connection, "SELECT display_name, id FROM users"))
            .ToDictionary(row => row[0]!, row => int.Parse(row[1]!));

        foreach (var row in await Sql.QueryAsync(connection, SqlFiles.Query(14)))
        {
            var (recipe, viewer, q14) = (recipeIds[row[0]!], userIds[row[1]!], bool.Parse(row[2]!));
            var expected = q14 || viewer == recipe.CreatorId ? HttpStatusCode.OK : HttpStatusCode.NotFound;

            var response = await SendAsync($"/api/recipes/{recipe.Id}", viewer.ToString(CultureInfo.InvariantCulture));

            Assert.True(expected == response.StatusCode, $"{row[1]} opening {row[0]}: expected {expected}, got {response.StatusCode}");
        }
    }

    [Fact]
    public async Task A_product_only_recipe_is_404_to_a_signed_out_visitor()
    {
        var response = await SendAsync($"/api/recipes/{Onigiri}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData(null, HttpStatusCode.NotFound)]
    [InlineData(Sam, HttpStatusCode.NotFound)]
    [InlineData(Kenji, HttpStatusCode.OK)]
    public async Task A_draft_opens_only_for_its_creator(int? viewer, HttpStatusCode expected)
    {
        var response = await SendAsync($"/api/recipes/{MisoDraft}", viewer?.ToString(CultureInfo.InvariantCulture));

        Assert.Equal(expected, response.StatusCode);
    }

    [Fact]
    public async Task Its_creator_sees_the_draft_marked_as_one()
    {
        var recipe = await GetRecipeAsync(MisoDraft, Kenji);

        Assert.False(recipe.IsPublished);
        Assert.Null(recipe.PublishedAt);
        Assert.True(recipe.ViewerIsCreator);
    }

    [Theory]
    [InlineData("/api/recipes/999")]
    [InlineData("/api/recipes/0")]
    [InlineData("/api/recipes/oats")]
    public async Task An_id_that_names_no_recipe_is_404(string route)
    {
        var response = await SendAsync(route);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Included_in_lists_each_placement_so_a_repeated_recipe_appears_twice()
    {
        // Family Week on a Budget serves the oats on day 0 and day 3, both at breakfast.
        var recipe = await GetRecipeAsync(Oats);

        Assert.Equal(
            [(4, "Family Week on a Budget", ProductType.MealPlan, 0, MealSlot.Breakfast),
             (4, "Family Week on a Budget", ProductType.MealPlan, 3, MealSlot.Breakfast)],
            recipe.IncludedIn.Select(p => (p.ProductId, p.ProductTitle, p.ProductType, p.DayOffset!.Value, p.Slot!.Value)));
    }

    [Theory]
    [InlineData(Alex, true)]    // a Paid order for Family Week
    [InlineData(Sam, false)]    // no orders
    public async Task Included_in_says_whether_the_viewer_owns_each_product(int viewer, bool owns)
    {
        var recipe = await GetRecipeAsync(Oats, viewer);

        Assert.All(recipe.IncludedIn, p => Assert.Equal(owns, p.OwnedByViewer));
    }

    [Fact]
    public async Task Included_in_leaves_out_retired_products_and_collections_carry_no_day()
    {
        var expected = await Sql.QueryLinesAsync(await ConnectionStringAsync(), $"""
            SELECT p.id FROM product_recipes pr JOIN products p ON p.id = pr.product_id
            WHERE pr.recipe_id = {Carbonara} AND p.is_active ORDER BY p.id, pr.sort_order
            """);

        var recipe = await GetRecipeAsync(Carbonara);

        Assert.Equal(expected, recipe.IncludedIn.Select(p => p.ProductId.ToString(CultureInfo.InvariantCulture)));
        Assert.All(recipe.IncludedIn, p => Assert.True(p.DayOffset is null && p.Slot is null));
    }

    [Theory]
    [InlineData(Alex, true)]     // Alex saved the teriyaki
    [InlineData(Kenji, false)]   // its creator has not
    public async Task Saved_by_viewer_follows_the_viewers_saves(int viewer, bool saved)
    {
        var recipe = await GetRecipeAsync(Teriyaki, viewer);

        Assert.Equal(saved, recipe.SavedByViewer);
    }

    [Fact]
    public async Task A_viewer_id_that_is_not_a_number_is_refused_with_400()
    {
        var response = await SendAsync($"/api/recipes/{Teriyaki}", "alex");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task<RecipeDetailDto> GetRecipeAsync(int id, int? viewer = null)
    {
        var response = await SendAsync($"/api/recipes/{id}", viewer?.ToString(CultureInfo.InvariantCulture));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<RecipeDetailDto>(TestContext.Current.CancellationToken))!;
    }

    private async Task<HttpResponseMessage> SendAsync(string url, string? viewerHeader = null)
    {
        _api ??= new CookfeedApiFactory(await ConnectionStringAsync());
        using var request = new HttpRequestMessage(HttpMethod.Get, url);
        if (viewerHeader is not null)
        {
            request.Headers.Add("X-User-Id", viewerHeader);
        }
        return await _api.CreateClient().SendAsync(request, TestContext.Current.CancellationToken);
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
