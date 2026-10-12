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
/// saving a recipe and the plan page will reuse. The prototype's <c>rules.js</c> <c>canOpenRecipe</c> is its twin.
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

        // A draft is unfinished: no one else sees it, buyers included.
        if (!recipe.IsPublished)
        {
            return false;
        }

        return recipe.Visibility == RecipeVisibility.Public || recipe.ViewerHoldsPaidSnapshot;
    }
}
