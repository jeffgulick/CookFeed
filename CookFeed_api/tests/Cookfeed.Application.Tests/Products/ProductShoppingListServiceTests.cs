using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Products;
using Cookfeed.Contracts.Recipes;
using Cookfeed.Contracts.Storefront;
using Cookfeed.Domain.Access;
using Cookfeed.Domain.ShoppingList;
using NSubstitute;
using DomainVisibility = Cookfeed.Domain.Enums.RecipeVisibility;

namespace Cookfeed.Application.Tests.Products;

/// <summary>
/// <see cref="ProductShoppingListService"/> picks the recipes the viewer may open from the product's page, reads their
/// ingredient lines as written, counts a recipe once for every meal it is served at, and names the rest as locked.
/// How lines are joined and sorted is <see cref="WrittenShoppingList"/>'s, tested in Cookfeed.Domain.Tests.
/// </summary>
public class ProductShoppingListServiceTests
{
    private const int ProductId = 4, CreatorId = 5, Viewer = 7;
    private const int Oats = 9, Tacos = 10, Hummus = 11;

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
    public async Task Only_recipes_the_viewer_may_open_are_read_and_the_rest_are_named_as_locked()
    {
        Given(Placement(Oats, "Oats", open: true), Placement(Tacos, "Tacos", open: false), Placement(Hummus, "Hummus", open: true));
        LinesAre(new() { [Oats] = [Line(1, "rolled oats", 2.5m, "c")], [Hummus] = [Line(2, "chickpeas", 400m, "g")] });

        var list = (await Service.GetShoppingListAsync(ProductId, Viewer, CancellationToken.None))!;

        await _shoppingList.Received(1).GetWrittenLinesAsync(
            Arg.Is<IReadOnlyCollection<int>>(ids => ids.Count == 2 && ids.Contains(Oats) && ids.Contains(Hummus)),
            Arg.Any<CancellationToken>());
        Assert.Equal(["chickpeas", "rolled oats"], list.Lines.Select(l => l.Ingredient));
        Assert.Equal(["Oats", "Hummus"], list.FromRecipes);
        Assert.Equal(["Tacos"], list.LockedRecipes);
    }

    [Fact]
    public async Task A_recipe_served_twice_is_bought_twice_and_named_once()
    {
        Given(Placement(Oats, "Oats", open: true), Placement(Tacos, "Tacos", open: true), Placement(Oats, "Oats", open: true));
        LinesAre(new() { [Oats] = [Line(1, "rolled oats", 2.5m, "c")], [Tacos] = [Line(3, "ground beef", 500m, "g")] });

        var list = (await Service.GetShoppingListAsync(ProductId, Viewer, CancellationToken.None))!;

        Assert.Equal((5m, "c"), Amount(list, "rolled oats"));
        Assert.Equal((500m, "g"), Amount(list, "ground beef"));
        Assert.Equal(["Oats", "Tacos"], list.FromRecipes);
    }

    [Fact]
    public async Task With_nothing_to_open_the_ingredients_are_never_read()
    {
        Given(Placement(Oats, "Oats", open: false), Placement(Oats, "Oats", open: false));

        var list = (await Service.GetShoppingListAsync(ProductId, Viewer, CancellationToken.None))!;

        await _shoppingList.DidNotReceiveWithAnyArgs().GetWrittenLinesAsync(default!, CancellationToken.None);
        Assert.Empty(list.Lines);
        Assert.Empty(list.FromRecipes);
        Assert.Equal(["Oats"], list.LockedRecipes);
    }

    [Fact]
    public async Task Its_creator_gets_every_recipe()
    {
        Given(Placement(Oats, "Oats", open: false));
        LinesAre(new() { [Oats] = [Line(1, "rolled oats", 2.5m, "c")] });

        var list = (await Service.GetShoppingListAsync(ProductId, CreatorId, CancellationToken.None))!;

        Assert.Equal(["Oats"], list.FromRecipes);
        Assert.Empty(list.LockedRecipes);
        Assert.Single(list.Lines);
    }

    [Fact]
    public async Task Each_line_reaches_the_response_as_it_is_written()
    {
        Given(Placement(Oats, "Oats", open: true));
        LinesAre(new() { [Oats] = [new WrittenIngredientLine(1, "rolled oats", "Pantry", 2.5m, "c")] });

        var line = Assert.Single((await Service.GetShoppingListAsync(ProductId, Viewer, CancellationToken.None))!.Lines);

        Assert.Equal((1, "rolled oats", "Pantry", 2.5m, "c"), (line.IngredientId, line.Ingredient, line.Aisle, line.Quantity, line.Unit));
    }

    private static (decimal, string) Amount(Contracts.Products.ProductShoppingListDto list, string ingredient)
    {
        var line = Assert.Single(list.Lines, l => l.Ingredient == ingredient);
        return (line.Quantity, line.Unit);
    }

    private static WrittenIngredientLine Line(int ingredientId, string ingredient, decimal quantity, string unit) =>
        new(ingredientId, ingredient, "Pantry", quantity, unit);

    private void Given(params ProductPagePlacement[] placements) =>
        _products.GetPageAsync(ProductId, Arg.Any<int?>(), Arg.Any<CancellationToken>()).Returns(
            new ProductPage(ProductId, ProductType.MealPlan, "Family Week on a Budget", null, null, 999, "USD",
                CreatorId, "dan-meal-preps", "Dan Okafor", CreatorIsVerified: false,
                IsForSale: true, OwnedByViewer: false, InCart: false,
                ReviewCount: 0, RatingSum: 0, RecommendCount: 0,
                placements));

    private void LinesAre(Dictionary<int, IReadOnlyList<WrittenIngredientLine>> linesByRecipe) =>
        _shoppingList.GetWrittenLinesAsync(Arg.Any<IReadOnlyCollection<int>>(), Arg.Any<CancellationToken>())
            .Returns(linesByRecipe);

    // "open" stands for a Paid order holding the recipe, the one thing that opens a ProductOnly recipe to a viewer who
    // did not make it.
    private static ProductPagePlacement Placement(int recipeId, string title, bool open) =>
        new(SortOrder: 1, DayOffset: 0, MealSlot.Breakfast, recipeId, title, null, Servings: 4, PrepMinutes: 5,
            CookMinutes: 0, IngredientCount: 7, StepCount: 3, FirstStep: null, SaveCount: 0, SavedByViewer: false,
            OwnedThrough: open ? "Family Week on a Budget" : null,
            new RecipeAccessFacts(CreatorId, IsPublished: true, DomainVisibility.ProductOnly, ViewerHoldsPaidSnapshot: open));
}
