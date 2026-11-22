using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Recipes;
using Cookfeed.Domain.Access;

namespace Cookfeed.Application.Recipes;

/// <summary>
/// What looking a recipe up found for one viewer: the recipe, when they may open it; what a locked recipe may say, when
/// it is a published premium recipe they have not bought; or neither, when there is nothing they may know about.
/// </summary>
public sealed record RecipeLookup(RecipeDetailDto? Recipe, RecipeLockedDto? Locked)
{
    public static readonly RecipeLookup Nothing = new(null, null);
}

/// <summary>Opens one recipe for a viewer, if <see cref="RecipeAccess"/> lets the viewer open it.</summary>
public class RecipeDetailService(IRecipeRepository recipes)
{
    /// <summary>
    /// The recipe for a viewer who may open it (200). A published premium recipe the viewer has not bought comes back
    /// locked: its title and the plans selling it, as the prototype's recipe page shows (403). An unknown id, and a draft
    /// that is not the viewer's, come back as nothing, so a draft never reveals that it exists (404).
    /// </summary>
    public async Task<RecipeLookup> GetRecipeAsync(int recipeId, int? viewerId, CancellationToken cancellationToken)
    {
        // A few columns first, so a recipe the viewer may not open never has its ingredients and steps read.
        var facts = await recipes.GetAccessFactsAsync(recipeId, viewerId, cancellationToken);
        if (facts is null)
        {
            return RecipeLookup.Nothing;
        }

        if (RecipeAccess.CanOpen(facts, viewerId))
        {
            return new RecipeLookup(await recipes.GetDetailAsync(recipeId, viewerId, cancellationToken), null);
        }

        // Refused. A published recipe is already named on its plan's page, so saying which plan it comes with gives
        // nothing away. An unpublished one (a draft, or a recipe taken down) stays hidden.
        return facts.IsPublished
            ? new RecipeLookup(null, await recipes.GetLockedAsync(recipeId, cancellationToken))
            : RecipeLookup.Nothing;
    }
}
