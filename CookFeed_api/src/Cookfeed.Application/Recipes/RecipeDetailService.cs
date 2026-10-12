using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Recipes;
using Cookfeed.Domain.Access;

namespace Cookfeed.Application.Recipes;

/// <summary>Opens one recipe for a viewer, if <see cref="RecipeAccess"/> lets the viewer open it.</summary>
public class RecipeDetailService(IRecipeRepository recipes)
{
    /// <summary>
    /// The recipe, or null when there is none with the id or the viewer may not open it. The two look the same to the
    /// caller (the controller answers 404 to both), so a locked or draft recipe never reveals that it exists.
    /// </summary>
    public async Task<RecipeDetailDto?> GetRecipeAsync(int recipeId, int? viewerId, CancellationToken cancellationToken)
    {
        // A few columns first, so a recipe the viewer may not open never has its ingredients and steps read.
        var facts = await recipes.GetAccessFactsAsync(recipeId, viewerId, cancellationToken);
        if (facts is null || !RecipeAccess.CanOpen(facts, viewerId))
        {
            return null;
        }

        return await recipes.GetDetailAsync(recipeId, viewerId, cancellationToken);
    }
}
