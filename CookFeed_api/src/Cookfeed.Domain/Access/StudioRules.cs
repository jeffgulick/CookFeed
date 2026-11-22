namespace Cookfeed.Domain.Access;

/// <summary>Why a creator cannot publish or unpublish a recipe right now.</summary>
public enum PublishProblem
{
    None,

    /// <summary>The admin took the recipe down; only the admin puts it back.</summary>
    TakenDownByCookfeed,

    /// <summary>A recipe is published only with something to cook.</summary>
    NoIngredients,

    NoSteps,

    /// <summary>A plan sells it: it has to come out of the plan first.</summary>
    InAPlan,

    /// <summary>Cooks have bought it, and buyers keep what they paid for.</summary>
    BoughtByCooks,
}

/// <summary>Why a creator cannot put a retired plan back on sale right now.</summary>
public enum RestoreProblem
{
    None,

    /// <summary>The admin retired the plan; only the admin puts it back.</summary>
    RetiredByCookfeed,

    NoRecipes,

    /// <summary>One of its recipes is not published, and a buyer never pays for a draft.</summary>
    HoldsADraft,
}

/// <summary>What the publishing rule needs to know about one recipe.</summary>
/// <param name="AdminTookDown">The admin's latest action on the recipe unpublished it.</param>
/// <param name="PlanCount">How many plans hold it.</param>
/// <param name="BuyerCount">How many cooks hold it through a Paid order's snapshot.</param>
public sealed record RecipePublishFacts(bool AdminTookDown, int IngredientCount, int StepCount, int PlanCount, int BuyerCount);

/// <summary>What the restoring rule needs to know about one plan.</summary>
/// <param name="AdminTookDown">The admin's latest action on the plan retired it.</param>
/// <param name="PlacementCount">How many places it has: an empty plan is not sold.</param>
/// <param name="DraftCount">How many of its recipes are not published.</param>
public sealed record ProductRestoreFacts(bool AdminTookDown, int PlacementCount, int DraftCount);

/// <summary>
/// What a creator may change in their studio (DesignDocument.md §3.8). The prototype's <c>rules.js</c>
/// (<c>creatorPublishProblem</c>, <c>restoreProblem</c>) is its twin, with the checks in the same order. Retiring a
/// plan is always allowed: it leaves the store, and everyone who bought it keeps it.
/// </summary>
public static class StudioRules
{
    public static PublishProblem WhyNotPublish(RecipePublishFacts recipe)
    {
        if (recipe.AdminTookDown)
        {
            return PublishProblem.TakenDownByCookfeed;
        }

        if (recipe.IngredientCount == 0)
        {
            return PublishProblem.NoIngredients;
        }

        return recipe.StepCount == 0 ? PublishProblem.NoSteps : PublishProblem.None;
    }

    public static PublishProblem WhyNotUnpublish(RecipePublishFacts recipe)
    {
        // The plan first: it is the thing the creator can change. A recipe bought on its own account stays for its buyers.
        if (recipe.PlanCount > 0)
        {
            return PublishProblem.InAPlan;
        }

        return recipe.BuyerCount > 0 ? PublishProblem.BoughtByCooks : PublishProblem.None;
    }

    public static RestoreProblem WhyNotRestore(ProductRestoreFacts product)
    {
        if (product.AdminTookDown)
        {
            return RestoreProblem.RetiredByCookfeed;
        }

        if (product.PlacementCount == 0)
        {
            return RestoreProblem.NoRecipes;
        }

        return product.DraftCount > 0 ? RestoreProblem.HoldsADraft : RestoreProblem.None;
    }
}
