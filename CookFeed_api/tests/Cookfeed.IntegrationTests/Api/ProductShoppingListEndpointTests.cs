using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Cookfeed.Contracts.Products;
using Cookfeed.Domain.Enums;
using Cookfeed.Domain.ShoppingList;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// <c>GET /api/products/{id}/shopping-list</c> over HTTP: "What you'll buy" on a plan's page, every ingredient of the
/// recipes the viewer may open, as each recipe is written, combined by <c>ShoppingListAggregator</c>
/// (DesignDocument.md §7). Each test adds the ingredient lines up again in plain SQL and runs the aggregator over
/// them, so the endpoint is checked against a second route to the same numbers. A recipe the viewer may not open adds
/// nothing and is named in <c>lockedRecipes</c> instead. These tests only read.
/// </summary>
public sealed class ProductShoppingListEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    private const int RomanPasta = 1, BreadBox = 2, ThreeWeeknights = 3, FamilyWeek = 4, RetiredGrilling = 5;
    private const int Alex = 1, Kenji = 4, Sam = 7;
    private const int Focaccia = 3;
    private CookfeedApiFactory? _api;

    [Theory]
    [InlineData("/api/products/999/shopping-list")]
    [InlineData("/api/products/0/shopping-list")]
    [InlineData("/api/products/family-week/shopping-list")]
    public async Task An_id_that_names_no_product_is_404(string route)
    {
        var response = await SendAsync(route);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData(ThreeWeeknights)]
    [InlineData(FamilyWeek)]       // serves the oats twice, so their ingredients are bought twice
    public async Task A_buyers_list_is_every_meal_they_bought_added_up(int productId)
    {
        var expected = await ExpectedLinesAsync($"""
            SELECT oir.recipe_id FROM order_item_recipes oir
            JOIN order_items oi ON oi.id = oir.order_item_id JOIN orders o ON o.id = oi.order_id
            WHERE o.user_id = {Alex} AND o.status = 'Paid' AND oi.product_id = {productId}
            """);

        var list = await GetListAsync(productId, Alex);

        Assert.NotEmpty(expected.Lines);
        Assert.Equal(expected.Lines, Lines(list.Lines));
        Assert.Equal(expected.Unmerged, Lines(list.Unmerged));
        Assert.Empty(list.LockedRecipes);
    }

    [Fact]
    public async Task A_recipe_served_twice_counts_twice()
    {
        // Rolled oats are only in Five-Day Overnight Oats (2.5 cups), which Family Week serves on two mornings.
        // One morning: 2.5 c x 236.588 ml x 0.41 g/ml = 242.5027 g. Two: 485.0054 g, shown as 485.01. The amounts are
        // added before they are rounded, so it is not twice the rounded 242.50.
        var once = await ExpectedLinesAsync("SELECT id FROM recipes WHERE title = 'Five-Day Overnight Oats'");

        var list = await GetListAsync(FamilyWeek, Alex);

        var oatsOnce = Assert.Single(once.Lines, l => l.Ingredient == "rolled oats");
        var oatsInPlan = Assert.Single(list.Lines, l => l.Ingredient == "rolled oats");
        Assert.Equal((242.50m, "g"), (oatsOnce.Quantity, oatsOnce.Unit));
        Assert.Equal((485.01m, "g"), (oatsInPlan.Quantity, oatsInPlan.Unit));
    }

    [Fact]
    public async Task The_list_names_the_recipes_it_is_for_once_each_in_plan_order()
    {
        var titles = await Sql.QueryAsync(await ConnectionStringAsync(), $"""
            SELECT r.title FROM product_recipes pr JOIN recipes r ON r.id = pr.recipe_id
            WHERE pr.product_id = {FamilyWeek} GROUP BY r.title ORDER BY min(pr.sort_order)
            """);

        var list = await GetListAsync(FamilyWeek, Alex);

        Assert.Equal(5, titles.Count);
        Assert.Equal(titles.Select(row => row[0]), list.FromRecipes);
    }

    [Theory]
    [InlineData(null)]
    [InlineData(Sam)]
    public async Task A_viewer_who_has_not_bought_it_gets_an_empty_list_and_the_locked_recipes_by_name(int? viewer)
    {
        var list = await GetListAsync(ThreeWeeknights, viewer);

        Assert.Empty(list.Lines);
        Assert.Empty(list.Unmerged);
        Assert.Empty(list.FromRecipes);
        Assert.Equal(["Chicken Teriyaki, the Real Way", "10-Minute Ginger Garlic Stir-Fry", "Onigiri Three Ways"],
            list.LockedRecipes);
    }

    [Fact]
    public async Task Only_the_recipes_the_viewer_may_open_are_on_the_list()
    {
        // The Bread Box: Alex owns the focaccia through Roman Pasta Collection, and has not bought the ciabatta.
        var expected = await ExpectedLinesAsync($"SELECT {Focaccia}");

        var list = await GetListAsync(BreadBox, Alex);

        Assert.Equal(expected.Lines, Lines(list.Lines));
        Assert.Equal(["No-Knead Focaccia"], list.FromRecipes);
        Assert.Equal(["Rosemary Ciabatta"], list.LockedRecipes);
    }

    [Fact]
    public async Task A_buyers_list_follows_their_purchase_not_the_product_as_it_is_today()
    {
        // Q15: Alex's Roman Pasta Collection still holds the focaccia; the product on sale no longer does.
        var list = await GetListAsync(RomanPasta, Alex);

        Assert.Contains("No-Knead Focaccia", list.FromRecipes);
        Assert.Equal(4, list.FromRecipes.Count);
    }

    [Fact]
    public async Task Its_creator_gets_the_whole_list()
    {
        var expected = await ExpectedLinesAsync($"SELECT recipe_id FROM product_recipes WHERE product_id = {ThreeWeeknights}");

        var list = await GetListAsync(ThreeWeeknights, Kenji);

        Assert.Equal(expected.Lines, Lines(list.Lines));
        Assert.Empty(list.LockedRecipes);
    }

    [Fact]
    public async Task A_product_with_no_recipes_has_an_empty_list()
    {
        var list = await GetListAsync(RetiredGrilling);

        Assert.Equal((0, 0, 0, 0), (list.Lines.Count, list.Unmerged.Count, list.FromRecipes.Count, list.LockedRecipes.Count));
    }

    [Fact]
    public async Task A_viewer_id_that_is_not_a_number_is_refused_with_400()
    {
        var response = await SendAsync($"/api/products/{ThreeWeeknights}/shopping-list", "alex");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // The same arithmetic as the endpoint, by another route: every non-optional ingredient line of the given recipes
    // (one row per meal, so a recipe listed twice counts twice), summed per ingredient and unit category in plain SQL,
    // then combined by the aggregator.
    private async Task<(List<Line> Lines, List<Line> Unmerged)> ExpectedLinesAsync(string recipeIdsSql)
    {
        var rows = await Sql.QueryAsync(await ConnectionStringAsync(), $"""
            SELECT i.id, i.name, i.category, i.density_g_per_ml, pu.category, pu.to_base_factor, pu.abbreviation,
                   u.category, SUM(ROUND(ri.quantity * u.to_base_factor, 6))
            FROM ({recipeIdsSql}) AS meals(recipe_id)
            JOIN recipe_ingredients ri ON ri.recipe_id = meals.recipe_id AND NOT ri.is_optional
            JOIN units u ON u.id = ri.unit_id
            JOIN ingredients i ON i.id = ri.ingredient_id
            LEFT JOIN units pu ON pu.id = i.preferred_shopping_unit_id
            GROUP BY i.id, i.name, i.category, i.density_g_per_ml, pu.category, pu.to_base_factor, pu.abbreviation, u.category
            """);

        var list = ShoppingListAggregator.Aggregate(rows.Select(row => new IngredientTotal(
            int.Parse(row[0]!, CultureInfo.InvariantCulture),
            row[1]!,
            row[2]!,
            row[3] is null ? null : decimal.Parse(row[3]!, CultureInfo.InvariantCulture),
            row[4] is null ? null : Enum.Parse<UnitCategory>(row[4]!),
            row[5] is null ? null : decimal.Parse(row[5]!, CultureInfo.InvariantCulture),
            row[6],
            Enum.Parse<UnitCategory>(row[7]!),
            decimal.Parse(row[8]!, CultureInfo.InvariantCulture))));

        return ([.. list.Lines.Select(l => new Line(l.IngredientId, l.Ingredient, l.Aisle, l.Quantity, l.Unit))],
            [.. list.Unmerged.Select(l => new Line(l.IngredientId, l.Ingredient, l.Aisle, l.Quantity, l.Unit))]);
    }

    private static List<Line> Lines(IEnumerable<Contracts.ShoppingList.ShoppingListLineDto> lines) =>
        [.. lines.Select(l => new Line(l.IngredientId, l.Ingredient, l.Aisle, l.Quantity, l.Unit))];

    private sealed record Line(int IngredientId, string Ingredient, string Aisle, decimal Quantity, string Unit);

    private async Task<ProductShoppingListDto> GetListAsync(int productId, int? viewer = null)
    {
        var response = await SendAsync($"/api/products/{productId}/shopping-list", viewer?.ToString(CultureInfo.InvariantCulture));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ProductShoppingListDto>(TestContext.Current.CancellationToken))!;
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
