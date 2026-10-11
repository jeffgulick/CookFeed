using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.ShoppingList;
using Cookfeed.Domain.ShoppingList;

namespace Cookfeed.Application.ShoppingList;

/// <summary>The caller's shopping list: the database's totals, then the aggregator's policy (DesignDocument.md §7.5).</summary>
public class ShoppingListService(IShoppingListRepository shoppingList)
{
    /// <summary>
    /// The list for <paramref name="callerId"/>. <paramref name="weekStart"/> limits the planned recipes to that week;
    /// null takes every plan. Saved recipes are always on it.
    /// </summary>
    public async Task<ShoppingListDto> GetShoppingListAsync(int callerId, DateOnly? weekStart,
        CancellationToken cancellationToken)
    {
        var totals = await shoppingList.GetIngredientTotalsAsync(callerId, weekStart, cancellationToken);
        var list = ShoppingListAggregator.Aggregate(totals);

        return new ShoppingListDto([.. list.Lines.Select(ToDto)], [.. list.Unmerged.Select(ToDto)]);
    }

    private static ShoppingListLineDto ToDto(ShoppingListLine line) =>
        new(line.IngredientId, line.Ingredient, line.Aisle, line.Quantity, line.Unit);
}
