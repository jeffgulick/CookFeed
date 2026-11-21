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

    /// <summary>
    /// The ingredient totals of the given recipes as written, one per (ingredient, unit category).
    /// <paramref name="timesByRecipe"/> says how many times each recipe counts: 2 for one a meal plan serves on two
    /// days. It applies no access rule: pass only recipes the viewer may open.
    /// </summary>
    Task<IReadOnlyList<IngredientTotal>> GetIngredientTotalsForRecipesAsync(IReadOnlyDictionary<int, int> timesByRecipe,
        CancellationToken cancellationToken);
}
