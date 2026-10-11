using Cookfeed.Domain.ShoppingList;

namespace Cookfeed.Application.Abstractions.Persistence;

/// <summary>Reads what a shopping list needs from the database. Implemented with EF Core in Infrastructure.</summary>
public interface IShoppingListRepository
{
    /// <summary>
    /// The scaled ingredient totals of <paramref name="userId"/>'s planned and saved recipes, one per (ingredient,
    /// unit category). <paramref name="weekStart"/> limits the planned recipes to that week's plan; null means
    /// every plan. Saved recipes are always included.
    /// </summary>
    Task<IReadOnlyList<IngredientTotal>> GetIngredientTotalsAsync(int userId, DateOnly? weekStart,
        CancellationToken cancellationToken);
}
