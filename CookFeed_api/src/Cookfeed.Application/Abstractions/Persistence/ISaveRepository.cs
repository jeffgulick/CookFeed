using Cookfeed.Contracts.Saves;

namespace Cookfeed.Application.Abstractions.Persistence;

/// <summary>Reads and changes saved recipes. Implemented with EF Core in Infrastructure.</summary>
public interface ISaveRepository
{
    /// <summary>True when <paramref name="userId"/> holds the HomeCook role. False for the admin and for an id no account has.</summary>
    Task<bool> CanShopAsync(int userId, CancellationToken cancellationToken);

    /// <summary>The recipes <paramref name="userId"/> saved, the newest save first.</summary>
    Task<IReadOnlyList<SavedRecipeDto>> GetSavedAsync(int userId, CancellationToken cancellationToken);

    /// <summary>Saves the recipe. Does nothing if it is already saved. The database's trigger keeps the recipe's count.</summary>
    Task AddAsync(int userId, int recipeId, DateTimeOffset savedAt, CancellationToken cancellationToken);

    /// <summary>Unsaves the recipe. Does nothing if it was not saved.</summary>
    Task RemoveAsync(int userId, int recipeId, CancellationToken cancellationToken);

    /// <summary>How many cooks have the recipe saved; null when no recipe has the id.</summary>
    Task<int?> GetSaveCountAsync(int recipeId, CancellationToken cancellationToken);
}
