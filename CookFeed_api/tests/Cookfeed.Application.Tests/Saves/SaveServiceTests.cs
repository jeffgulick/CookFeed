using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Saves;
using Cookfeed.Contracts.Recipes;
using Cookfeed.Contracts.Saves;
using Cookfeed.Domain.Access;
using NSubstitute;

namespace Cookfeed.Application.Tests.Saves;

/// <summary>
/// <see cref="SaveService"/>: a home cook saves and unsaves recipes they may open, and lists what they saved. The
/// rule is <see cref="RecipeAccess.CanSave"/>; the repositories are fakes, so these tests need no database.
/// </summary>
public class SaveServiceTests
{
    private const int Caller = 9, Recipe = 15, Creator = 3;
    private static readonly DateTimeOffset Now = new(2026, 11, 21, 18, 0, 0, TimeSpan.Zero);

    private readonly ISaveRepository _saves = Substitute.For<ISaveRepository>();
    private readonly IRecipeRepository _recipes = Substitute.For<IRecipeRepository>();
    private readonly TimeProvider _clock = Substitute.For<TimeProvider>();

    public SaveServiceTests()
    {
        _clock.GetUtcNow().Returns(Now);
        _saves.CanShopAsync(Caller, Arg.Any<CancellationToken>()).Returns(true);
        _saves.GetSaveCountAsync(Recipe, Arg.Any<CancellationToken>()).Returns(6);
    }

    private SaveService Service => new(_saves, _recipes, _clock);

    [Fact]
    public async Task The_list_is_what_the_caller_saved()
    {
        IReadOnlyList<SavedRecipeDto> saved =
            [new SavedRecipeDto(15, "Caprese Salad", null, 2, 10, 6, "maria-cooks", true, RecipeVisibility.Public, Now)];
        _saves.GetSavedAsync(Caller, Arg.Any<CancellationToken>()).Returns(saved);

        var result = await Service.GetSavedAsync(Caller, CancellationToken.None);

        Assert.Equal(SaveOutcome.Done, result.Outcome);
        Assert.Same(saved, result.Saved);
    }

    [Fact]
    public async Task Saving_a_recipe_writes_the_save_with_the_time_and_answers_with_the_new_count()
    {
        RecipeIs(new RecipeAccessFacts(Creator, IsPublished: true, Domain.Enums.RecipeVisibility.Public, false));

        var result = await Service.SaveAsync(Caller, Recipe, CancellationToken.None);

        Assert.Equal(SaveOutcome.Done, result.Outcome);
        Assert.Equal(new SaveStateDto(Recipe, Saved: true, SaveCount: 6), result.State);
        await _saves.Received(1).AddAsync(Caller, Recipe, Now, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task A_recipe_that_does_not_exist_cannot_be_saved()
    {
        _recipes.GetAccessFactsAsync(999, Caller, Arg.Any<CancellationToken>()).Returns((RecipeAccessFacts?)null);

        var result = await Service.SaveAsync(Caller, 999, CancellationToken.None);

        Assert.Equal(SaveOutcome.NotFound, result.Outcome);
        await NothingWasSaved();
    }

    [Theory]
    [InlineData(true, false)]    // a premium recipe the caller has not bought
    [InlineData(false, true)]    // a free recipe that is not published: a draft
    public async Task A_recipe_the_caller_may_not_save_is_not_found_and_nothing_is_written(bool published, bool free)
    {
        RecipeIs(new RecipeAccessFacts(Creator, published,
            free ? Domain.Enums.RecipeVisibility.Public : Domain.Enums.RecipeVisibility.ProductOnly, false));

        var result = await Service.SaveAsync(Caller, Recipe, CancellationToken.None);

        // The same answer as a recipe that does not exist, so a draft's or a premium recipe's existence is not revealed.
        Assert.Equal(SaveOutcome.NotFound, result.Outcome);
        await NothingWasSaved();
    }

    [Fact]
    public async Task A_premium_recipe_the_caller_bought_can_be_saved()
    {
        RecipeIs(new RecipeAccessFacts(Creator, IsPublished: true, Domain.Enums.RecipeVisibility.ProductOnly, true));

        var result = await Service.SaveAsync(Caller, Recipe, CancellationToken.None);

        Assert.Equal(SaveOutcome.Done, result.Outcome);
    }

    [Fact]
    public async Task Unsaving_removes_the_save_and_answers_with_the_new_count()
    {
        _saves.GetSaveCountAsync(Recipe, Arg.Any<CancellationToken>()).Returns(5);

        var result = await Service.UnsaveAsync(Caller, Recipe, CancellationToken.None);

        Assert.Equal(SaveOutcome.Done, result.Outcome);
        Assert.Equal(new SaveStateDto(Recipe, Saved: false, SaveCount: 5), result.State);
        await _saves.Received(1).RemoveAsync(Caller, Recipe, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Unsaving_a_recipe_that_does_not_exist_is_not_found()
    {
        _saves.GetSaveCountAsync(999, Arg.Any<CancellationToken>()).Returns((int?)null);

        var result = await Service.UnsaveAsync(Caller, 999, CancellationToken.None);

        Assert.Equal(SaveOutcome.NotFound, result.Outcome);
    }

    [Fact]
    public async Task An_account_that_cannot_shop_saves_unsaves_and_lists_nothing()
    {
        _saves.CanShopAsync(6, Arg.Any<CancellationToken>()).Returns(false);

        Assert.Equal(SaveOutcome.NoShop, (await Service.GetSavedAsync(6, CancellationToken.None)).Outcome);
        Assert.Equal(SaveOutcome.NoShop, (await Service.SaveAsync(6, Recipe, CancellationToken.None)).Outcome);
        Assert.Equal(SaveOutcome.NoShop, (await Service.UnsaveAsync(6, Recipe, CancellationToken.None)).Outcome);
        await NothingWasSaved();
        await _saves.DidNotReceive().RemoveAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
        await _saves.DidNotReceive().GetSavedAsync(Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    private void RecipeIs(RecipeAccessFacts facts) =>
        _recipes.GetAccessFactsAsync(Recipe, Caller, Arg.Any<CancellationToken>()).Returns(facts);

    private Task NothingWasSaved() =>
        _saves.DidNotReceive().AddAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
}
