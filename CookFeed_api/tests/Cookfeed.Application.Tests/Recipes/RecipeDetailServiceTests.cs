using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Recipes;
using Cookfeed.Contracts.Recipes;
using Cookfeed.Contracts.Storefront;
using Cookfeed.Domain.Access;
using NSubstitute;
using DomainVisibility = Cookfeed.Domain.Enums.RecipeVisibility;

namespace Cookfeed.Application.Tests.Recipes;

/// <summary>
/// <see cref="RecipeDetailService"/> applies <see cref="RecipeAccess"/> before it reads the recipe: a recipe the viewer
/// may not open comes back as null (the controller answers 404) without its ingredients or steps ever being read.
/// </summary>
public class RecipeDetailServiceTests
{
    private const int RecipeId = 6, CreatorId = 4;

    private readonly IRecipeRepository _recipes = Substitute.For<IRecipeRepository>();

    private RecipeDetailService Service => new(_recipes);

    [Fact]
    public async Task An_unknown_recipe_is_null()
    {
        _recipes.GetAccessFactsAsync(RecipeId, Arg.Any<int?>(), Arg.Any<CancellationToken>()).Returns((RecipeAccessFacts?)null);

        Assert.Null(await Service.GetRecipeAsync(RecipeId, viewerId: 1, CancellationToken.None));
        await _recipes.DidNotReceiveWithAnyArgs().GetDetailAsync(default, default, CancellationToken.None);
    }

    [Fact]
    public async Task A_recipe_the_viewer_may_not_open_is_null_and_its_detail_is_never_read()
    {
        Given(DomainVisibility.ProductOnly, viewerHoldsIt: false);

        Assert.Null(await Service.GetRecipeAsync(RecipeId, viewerId: 7, CancellationToken.None));
        await _recipes.DidNotReceiveWithAnyArgs().GetDetailAsync(default, default, CancellationToken.None);
    }

    [Fact]
    public async Task A_recipe_the_viewer_may_open_is_read_for_that_viewer()
    {
        Given(DomainVisibility.ProductOnly, viewerHoldsIt: true);
        var detail = Detail();
        _recipes.GetDetailAsync(RecipeId, 1, Arg.Any<CancellationToken>()).Returns(detail);

        Assert.Same(detail, await Service.GetRecipeAsync(RecipeId, viewerId: 1, CancellationToken.None));
    }

    [Fact]
    public async Task Its_creator_opens_a_draft()
    {
        Given(DomainVisibility.Public, viewerHoldsIt: false, published: false);
        _recipes.GetDetailAsync(RecipeId, CreatorId, Arg.Any<CancellationToken>()).Returns(Detail());

        Assert.NotNull(await Service.GetRecipeAsync(RecipeId, viewerId: CreatorId, CancellationToken.None));
    }

    private void Given(DomainVisibility visibility, bool viewerHoldsIt, bool published = true) =>
        _recipes.GetAccessFactsAsync(RecipeId, Arg.Any<int?>(), Arg.Any<CancellationToken>())
            .Returns(new RecipeAccessFacts(CreatorId, published, visibility, viewerHoldsIt));

    private static RecipeDetailDto Detail() => new(RecipeId, "Onigiri Three Ways", null, "video", null, 4, 20, 20, 40, 0,
        true, RecipeVisibility.ProductOnly, DateTimeOffset.UnixEpoch, new RecipeCreatorDto("kenji-kitchen", "Kenji", null, true),
        false, false, [], [], [new RecipePlacementDto(3, "Three Weeknights in Japan", ProductType.MealPlan, 2, MealSlot.Dinner, true)]);
}
