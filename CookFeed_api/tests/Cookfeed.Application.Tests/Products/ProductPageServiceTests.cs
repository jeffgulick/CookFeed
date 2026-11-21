using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Products;
using Cookfeed.Contracts.Products;
using Cookfeed.Contracts.Recipes;
using Cookfeed.Contracts.Storefront;
using Cookfeed.Domain.Access;
using NSubstitute;
using DomainVisibility = Cookfeed.Domain.Enums.RecipeVisibility;

namespace Cookfeed.Application.Tests.Products;

/// <summary>
/// <see cref="ProductPageService"/> turns what the repository read into the page: it applies <see cref="RecipeAccess"/>
/// to each recipe, so one the viewer may not open goes out as a card with no details; it counts recipes and meals
/// from the list the viewer sees; and it works out the rating.
/// </summary>
public class ProductPageServiceTests
{
    private const int ProductId = 3, CreatorId = 4, Viewer = 7;

    private readonly IProductRepository _products = Substitute.For<IProductRepository>();

    private ProductPageService Service => new(_products);

    [Fact]
    public async Task An_unknown_product_is_null()
    {
        _products.GetPageAsync(ProductId, Arg.Any<int?>(), Arg.Any<CancellationToken>()).Returns((ProductPage?)null);

        Assert.Null(await Service.GetProductAsync(ProductId, Viewer, CancellationToken.None));
    }

    [Fact]
    public async Task A_recipe_the_viewer_may_not_open_keeps_its_card_and_loses_its_details()
    {
        Given(Page(placements: [Placement(recipeId: 6, viewerHoldsIt: false)]));

        var recipe = Assert.Single((await Service.GetProductAsync(ProductId, Viewer, CancellationToken.None))!.Recipes);

        Assert.False(recipe.CanOpen);
        Assert.Null(recipe.Details);
        Assert.Equal(("Recipe 6", "thumb-6", 4, 40), (recipe.Title, recipe.ThumbnailUrl, recipe.Servings, recipe.TotalMinutes));
    }

    [Fact]
    public async Task A_recipe_the_viewer_may_open_carries_its_details()
    {
        Given(Page(placements: [Placement(recipeId: 6, viewerHoldsIt: true)]));

        var recipe = Assert.Single((await Service.GetProductAsync(ProductId, Viewer, CancellationToken.None))!.Recipes);

        Assert.True(recipe.CanOpen);
        Assert.Equal(new ProductRecipeDetailsDto(6, 15, 25, 9, 5, "Rinse the rice.", 3, true, "Three Weeknights in Japan"),
            recipe.Details);
    }

    [Fact]
    public async Task Its_creator_opens_every_recipe_and_the_page_says_it_is_theirs()
    {
        Given(Page(placements: [Placement(recipeId: 6, viewerHoldsIt: false)]));

        var page = (await Service.GetProductAsync(ProductId, CreatorId, CancellationToken.None))!;

        Assert.True(page.ViewerIsCreator);
        Assert.True(Assert.Single(page.Recipes).CanOpen);
    }

    [Fact]
    public async Task A_meal_plan_counts_distinct_recipes_and_every_meal()
    {
        Given(Page(ProductType.MealPlan, [Placement(9, sortOrder: 1), Placement(10, sortOrder: 2), Placement(9, sortOrder: 3)]));

        var page = (await Service.GetProductAsync(ProductId, Viewer, CancellationToken.None))!;

        Assert.Equal((2, 3), (page.RecipeCount, page.MealCount));
        Assert.Equal([1, 2, 3], page.Recipes.Select(r => r.SortOrder));
    }

    [Fact]
    public async Task A_collection_counts_no_meals()
    {
        Given(Page(ProductType.RecipeCollection, [Placement(1), Placement(2)]));

        var page = (await Service.GetProductAsync(ProductId, Viewer, CancellationToken.None))!;

        Assert.Equal((2, null), (page.RecipeCount, page.MealCount));
    }

    [Fact]
    public async Task A_recipe_with_no_times_has_no_total()
    {
        Given(Page(placements: [Placement(6) with { PrepMinutes = null, CookMinutes = null }]));

        var recipe = Assert.Single((await Service.GetProductAsync(ProductId, Viewer, CancellationToken.None))!.Recipes);

        Assert.Null(recipe.TotalMinutes);
    }

    [Theory]
    [InlineData(3, 12, 2, "4.0", 67)]     // 5 + 4 + 3; two of three recommend
    [InlineData(3, 14, 3, "4.7", 100)]    // 14 / 3 = 4.67
    [InlineData(2, 9, 1, "4.5", 50)]
    [InlineData(8, 25, 1, "3.1", 13)]     // 3.125 rounds to 3.1, 12.5% rounds up to 13, as PostgreSQL's ROUND does
    public async Task The_rating_is_the_average_to_one_decimal_and_the_percent_recommending(
        int reviews, int ratingSum, int recommending, string average, int percent)
    {
        Given(Page() with { ReviewCount = reviews, RatingSum = ratingSum, RecommendCount = recommending });

        var rating = (await Service.GetProductAsync(ProductId, Viewer, CancellationToken.None))!.Rating;

        Assert.Equal((reviews, average, percent), (rating.ReviewCount,
            rating.Average?.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture), rating.PercentRecommend));
    }

    [Fact]
    public async Task With_no_reviews_there_is_no_average_and_no_percent()
    {
        Given(Page());

        var rating = (await Service.GetProductAsync(ProductId, Viewer, CancellationToken.None))!.Rating;

        Assert.Equal((0, null, null), (rating.ReviewCount, rating.Average, rating.PercentRecommend));
    }

    [Fact]
    public async Task The_header_and_the_viewers_flags_pass_through()
    {
        Given(Page() with { IsForSale = false, OwnedByViewer = true, InCart = true });

        var page = (await Service.GetProductAsync(ProductId, Viewer, CancellationToken.None))!;

        Assert.Equal((ProductId, "Three Weeknights in Japan", 1299, "USD", "kenji-kitchen", "Kenji Watanabe", true),
            (page.Id, page.Title, page.PriceCents, page.Currency, page.Creator.Handle, page.Creator.DisplayName, page.Creator.IsVerified));
        Assert.Equal((false, true, true, false), (page.IsForSale, page.OwnedByViewer, page.InCart, page.ViewerIsCreator));
    }

    private void Given(ProductPage page) =>
        _products.GetPageAsync(ProductId, Arg.Any<int?>(), Arg.Any<CancellationToken>()).Returns(page);

    private static ProductPage Page(ProductType type = ProductType.MealPlan, IReadOnlyList<ProductPagePlacement>? placements = null) =>
        new(ProductId, type, "Three Weeknights in Japan", "Three dinners.", "cover", 1299, "USD",
            CreatorId, "kenji-kitchen", "Kenji Watanabe", CreatorIsVerified: true,
            IsForSale: true, OwnedByViewer: false, InCart: false,
            ReviewCount: 0, RatingSum: 0, RecommendCount: 0,
            placements ?? []);

    private static ProductPagePlacement Placement(int recipeId, bool viewerHoldsIt = false, int sortOrder = 1) =>
        new(sortOrder, DayOffset: 0, MealSlot.Dinner, recipeId, $"Recipe {recipeId}", $"thumb-{recipeId}", Servings: 4,
            PrepMinutes: 15, CookMinutes: 25, IngredientCount: 9, StepCount: 5, FirstStep: "Rinse the rice.", SaveCount: 3,
            SavedByViewer: true, OwnedThrough: viewerHoldsIt ? "Three Weeknights in Japan" : null,
            new RecipeAccessFacts(CreatorId, IsPublished: true, DomainVisibility.ProductOnly, viewerHoldsIt));
}
