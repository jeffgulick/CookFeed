using System.Globalization;
using System.Net;
using System.Net.Http.Json;
using Cookfeed.Contracts.Products;
using Cookfeed.Contracts.Recipes;
using Cookfeed.Contracts.Storefront;
using Cookfeed.IntegrationTests.Support;

namespace Cookfeed.IntegrationTests.Api;

/// <summary>
/// <c>GET /api/products/{id}</c> over HTTP: the page of one meal plan or collection (the prototype's
/// <c>product.html</c>), against the database <c>DbSeeder</c> builds. Counts are held to <c>queries.sql</c> Q5, the
/// rating to Q13, and what a buyer sees to their purchase snapshot (Q15). A recipe the viewer may not open is listed
/// as a card only: no id, no times, no ingredient or step counts, no first step (DesignDocument.md §3.3, §3.7).
/// The tests that change rows each build their own database.
/// </summary>
public sealed class ProductPageEndpointTests(DatabaseFixture databases) : IAsyncDisposable
{
    private const int RomanPasta = 1, BreadBox = 2, ThreeWeeknights = 3, FamilyWeek = 4, RetiredGrilling = 5;
    private const int Alex = 1, Priya = 2, Kenji = 4, Dan = 5, Admin = 6, Sam = 7;
    private const int Focaccia = 3, Teriyaki = 5, Onigiri = 6, StirFry = 7, Ciabatta = 20;
    private CookfeedApiFactory? _api;

    [Theory]
    [InlineData("/api/products/999")]
    [InlineData("/api/products/0")]
    [InlineData("/api/products/family-week")]
    public async Task An_id_that_names_no_product_is_404(string route)
    {
        var response = await SendAsync(route);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Theory]
    [InlineData(RomanPasta)]
    [InlineData(ThreeWeeknights)]
    public async Task The_header_carries_the_product_and_its_creator_as_stored(int productId)
    {
        var expected = await Sql.QueryLinesAsync(await ConnectionStringAsync(), $"""
            SELECT p.id, p.type, p.title, p.description, p.cover_image_url, p.price_cents, p.currency,
                   c.handle, u.display_name, c.is_verified
            FROM products p JOIN creator_profiles c ON c.user_id = p.creator_id JOIN users u ON u.id = c.user_id
            WHERE p.id = {productId}
            """);

        var p = await GetProductAsync(productId);

        Assert.Equal(expected, [string.Join(" | ", p.Id, p.Type, p.Title, p.Description, p.CoverImageUrl, p.PriceCents,
            p.Currency, p.Creator.Handle, p.Creator.DisplayName, p.Creator.IsVerified)]);
    }

    [Fact]
    public async Task Recipe_and_meal_counts_match_Q5()
    {
        // Q5 is written for dan-meal-preps: Family Week on a Budget serves the oats twice, so 5 recipes and 6 meals.
        var expected = await Sql.QueryLinesAsync(await ConnectionStringAsync(), SqlFiles.Query(5));

        var p = await GetProductAsync(FamilyWeek);

        Assert.Equal(expected, [string.Join(" | ", p.Type, p.Title,
            (p.PriceCents / 100m).ToString("0.00", CultureInfo.InvariantCulture), p.RecipeCount, p.MealCount ?? 0)]);
    }

    [Fact]
    public async Task A_collection_counts_recipes_and_no_meals()
    {
        var p = await GetProductAsync(RomanPasta);

        Assert.Equal(ProductType.RecipeCollection, p.Type);
        Assert.Equal(3, p.RecipeCount);
        Assert.Null(p.MealCount);
        Assert.All(p.Recipes, r => Assert.True(r.DayOffset is null && r.Slot is null));
    }

    [Theory]
    [InlineData(RomanPasta)]
    [InlineData(BreadBox)]
    [InlineData(ThreeWeeknights)]
    [InlineData(FamilyWeek)]
    public async Task The_recipes_come_in_plan_order_with_their_day_meal_and_card(int productId)
    {
        var expected = await Sql.QueryLinesAsync(await ConnectionStringAsync(), $"""
            SELECT pr.sort_order, pr.day_offset, pr.slot, r.title, r.thumbnail_url, r.servings,
                   CASE WHEN r.prep_minutes IS NULL AND r.cook_minutes IS NULL THEN NULL
                        ELSE COALESCE(r.prep_minutes, 0) + COALESCE(r.cook_minutes, 0) END,
                   r.visibility
            FROM product_recipes pr JOIN recipes r ON r.id = pr.recipe_id
            WHERE pr.product_id = {productId}
            ORDER BY pr.sort_order
            """);

        var p = await GetProductAsync(productId);

        Assert.Equal(expected, p.Recipes.Select(r => string.Join(" | ", r.SortOrder, r.DayOffset, r.Slot, r.Title,
            r.ThumbnailUrl, r.Servings, r.TotalMinutes, r.Visibility)));
    }

    [Fact]
    public async Task A_meal_plan_lists_a_repeated_recipe_once_per_meal()
    {
        var p = await GetProductAsync(FamilyWeek);

        Assert.Equal([(0, MealSlot.Breakfast), (3, MealSlot.Breakfast)],
            p.Recipes.Where(r => r.Title == "Five-Day Overnight Oats").Select(r => (r.DayOffset!.Value, r.Slot!.Value)));
    }

    [Theory]
    [InlineData(null)]     // a signed-out visitor
    [InlineData(Sam)]      // a cook who has bought nothing
    [InlineData(Admin)]    // the admin never buys
    public async Task A_viewer_who_has_not_bought_it_sees_every_recipe_as_a_locked_card(int? viewer)
    {
        var p = await GetProductAsync(ThreeWeeknights, viewer);

        Assert.Equal(3, p.Recipes.Count);
        Assert.All(p.Recipes, r =>
        {
            Assert.False(r.CanOpen);
            Assert.Null(r.Details);
            Assert.False(string.IsNullOrEmpty(r.Title));
        });
        Assert.False(p.OwnedByViewer);
    }

    [Fact]
    public async Task A_locked_recipe_gives_away_no_id_and_none_of_its_steps()
    {
        var firstSteps = await Sql.QueryAsync(await ConnectionStringAsync(), $"""
            SELECT s.instruction FROM recipe_steps s
            JOIN product_recipes pr ON pr.recipe_id = s.recipe_id AND pr.product_id = {ThreeWeeknights}
            """);

        var response = await SendAsync($"/api/products/{ThreeWeeknights}", Sam.ToString(CultureInfo.InvariantCulture));
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.NotEmpty(firstSteps);
        Assert.All(firstSteps, row => Assert.DoesNotContain(row[0]![..20], body));
        Assert.DoesNotContain("\"recipeId\"", body);
        Assert.Contains("\"details\":null", body);
    }

    [Fact]
    public async Task A_buyer_opens_every_recipe_with_its_times_counts_and_first_step()
    {
        var expected = await Sql.QueryLinesAsync(await ConnectionStringAsync(), $"""
            SELECT r.id, r.prep_minutes, r.cook_minutes,
                   (SELECT count(*) FROM recipe_ingredients ri WHERE ri.recipe_id = r.id),
                   (SELECT count(*) FROM recipe_steps s WHERE s.recipe_id = r.id),
                   (SELECT s.instruction FROM recipe_steps s WHERE s.recipe_id = r.id ORDER BY s.step_number LIMIT 1),
                   r.save_count
            FROM product_recipes pr JOIN recipes r ON r.id = pr.recipe_id
            WHERE pr.product_id = {ThreeWeeknights}
            ORDER BY pr.sort_order
            """);

        var p = await GetProductAsync(ThreeWeeknights, Alex);

        Assert.All(p.Recipes, r => Assert.True(r.CanOpen));
        Assert.Equal(expected, p.Recipes.Select(r => string.Join(" | ", r.Details!.RecipeId, r.Details.PrepMinutes,
            r.Details.CookMinutes, r.Details.IngredientCount, r.Details.StepCount, r.Details.FirstStep, r.Details.SaveCount)));
        Assert.True(p.OwnedByViewer);
    }

    [Fact]
    public async Task A_buyers_recipes_say_which_purchase_they_came_with_and_whether_they_are_saved()
    {
        // Alex saved the teriyaki and the stir-fry, not the onigiri.
        var p = await GetProductAsync(ThreeWeeknights, Alex);

        Assert.Equal([(Teriyaki, true), (StirFry, true), (Onigiri, false)],
            p.Recipes.Select(r => (r.Details!.RecipeId, r.Details.SavedByViewer)));
        Assert.All(p.Recipes, r => Assert.Equal("Three Weeknights in Japan", r.Details!.OwnedThrough));
    }

    [Fact]
    public async Task A_buyer_sees_what_they_bought_not_the_product_as_it_is_today()
    {
        // Q15: Alex bought Roman Pasta Collection when it still held No-Knead Focaccia; Maria has taken it out since.
        var bought = await Sql.QueryLinesAsync(await ConnectionStringAsync(), $"""
            SELECT oir.sort_order, r.title FROM order_item_recipes oir
            JOIN order_items oi ON oi.id = oir.order_item_id JOIN orders o ON o.id = oi.order_id
            JOIN recipes r ON r.id = oir.recipe_id
            WHERE o.user_id = {Alex} AND o.status = 'Paid' AND oi.product_id = {RomanPasta}
            ORDER BY oir.sort_order
            """);

        var asAlex = await GetProductAsync(RomanPasta, Alex);
        var asVisitor = await GetProductAsync(RomanPasta);

        Assert.Equal(bought, asAlex.Recipes.Select(r => $"{r.SortOrder} | {r.Title}"));
        Assert.Contains(asAlex.Recipes, r => r.Title == "No-Knead Focaccia");
        Assert.Equal(4, asAlex.RecipeCount);
        Assert.DoesNotContain(asVisitor.Recipes, r => r.Title == "No-Knead Focaccia");
        Assert.Equal(3, asVisitor.RecipeCount);
    }

    [Fact]
    public async Task A_recipe_bought_in_another_product_opens_here_and_names_that_purchase()
    {
        // The Bread Box holds the focaccia Alex already owns through Roman Pasta Collection, and a ciabatta he does not.
        // His order for The Bread Box itself was cancelled, so he does not own it.
        var p = await GetProductAsync(BreadBox, Alex);

        Assert.False(p.OwnedByViewer);
        var focaccia = Assert.Single(p.Recipes, r => r.Title == "No-Knead Focaccia");
        Assert.Equal((Focaccia, "Roman Pasta Collection"), (focaccia.Details!.RecipeId, focaccia.Details.OwnedThrough));
        Assert.Null(Assert.Single(p.Recipes, r => r.Title == "Rosemary Ciabatta").Details);
    }

    [Fact]
    public async Task Its_creator_opens_every_recipe_and_is_told_it_is_theirs()
    {
        var p = await GetProductAsync(ThreeWeeknights, Kenji);

        Assert.True(p.ViewerIsCreator);
        Assert.False(p.OwnedByViewer);
        Assert.All(p.Recipes, r => Assert.True(r.CanOpen));
        Assert.All(p.Recipes, r => Assert.Null(r.Details!.OwnedThrough));
    }

    [Theory]
    [InlineData(Alex, false)]
    [InlineData(Dan, false)]     // bought it, did not make it
    [InlineData(null, false)]
    public async Task Viewer_is_creator_is_false_for_everyone_else(int? viewer, bool expected)
    {
        Assert.Equal(expected, (await GetProductAsync(ThreeWeeknights, viewer)).ViewerIsCreator);
    }

    [Theory]
    [InlineData(RomanPasta)]
    [InlineData(BreadBox)]
    [InlineData(ThreeWeeknights)]
    [InlineData(FamilyWeek)]
    public async Task A_viewer_owns_exactly_the_products_they_have_a_paid_order_for(int productId)
    {
        foreach (var viewer in new[] { Alex, Priya, Dan, Sam })
        {
            var paid = await Sql.QueryAsync(await ConnectionStringAsync(), $"""
                SELECT 1 FROM order_items oi JOIN orders o ON o.id = oi.order_id
                WHERE o.user_id = {viewer} AND o.status = 'Paid' AND oi.product_id = {productId}
                """);

            var p = await GetProductAsync(productId, viewer);

            Assert.True(paid.Count > 0 == p.OwnedByViewer, $"user {viewer}, product {productId}");
        }
    }

    [Theory]
    [InlineData(Priya, true)]    // The Bread Box is in Priya's cart
    [InlineData(Alex, false)]
    [InlineData(null, false)]
    public async Task In_cart_follows_the_viewers_cart(int? viewer, bool expected)
    {
        Assert.Equal(expected, (await GetProductAsync(BreadBox, viewer)).InCart);
    }

    [Fact]
    public async Task The_rating_matches_Q13()
    {
        // Q13 is written for Three Weeknights in Japan: three reviews.
        var q13 = Assert.Single(await Sql.QueryAsync(await ConnectionStringAsync(), SqlFiles.Query(13)));

        var rating = (await GetProductAsync(ThreeWeeknights)).Rating;

        Assert.Equal((q13[1], q13[2], q13[3]), (rating.ReviewCount.ToString(CultureInfo.InvariantCulture),
            rating.Average?.ToString("0.0", CultureInfo.InvariantCulture),
            rating.PercentRecommend?.ToString(CultureInfo.InvariantCulture)));
    }

    [Fact]
    public async Task A_product_with_no_reviews_has_no_average()
    {
        var rating = (await GetProductAsync(RomanPasta)).Rating;

        Assert.Equal((0, null, null), (rating.ReviewCount, rating.Average, rating.PercentRecommend));
    }

    [Theory]
    [InlineData(RomanPasta, true)]
    [InlineData(BreadBox, true)]
    [InlineData(ThreeWeeknights, true)]
    [InlineData(FamilyWeek, true)]
    [InlineData(RetiredGrilling, false)]
    public async Task A_retired_product_still_has_a_page_and_says_it_is_not_for_sale(int productId, bool forSale)
    {
        // The prototype shows "No longer for sale" rather than a missing page, so an old link or an order still leads somewhere.
        Assert.Equal(forSale, (await GetProductAsync(productId)).IsForSale);
    }

    [Fact]
    public async Task A_suspended_creator_or_a_recipe_taken_down_stops_the_sale_and_buyers_keep_their_recipes()
    {
        // DesignDocument.md §3.8, rules.js isForSale: nobody pays for something they could not open.
        var connection = await OwnSeededDatabaseAsync("notforsale");
        await Sql.ExecuteAsync(connection, $"""
            UPDATE creator_profiles SET suspended_at = now() WHERE user_id = {Dan};
            UPDATE recipes SET is_published = FALSE WHERE id = {Onigiri};
            """);
        await using var api = new CookfeedApiFactory(connection);

        var familyWeek = await GetProductAsync(api, FamilyWeek);
        var asVisitor = await GetProductAsync(api, ThreeWeeknights);
        var asAlex = await GetProductAsync(api, ThreeWeeknights, Alex);

        Assert.False(familyWeek.IsForSale);     // Dan is suspended
        Assert.False(asVisitor.IsForSale);      // it holds the onigiri, which was taken down
        Assert.True((await GetProductAsync(api, RomanPasta)).IsForSale);
        Assert.True(asAlex.OwnedByViewer);
        Assert.All(asAlex.Recipes, r => Assert.True(r.CanOpen));
        Assert.Equal(Onigiri, Assert.Single(asAlex.Recipes, r => r.Title == "Onigiri Three Ways").Details!.RecipeId);
    }

    [Fact]
    public async Task A_hidden_review_and_a_refunded_buyers_review_leave_the_rating()
    {
        // The seed's reviews of Three Weeknights in Japan: Alex 5 (recommends), Priya 4 (recommends), Dan 3 (does not).
        var connection = await OwnSeededDatabaseAsync("rating");
        await using var api = new CookfeedApiFactory(connection);

        await Sql.ExecuteAsync(connection, $"UPDATE reviews SET hidden_at = now() WHERE product_id = {ThreeWeeknights} AND user_id = {Priya}");
        var hidden = (await GetProductAsync(api, ThreeWeeknights)).Rating;

        await Sql.ExecuteAsync(connection, $"""
            UPDATE orders SET status = 'Refunded' WHERE user_id = {Dan}
              AND id IN (SELECT order_id FROM order_items WHERE product_id = {ThreeWeeknights})
            """);
        var refunded = (await GetProductAsync(api, ThreeWeeknights)).Rating;

        Assert.Equal((2, 4.0m, 50), (hidden.ReviewCount, hidden.Average, hidden.PercentRecommend));
        Assert.Equal((1, 5.0m, 100), (refunded.ReviewCount, refunded.Average, refunded.PercentRecommend));
    }

    [Fact]
    public async Task Types_and_meals_are_sent_as_names()
    {
        var response = await SendAsync($"/api/products/{ThreeWeeknights}");
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);

        Assert.Contains("\"type\":\"MealPlan\"", body);
        Assert.Contains("\"slot\":\"Dinner\"", body);
        Assert.Contains("\"visibility\":\"ProductOnly\"", body);
    }

    [Fact]
    public async Task A_viewer_id_that_is_not_a_number_is_refused_with_400()
    {
        var response = await SendAsync($"/api/products/{ThreeWeeknights}", "alex");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    private async Task<string> OwnSeededDatabaseAsync(string purpose)
    {
        var connection = await databases.CreateMigratedDatabaseAsync(purpose);
        await DatabaseFixture.SeedWithDbSeederAsync(connection);
        return connection;
    }

    private async Task<ProductDetailDto> GetProductAsync(int id, int? viewer = null)
    {
        _api ??= new CookfeedApiFactory(await ConnectionStringAsync());
        return await GetProductAsync(_api, id, viewer);
    }

    private static async Task<ProductDetailDto> GetProductAsync(CookfeedApiFactory api, int id, int? viewer = null)
    {
        var response = await SendAsync(api, $"/api/products/{id}", viewer?.ToString(CultureInfo.InvariantCulture));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return (await response.Content.ReadFromJsonAsync<ProductDetailDto>(TestContext.Current.CancellationToken))!;
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
