using Cookfeed.Application.Trips;
using Cookfeed.Domain.Enums;
using Cookfeed.Domain.ShoppingList;

namespace Cookfeed.Application.Abstractions.Persistence;

/// <summary>Reads and changes shopping lists ("trips"). Implemented with EF Core in Infrastructure.</summary>
public interface ITripRepository
{
    /// <summary>True when <paramref name="userId"/> holds the HomeCook role.</summary>
    Task<bool> CanShopAsync(int userId, CancellationToken cancellationToken);

    /// <summary>Every list of <paramref name="userId"/>, newest first, each with how many recipes it holds.</summary>
    Task<IReadOnlyList<TripRow>> GetTripsAsync(int userId, CancellationToken cancellationToken);

    /// <summary>One list with its recipes and skipped ingredients; null when <paramref name="userId"/> has no list with the id.</summary>
    Task<TripRow?> GetTripAsync(int userId, int tripId, CancellationToken cancellationToken);

    /// <summary>
    /// The recipes among <paramref name="recipeIds"/> that exist, each with the people it is written for and what
    /// <c>RecipeAccess</c> needs to decide whether <paramref name="userId"/> may cook from it.
    /// </summary>
    Task<IReadOnlyDictionary<int, RecipeForTrip>> GetRecipesAsync(int userId, IReadOnlyCollection<int> recipeIds,
        CancellationToken cancellationToken);

    /// <summary>
    /// The recipes of the product as <paramref name="userId"/> bought it, one per place in the purchase (a recipe
    /// served twice appears twice), in its order; null when they have no Paid order for the product.
    /// </summary>
    Task<IReadOnlyList<int>?> GetPurchasedRecipeIdsAsync(int userId, int productId, CancellationToken cancellationToken);

    /// <summary>Makes an empty list being built and returns its id.</summary>
    Task<int> CreateAsync(int userId, string name, DateTimeOffset createdAt, CancellationToken cancellationToken);

    Task AddItemsAsync(int tripId, IReadOnlyList<TripItem> items, CancellationToken cancellationToken);

    Task SetServingsAsync(int tripId, int recipeId, int servings, CancellationToken cancellationToken);

    Task RemoveItemAsync(int tripId, int recipeId, CancellationToken cancellationToken);

    /// <summary>Takes an ingredient off the list ("Have it"), or puts it back. Safe to repeat.</summary>
    Task SetSkipAsync(int tripId, int ingredientId, bool skipped, CancellationToken cancellationToken);

    Task SetStatusAsync(int tripId, TripStatus status, DateTimeOffset? completedAt, CancellationToken cancellationToken);

    /// <summary>Deletes the list with its recipes and skips.</summary>
    Task DeleteAsync(int tripId, CancellationToken cancellationToken);

    /// <summary>
    /// The scaled ingredient totals of the recipes on the list, one per (ingredient, unit category), with the
    /// arithmetic of the shopping list (<c>IShoppingListRepository.GetIngredientTotalsAsync</c>).
    /// </summary>
    Task<IReadOnlyList<IngredientTotal>> GetIngredientTotalsAsync(int tripId, CancellationToken cancellationToken);
}
