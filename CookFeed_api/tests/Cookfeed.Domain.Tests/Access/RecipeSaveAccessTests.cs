using Cookfeed.Domain.Access;
using Cookfeed.Domain.Enums;

namespace Cookfeed.Domain.Tests.Access;

/// <summary>
/// <see cref="RecipeAccess.CanSave"/>: who may save a recipe to My kitchen (DesignDocument.md §3.4). A home cook who
/// may open it, and only while it is in the store or theirs through a purchase. The prototype's <c>rules.js</c>
/// <c>canSave</c> is its twin.
/// </summary>
public class RecipeSaveAccessTests
{
    private const int Creator = 4, Cook = 7;

    [Fact]
    public void A_cook_can_save_a_free_published_recipe()
    {
        Assert.True(RecipeAccess.CanSave(Recipe(), Cook, viewerCanShop: true));
    }

    [Fact]
    public void An_account_that_cannot_shop_saves_nothing()
    {
        // The admin holds no HomeCook role (§3.1), though it can open any free recipe.
        Assert.False(RecipeAccess.CanSave(Recipe(), Cook, viewerCanShop: false));
    }

    [Fact]
    public void A_premium_recipe_cannot_be_saved_by_a_cook_who_has_not_bought_it()
    {
        Assert.False(RecipeAccess.CanSave(Recipe(RecipeVisibility.ProductOnly), Cook, viewerCanShop: true));
    }

    [Fact]
    public void A_premium_recipe_can_be_saved_by_a_cook_who_bought_it()
    {
        Assert.True(RecipeAccess.CanSave(Recipe(RecipeVisibility.ProductOnly, bought: true), Cook, viewerCanShop: true));
    }

    [Fact]
    public void A_buyer_can_still_save_a_recipe_that_was_taken_out_of_the_store()
    {
        Assert.True(RecipeAccess.CanSave(Recipe(RecipeVisibility.ProductOnly, published: false, bought: true), Cook,
            viewerCanShop: true));
    }

    [Fact]
    public void A_draft_cannot_be_saved_even_by_its_creator_who_can_open_it()
    {
        var draft = Recipe(published: false);

        Assert.True(RecipeAccess.CanOpen(draft, Creator));
        Assert.False(RecipeAccess.CanSave(draft, Creator, viewerCanShop: true));
    }

    [Fact]
    public void A_creator_can_save_their_own_published_recipe()
    {
        Assert.True(RecipeAccess.CanSave(Recipe(RecipeVisibility.ProductOnly), Creator, viewerCanShop: true));
    }

    private static RecipeAccessFacts Recipe(RecipeVisibility visibility = RecipeVisibility.Public,
        bool published = true, bool bought = false) =>
        new(Creator, published, visibility, ViewerHoldsPaidSnapshot: bought);
}
