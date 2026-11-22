namespace Cookfeed.Domain.Access;

/// <summary>Where a viewer stands with buying one product, and so what its buy area offers.</summary>
public enum BuyState
{
    /// <summary>A signed-out visitor: sign in to buy.</summary>
    SignIn,

    /// <summary>An account that cannot shop (the admin): no buying at all.</summary>
    NoShop,

    /// <summary>The viewer made the product; creators cannot buy their own.</summary>
    YourOwn,

    /// <summary>The viewer has a Paid order for it. A product is bought once.</summary>
    Owned,

    /// <summary>Retired, its creator suspended, or one of its recipes taken out of the store.</summary>
    NotForSale,

    /// <summary>Already in the viewer's cart.</summary>
    InCart,

    /// <summary>The viewer can add it to their cart.</summary>
    Buy,
}

/// <summary>What the buy rule needs to know about one viewer and one product.</summary>
/// <param name="ViewerCanShop">The viewer holds the HomeCook role. Every creator does; the admin does not (§3.1).</param>
/// <param name="ViewerMadeProduct">The viewer is the product's creator.</param>
/// <param name="ViewerOwnsProduct">The viewer has a Paid order for the product.</param>
/// <param name="ForSale">The product is for sale now.</param>
/// <param name="InCart">The product is in the viewer's cart.</param>
public sealed record BuyFacts(bool ViewerCanShop, bool ViewerMadeProduct, bool ViewerOwnsProduct, bool ForSale,
    bool InCart);

/// <summary>
/// Who may buy a product (DesignDocument.md §3.4): a home cook, once, never their own, and only while it is for
/// sale. The prototype's <c>rules.js</c> <c>buyState</c> is its twin, with the checks in the same order.
/// </summary>
public static class BuyAccess
{
    public static BuyState State(bool signedIn, BuyFacts facts)
    {
        if (signedIn && !facts.ViewerCanShop)
        {
            return BuyState.NoShop;
        }

        if (signedIn && facts.ViewerMadeProduct)
        {
            return BuyState.YourOwn;
        }

        // Before "not for sale": a buyer is told they own a product even after it is retired.
        if (signedIn && facts.ViewerOwnsProduct)
        {
            return BuyState.Owned;
        }

        if (!facts.ForSale)
        {
            return BuyState.NotForSale;
        }

        if (!signedIn)
        {
            return BuyState.SignIn;
        }

        return facts.InCart ? BuyState.InCart : BuyState.Buy;
    }

    /// <summary>A cart line can be checked out while its product could still be added, or is rightly in the cart.</summary>
    public static bool CanCheckOut(BuyState state) => state is BuyState.Buy or BuyState.InCart;
}
