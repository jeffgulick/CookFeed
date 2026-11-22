using Cookfeed.Domain.Access;

namespace Cookfeed.Domain.Tests.Access;

/// <summary>
/// <see cref="StudioRules"/>: what stops a creator publishing or unpublishing a recipe, or putting a plan back on
/// sale (DesignDocument.md §3.8). The prototype's <c>rules.js</c> (<c>creatorPublishProblem</c>,
/// <c>restoreProblem</c>) is its twin, with the checks in the same order.
/// </summary>
public class StudioRulesTests
{
    [Fact]
    public void A_draft_with_something_to_cook_can_be_published()
    {
        Assert.Equal(PublishProblem.None, StudioRules.WhyNotPublish(Recipe()));
    }

    [Fact]
    public void A_recipe_Cookfeed_took_down_cannot_be_published_again_from_the_studio()
    {
        // Checked first: what the admin took down only the admin puts back, whatever else is true.
        Assert.Equal(PublishProblem.TakenDownByCookfeed,
            StudioRules.WhyNotPublish(Recipe(adminTookDown: true, ingredients: 0)));
    }

    [Fact]
    public void A_recipe_is_published_only_with_an_ingredient_and_a_step()
    {
        Assert.Equal(PublishProblem.NoIngredients, StudioRules.WhyNotPublish(Recipe(ingredients: 0, steps: 0)));
        Assert.Equal(PublishProblem.NoSteps, StudioRules.WhyNotPublish(Recipe(steps: 0)));
    }

    [Fact]
    public void A_published_recipe_nobody_bought_and_no_plan_holds_can_be_unpublished()
    {
        Assert.Equal(PublishProblem.None, StudioRules.WhyNotUnpublish(Recipe()));
    }

    [Fact]
    public void A_recipe_in_a_plan_stays_published_until_it_is_taken_out_of_the_plan()
    {
        // Checked before the buyers: the plan is the thing the creator can change.
        Assert.Equal(PublishProblem.InAPlan, StudioRules.WhyNotUnpublish(Recipe(plans: 1, buyers: 3)));
    }

    [Fact]
    public void A_recipe_cooks_have_bought_stays_published_for_them()
    {
        Assert.Equal(PublishProblem.BoughtByCooks, StudioRules.WhyNotUnpublish(Recipe(buyers: 1)));
    }

    [Fact]
    public void A_retired_plan_whose_recipes_are_all_published_can_go_back_on_sale()
    {
        Assert.Equal(RestoreProblem.None, StudioRules.WhyNotRestore(Product()));
    }

    [Fact]
    public void A_plan_Cookfeed_retired_cannot_go_back_on_sale_from_the_studio()
    {
        Assert.Equal(RestoreProblem.RetiredByCookfeed, StudioRules.WhyNotRestore(Product(adminTookDown: true, placements: 0)));
    }

    [Fact]
    public void A_plan_goes_on_sale_only_with_a_recipe_in_it_and_none_of_them_a_draft()
    {
        Assert.Equal(RestoreProblem.NoRecipes, StudioRules.WhyNotRestore(Product(placements: 0)));
        Assert.Equal(RestoreProblem.HoldsADraft, StudioRules.WhyNotRestore(Product(drafts: 1)));
    }

    private static RecipePublishFacts Recipe(bool adminTookDown = false, int ingredients = 3, int steps = 2,
        int plans = 0, int buyers = 0) =>
        new(adminTookDown, ingredients, steps, PlanCount: plans, BuyerCount: buyers);

    private static ProductRestoreFacts Product(bool adminTookDown = false, int placements = 3, int drafts = 0) =>
        new(adminTookDown, placements, DraftCount: drafts);
}
