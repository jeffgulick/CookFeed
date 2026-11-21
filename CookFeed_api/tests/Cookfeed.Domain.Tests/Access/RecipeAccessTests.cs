using Cookfeed.Domain.Access;
using Cookfeed.Domain.Enums;

namespace Cookfeed.Domain.Tests.Access;

/// <summary>
/// <see cref="RecipeAccess"/>: who may open a recipe (DesignDocument.md §3.3, <c>queries.sql</c> Q14). A published
/// Public recipe opens for anyone; a ProductOnly one for a viewer whose Paid order holds it. A recipe that is not
/// published is closed to everyone but its creator, who can always open their own recipes, and the cooks who bought
/// it, who keep what they paid for (§3.3, §3.8). The prototype's <c>rules.js</c> <c>canOpenRecipe</c> is its twin.
/// </summary>
public class RecipeAccessTests
{
    private const int Creator = 4, Buyer = 1, Other = 7;

    [Theory]
    [InlineData(null)]
    [InlineData(Other)]
    [InlineData(Buyer)]
    [InlineData(Creator)]
    public void A_published_public_recipe_opens_for_anyone(int? viewer)
    {
        Assert.True(RecipeAccess.CanOpen(Facts(published: true, RecipeVisibility.Public, viewerHoldsIt: viewer == Buyer), viewer));
    }

    [Fact]
    public void A_published_product_only_recipe_opens_for_a_viewer_whose_paid_order_holds_it()
    {
        Assert.True(RecipeAccess.CanOpen(Facts(published: true, RecipeVisibility.ProductOnly, viewerHoldsIt: true), Buyer));
    }

    [Theory]
    [InlineData(null)]
    [InlineData(Other)]
    public void A_published_product_only_recipe_stays_closed_to_anyone_else(int? viewer)
    {
        // A signed-out visitor, and a signed-in cook with no Paid order holding it (a cancelled order holds nothing).
        Assert.False(RecipeAccess.CanOpen(Facts(published: true, RecipeVisibility.ProductOnly, viewerHoldsIt: false), viewer));
    }

    [Theory]
    [InlineData(RecipeVisibility.Public)]
    [InlineData(RecipeVisibility.ProductOnly)]
    public void Its_creator_always_opens_it_drafts_included(RecipeVisibility visibility)
    {
        Assert.True(RecipeAccess.CanOpen(Facts(published: true, visibility, viewerHoldsIt: false), Creator));
        Assert.True(RecipeAccess.CanOpen(Facts(published: false, visibility, viewerHoldsIt: false), Creator));
    }

    [Theory]
    [InlineData(null, RecipeVisibility.Public)]
    [InlineData(Other, RecipeVisibility.Public)]
    [InlineData(null, RecipeVisibility.ProductOnly)]
    [InlineData(Other, RecipeVisibility.ProductOnly)]
    public void A_recipe_that_is_not_published_is_closed_to_a_viewer_who_neither_made_nor_bought_it(
        int? viewer, RecipeVisibility visibility)
    {
        // A draft, or a recipe its creator or the admin took down: out of the store for everyone else.
        Assert.False(RecipeAccess.CanOpen(Facts(published: false, visibility, viewerHoldsIt: false), viewer));
    }

    [Theory]
    [InlineData(RecipeVisibility.Public)]
    [InlineData(RecipeVisibility.ProductOnly)]
    public void A_buyer_keeps_a_recipe_that_was_unpublished(RecipeVisibility visibility)
    {
        // Buyers keep what they bought: unpublishing takes a recipe out of the store, not out of the purchases that
        // hold it (DesignDocument.md §3.3 and §3.8; rules.js canOpenRecipe).
        Assert.True(RecipeAccess.CanOpen(Facts(published: false, visibility, viewerHoldsIt: true), Buyer));
    }

    private static RecipeAccessFacts Facts(bool published, RecipeVisibility visibility, bool viewerHoldsIt) =>
        new(Creator, published, visibility, viewerHoldsIt);
}
