using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.ShoppingList;
using Cookfeed.Contracts.ShoppingList;
using Cookfeed.Domain.Enums;
using Cookfeed.Domain.ShoppingList;
using NSubstitute;

namespace Cookfeed.Application.Tests.ShoppingList;

/// <summary>
/// <see cref="ShoppingListService"/> asks the repository for the caller's totals and passes them through
/// <see cref="ShoppingListAggregator"/>; the aggregator's own rules are tested in Cookfeed.Domain.Tests.
/// </summary>
public class ShoppingListServiceTests
{
    private readonly IShoppingListRepository _repository = Substitute.For<IShoppingListRepository>();

    private ShoppingListService Service => new(_repository);

    [Theory]
    [InlineData(null)]
    [InlineData("2026-09-21")]
    public async Task Asks_for_the_callers_totals_for_the_week_given(string? weekStart)
    {
        var week = weekStart is null ? (DateOnly?)null : DateOnly.Parse(weekStart);
        Returns([]);

        await Service.GetShoppingListAsync(callerId: 1, week, CancellationToken.None);

        await _repository.Received(1).GetIngredientTotalsAsync(1, week, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Aggregated_lines_and_unmerged_lines_reach_the_response()
    {
        Returns(
        [
            new IngredientTotal(1, "all-purpose flour", "Pantry", 0.53m, UnitCategory.Mass, 1m, "g", UnitCategory.Mass, 500m),
            new IngredientTotal(2, "mozzarella", "Dairy", null, UnitCategory.Mass, 1m, "g", UnitCategory.Mass, 200m),
            new IngredientTotal(2, "mozzarella", "Dairy", null, UnitCategory.Mass, 1m, "g", UnitCategory.Volume, 250m),
        ]);

        var list = await Service.GetShoppingListAsync(callerId: 1, weekStart: null, CancellationToken.None);

        Assert.Equal([new ShoppingListLineDto(1, "all-purpose flour", "Pantry", 500m, "g")], list.Lines);
        Assert.Equal(
            [new ShoppingListLineDto(2, "mozzarella", "Dairy", 200m, "g"), new ShoppingListLineDto(2, "mozzarella", "Dairy", 250m, "ml")],
            list.Unmerged.OrderBy(l => l.Unit));
    }

    private void Returns(IReadOnlyList<IngredientTotal> totals) =>
        _repository.GetIngredientTotalsAsync(Arg.Any<int>(), Arg.Any<DateOnly?>(), Arg.Any<CancellationToken>())
            .Returns(totals);
}
