using Cookfeed.Domain.Access;

namespace Cookfeed.Domain.Tests.Access;

/// <summary>
/// <see cref="BuyAccess"/>: where a viewer stands with buying one product (DesignDocument.md §3.4). The prototype's
/// <c>rules.js</c> <c>buyState</c> is its twin, and the checks run in the same order.
/// </summary>
public class BuyAccessTests
{
    [Fact]
    public void A_cook_can_buy_a_product_for_sale_that_is_not_theirs()
    {
        Assert.Equal(BuyState.Buy, BuyAccess.State(signedIn: true, Facts()));
    }

    [Fact]
    public void A_signed_out_visitor_is_asked_to_sign_in()
    {
        Assert.Equal(BuyState.SignIn, BuyAccess.State(signedIn: false, Facts(canShop: false)));
    }

    [Fact]
    public void An_account_that_cannot_shop_is_offered_nothing()
    {
        // The admin holds no HomeCook role (§3.1), whatever else is true of the product.
        Assert.Equal(BuyState.NoShop, BuyAccess.State(signedIn: true, Facts(canShop: false, owns: true, forSale: false)));
    }

    [Fact]
    public void A_creator_cannot_buy_their_own_product()
    {
        Assert.Equal(BuyState.YourOwn, BuyAccess.State(signedIn: true, Facts(madeIt: true)));
    }

    [Fact]
    public void A_product_already_owned_is_not_bought_twice()
    {
        Assert.Equal(BuyState.Owned, BuyAccess.State(signedIn: true, Facts(owns: true)));
    }

    [Fact]
    public void A_buyer_is_told_they_own_a_product_even_after_it_is_retired()
    {
        Assert.Equal(BuyState.Owned, BuyAccess.State(signedIn: true, Facts(owns: true, forSale: false)));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void A_product_not_for_sale_cannot_be_bought_by_anyone(bool signedIn)
    {
        Assert.Equal(BuyState.NotForSale,
            BuyAccess.State(signedIn, Facts(canShop: signedIn, forSale: false, inCart: signedIn)));
    }

    [Fact]
    public void A_product_already_in_the_cart_says_so()
    {
        Assert.Equal(BuyState.InCart, BuyAccess.State(signedIn: true, Facts(inCart: true)));
    }

    [Theory]
    [InlineData(BuyState.Buy, true)]
    [InlineData(BuyState.InCart, true)]
    [InlineData(BuyState.SignIn, false)]
    [InlineData(BuyState.NoShop, false)]
    [InlineData(BuyState.YourOwn, false)]
    [InlineData(BuyState.Owned, false)]
    [InlineData(BuyState.NotForSale, false)]
    public void Only_a_product_the_cook_could_add_or_has_added_can_be_checked_out(BuyState state, bool expected)
    {
        Assert.Equal(expected, BuyAccess.CanCheckOut(state));
    }

    private static BuyFacts Facts(bool canShop = true, bool madeIt = false, bool owns = false, bool forSale = true,
        bool inCart = false) =>
        new(ViewerCanShop: canShop, ViewerMadeProduct: madeIt, ViewerOwnsProduct: owns, ForSale: forSale,
            InCart: inCart);
}
