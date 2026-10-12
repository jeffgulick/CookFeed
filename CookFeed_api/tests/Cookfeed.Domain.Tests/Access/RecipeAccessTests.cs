using Cookfeed.Domain.Access;
using Cookfeed.Domain.Enums;

namespace Cookfeed.Domain.Tests.Access;

/// <summary>
/// <see cref="RecipeAccess"/>: who may open a recipe (DesignDocument.md §3.3, <c>queries.sql</c> Q14). A published
/// Public recipe opens for anyone; a ProductOnly one for a viewer whose Paid order holds it; a draft for no one but
/// its creator, who can always open their own recipes.
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
    [InlineData(null, false)]
    [InlineData(Other, false)]
    [InlineData(Buyer, true)]
    public void A_draft_is_closed_to_everyone_but_its_creator(int? viewer, bool viewerHoldsIt)
    {
        // Even a buyer: a creator who unpublishes a recipe takes it out of view (DesignDocument.md §3.3).
        Assert.False(RecipeAccess.CanOpen(Facts(published: false, RecipeVisibility.Public, viewerHoldsIt), viewer));
    }

    private static RecipeAccessFacts Facts(bool published, RecipeVisibility visibility, bool viewerHoldsIt) =>
        new(Creator, published, visibility, viewerHoldsIt);
}
