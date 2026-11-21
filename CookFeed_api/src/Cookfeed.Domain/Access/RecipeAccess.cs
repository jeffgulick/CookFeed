using Cookfeed.Domain.Enums;

namespace Cookfeed.Domain.Access;

/// <summary>What the access rule needs to know about one recipe and one viewer, read in a single small query.</summary>
/// <param name="ViewerHoldsPaidSnapshot">
/// The viewer has a Paid order whose recipe snapshot (<c>order_item_recipes</c>) holds this recipe. The snapshot, not
/// the live product, decides: a buyer keeps what they bought (DesignDocument.md §3.3).
/// </param>
public sealed record RecipeAccessFacts(int CreatorId, bool IsPublished, RecipeVisibility Visibility,
    bool ViewerHoldsPaidSnapshot);

/// <summary>
/// Who may open a recipe (DesignDocument.md §3.3, <c>queries.sql</c> Q14): the rule recipe detail applies, and the one
/// saving a recipe and the plan page reuse. The prototype's <c>rules.js</c> <c>canOpenRecipe</c> is its twin: its
/// creator, a cook whose Paid order holds it, or anyone when it is published and Public.
/// </summary>
public static class RecipeAccess
{
    public static bool CanOpen(RecipeAccessFacts recipe, int? viewerId)
    {
        // A creator can always open their own recipes, drafts and ProductOnly ones included. Q14 covers buyers only.
        if (viewerId == recipe.CreatorId)
        {
            return true;
        }

        // A buyer keeps what they bought, even after its creator or the admin takes the recipe out of the store
        // (DesignDocument.md §3.3 and §3.8).
        if (recipe.ViewerHoldsPaidSnapshot)
        {
            return true;
        }

        // Everyone else sees only what is in the store and free: a draft or a ProductOnly recipe stays closed.
        return recipe.IsPublished && recipe.Visibility == RecipeVisibility.Public;
    }
}
