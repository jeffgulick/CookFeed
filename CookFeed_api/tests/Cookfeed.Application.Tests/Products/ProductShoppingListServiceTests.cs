using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Products;
using Cookfeed.Contracts.Recipes;
using Cookfeed.Contracts.Storefront;
using Cookfeed.Domain.Access;
using DomainVisibility = Cookfeed.Domain.Enums.RecipeVisibility;
using UnitCategory = Cookfeed.Domain.Enums.UnitCategory;
using Cookfeed.Domain.ShoppingList;
using NSubstitute;

namespace Cookfeed.Application.Tests.Products;

/// <summary>
/// <see cref="ProductShoppingListService"/> picks the recipes the viewer may open from the product's page, asks the
/// repository to add up their ingredients (a recipe served twice counting twice), and names the rest as locked. The
/// aggregator's own rules are tested in Cookfeed.Domain.Tests.
/// </summary>
public class ProductShoppingListServiceTests
{
    private const int ProductId = 4, CreatorId = 5, Viewer = 7;

    private readonly IProductRepository _products = Substitute.For<IProductRepository>();
    private readonly IShoppingListRepository _shoppingList = Substitute.For<IShoppingListRepository>();

    private ProductShoppingListService Service => new(_products, _shoppingList);

    [Fact]
    public async Task An_unknown_product_is_null()
    {
        _products.GetPageAsync(ProductId, Arg.Any<int?>(), Arg.Any<CancellationToken>()).Returns((ProductPage?)null);

        Assert.Null(await Service.GetShoppingListAsync(ProductId, Viewer, CancellationToken.None));
    }

    [Fact]
    public async Task Only_recipes_the_viewer_may_open_are_added_up_and_the_rest_are_named_as_locked()
    {
        Given(Placement(9, "Oats", open: true), Placement(10, "Tacos", open: false), Placement(11, "Hummus", open: true));
        TotalsAre([]);

        var list = (await Service.GetShoppingListAsync(ProductId, Viewer, CancellationToken.None))!;

        await _shoppingList.Received(1).GetIngredientTotalsForRecipesAsync(
            Arg.Is<IReadOnlyDictionary<int, int>>(times => times.Count == 2 && times[9] == 1 && times[11] == 1),
            Arg.Any<CancellationToken>());
        Assert.Equal(["Oats", "Hummus"], list.FromRecipes);
        Assert.Equal(["Tacos"], list.LockedRecipes);
    }

    [Fact]
    public async Task A_recipe_served_twice_is_added_up_twice_and_named_once()
    {
        Given(Placement(9, "Oats", open: true), Placement(10, "Tacos", open: true), Placement(9, "Oats", open: true));
        TotalsAre([]);

        var list = (await Service.GetShoppingListAsync(ProductId, Viewer, CancellationToken.None))!;

        await _shoppingList.Received(1).GetIngredientTotalsForRecipesAsync(
            Arg.Is<IReadOnlyDictionary<int, int>>(times => times[9] == 2 && times[10] == 1),
            Arg.Any<CancellationToken>());
        Assert.Equal(["Oats", "Tacos"], list.FromRecipes);
    }

    [Fact]
    public async Task With_nothing_to_open_the_ingredients_are_never_read()
    {
        Given(Placement(9, "Oats", open: false), Placement(9, "Oats", open: false));

        var list = (await Service.GetShoppingListAsync(ProductId, Viewer, CancellationToken.None))!;

        await _shoppingList.DidNotReceiveWithAnyArgs().GetIngredientTotalsForRecipesAsync(default!, CancellationToken.None);
        Assert.Empty(list.Lines);
        Assert.Empty(list.FromRecipes);
        Assert.Equal(["Oats"], list.LockedRecipes);
    }

    [Fact]
    public async Task Its_creator_gets_every_recipe()
    {
        Given(Placement(9, "Oats", open: false));
        TotalsAre([]);

        var list = (await Service.GetShoppingListAsync(ProductId, CreatorId, CancellationToken.None))!;

        Assert.Equal(["Oats"], list.FromRecipes);
        Assert.Empty(list.LockedRecipes);
    }

    [Fact]
    public async Task Aggregated_lines_and_unmerged_lines_reach_the_response()
    {
        Given(Placement(9, "Oats", open: true));
        TotalsAre(
        [
            new IngredientTotal(1, "all-purpose flour", "Pantry", 0.53m, UnitCategory.Mass, 1m, "g", UnitCategory.Mass, 500m),
            new IngredientTotal(2, "mozzarella", "Dairy", null, UnitCategory.Mass, 1m, "g", UnitCategory.Mass, 200m),
            new IngredientTotal(2, "mozzarella", "Dairy", null, UnitCategory.Mass, 1m, "g", UnitCategory.Volume, 250m),
        ]);

        var list = (await Service.GetShoppingListAsync(ProductId, Viewer, CancellationToken.None))!;

        Assert.Equal("all-purpose flour", Assert.Single(list.Lines).Ingredient);
        Assert.Equal(2, list.Unmerged.Count);
        Assert.All(list.Unmerged, line => Assert.Equal("mozzarella", line.Ingredient));
    }

    private void Given(params ProductPagePlacement[] placements) =>
        _products.GetPageAsync(ProductId, Arg.Any<int?>(), Arg.Any<CancellationToken>()).Returns(
            new ProductPage(ProductId, ProductType.MealPlan, "Family Week on a Budget", null, null, 999, "USD",
                CreatorId, "dan-meal-preps", "Dan Okafor", CreatorIsVerified: false,
                IsForSale: true, OwnedByViewer: false, InCart: false,
                ReviewCount: 0, RatingSum: 0, RecommendCount: 0,
                placements));

    private void TotalsAre(IReadOnlyList<IngredientTotal> totals) =>
        _shoppingList.GetIngredientTotalsForRecipesAsync(Arg.Any<IReadOnlyDictionary<int, int>>(), Arg.Any<CancellationToken>())
            .Returns(totals);

    // "open" stands for a Paid order holding the recipe, the one thing that opens a ProductOnly recipe to a viewer who
    // did not make it.
    private static ProductPagePlacement Placement(int recipeId, string title, bool open) =>
        new(SortOrder: 1, DayOffset: 0, MealSlot.Breakfast, recipeId, title, null, Servings: 4, PrepMinutes: 5,
            CookMinutes: 0, IngredientCount: 7, StepCount: 3, FirstStep: null, SaveCount: 0, SavedByViewer: false,
            OwnedThrough: open ? "Family Week on a Budget" : null,
            new RecipeAccessFacts(CreatorId, IsPublished: true, DomainVisibility.ProductOnly, ViewerHoldsPaidSnapshot: open));
}
