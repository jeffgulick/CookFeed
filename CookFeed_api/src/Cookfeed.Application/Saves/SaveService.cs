using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Saves;
using Cookfeed.Domain.Access;

namespace Cookfeed.Application.Saves;

/// <summary>How a save request ended. Everything but <see cref="Done"/> is a refusal, with nothing written.</summary>
public enum SaveOutcome
{
    Done,

    /// <summary>No recipe has the id, or it is one the caller may not save; the two are not told apart.</summary>
    NotFound,

    /// <summary>The caller cannot shop: the admin, or an id no account has.</summary>
    NoShop,
}

/// <summary>The outcome, with the list or the new state when the request was carried out.</summary>
public sealed record SaveResult(SaveOutcome Outcome, IReadOnlyList<SavedRecipeDto>? Saved = null,
    SaveStateDto? State = null);

/// <summary>
/// The caller's saved recipes (DesignDocument.md §3.4). Saving needs the same access as opening the recipe, decided
/// by <see cref="RecipeAccess.CanSave"/>. The caller's id comes from their identity, never from the route.
/// </summary>
public class SaveService(ISaveRepository saves, IRecipeRepository recipes, TimeProvider clock)
{
    public async Task<SaveResult> GetSavedAsync(int callerId, CancellationToken cancellationToken) =>
        await saves.CanShopAsync(callerId, cancellationToken)
            ? new SaveResult(SaveOutcome.Done, Saved: await saves.GetSavedAsync(callerId, cancellationToken))
            : new SaveResult(SaveOutcome.NoShop);

    /// <summary>Saves a recipe. Asking again for one already saved changes nothing and is not an error.</summary>
    public async Task<SaveResult> SaveAsync(int callerId, int recipeId, CancellationToken cancellationToken)
    {
        if (!await saves.CanShopAsync(callerId, cancellationToken))
        {
            return new SaveResult(SaveOutcome.NoShop);
        }

        // A recipe the caller may not save answers like one that does not exist, so the existence of a draft or of
        // a premium recipe is not revealed (as recipe detail does for a draft).
        var facts = await recipes.GetAccessFactsAsync(recipeId, callerId, cancellationToken);
        if (facts is null || !RecipeAccess.CanSave(facts, callerId, viewerCanShop: true))
        {
            return new SaveResult(SaveOutcome.NotFound);
        }

        await saves.AddAsync(callerId, recipeId, clock.GetUtcNow(), cancellationToken);
        return await StateAsync(recipeId, saved: true, cancellationToken);
    }

    /// <summary>Unsaves a recipe. Asking for one that was not saved changes nothing and is not an error.</summary>
    public async Task<SaveResult> UnsaveAsync(int callerId, int recipeId, CancellationToken cancellationToken)
    {
        if (!await saves.CanShopAsync(callerId, cancellationToken))
        {
            return new SaveResult(SaveOutcome.NoShop);
        }

        await saves.RemoveAsync(callerId, recipeId, cancellationToken);
        return await StateAsync(recipeId, saved: false, cancellationToken);
    }

    private async Task<SaveResult> StateAsync(int recipeId, bool saved, CancellationToken cancellationToken)
    {
        var count = await saves.GetSaveCountAsync(recipeId, cancellationToken);
        return count is null
            ? new SaveResult(SaveOutcome.NotFound)
            : new SaveResult(SaveOutcome.Done, State: new SaveStateDto(recipeId, saved, count.Value));
    }
}
