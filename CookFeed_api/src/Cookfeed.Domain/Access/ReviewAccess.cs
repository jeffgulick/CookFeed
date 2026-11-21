namespace Cookfeed.Domain.Access;

/// <summary>What the review form shows a viewer, and why there is no form when there is none.</summary>
public enum ReviewFormState
{
    /// <summary>A signed-out visitor: sign in to write a review.</summary>
    SignIn,

    /// <summary>An account that cannot shop (the admin): no reviews at all.</summary>
    NoShop,

    /// <summary>The viewer made the product; creators cannot review their own.</summary>
    YourOwn,

    /// <summary>The viewer has a review here that counts; they may delete it and write another.</summary>
    AlreadyReviewed,

    /// <summary>The viewer's review was hidden by the admin; it does not count and they cannot delete it.</summary>
    HiddenReview,

    /// <summary>The viewer's order was refunded; their review does not count, and they may delete it.</summary>
    RefundedReview,

    /// <summary>The viewer has not bought the product: only buyers review.</summary>
    MustBuy,

    /// <summary>A buyer with no review yet: show the form.</summary>
    CanReview,
}

/// <summary>What the review rule needs to know about one viewer and one product.</summary>
/// <param name="ViewerCanShop">The viewer holds the HomeCook role. Every creator does; the admin does not (§3.1).</param>
/// <param name="ViewerMadeProduct">The viewer is the product's creator.</param>
/// <param name="ViewerOwnsProduct">The viewer has a Paid order for the product.</param>
/// <param name="ViewerHasReview">The viewer has written a review of the product.</param>
/// <param name="ViewerReviewIsHidden">That review was hidden by the admin.</param>
public sealed record ReviewFormFacts(bool ViewerCanShop, bool ViewerMadeProduct, bool ViewerOwnsProduct,
    bool ViewerHasReview, bool ViewerReviewIsHidden);

/// <summary>
/// Who may review a product (DesignDocument.md §3.5): a cook with a Paid order for it, once, and never their own. The
/// prototype's <c>rules.js</c> <c>reviewState</c> is its twin, with the checks in the same order.
/// </summary>
public static class ReviewAccess
{
    public static ReviewFormState FormState(bool signedIn, ReviewFormFacts facts)
    {
        if (!signedIn)
        {
            return ReviewFormState.SignIn;
        }

        if (!facts.ViewerCanShop)
        {
            return ReviewFormState.NoShop;
        }

        if (facts.ViewerMadeProduct)
        {
            return ReviewFormState.YourOwn;
        }

        // One review per account and product. What the author can still do with it depends on why it stopped
        // counting: nothing once the admin hid it, and only delete it once the order was refunded.
        if (facts.ViewerHasReview)
        {
            if (facts.ViewerReviewIsHidden)
            {
                return ReviewFormState.HiddenReview;
            }

            return facts.ViewerOwnsProduct ? ReviewFormState.AlreadyReviewed : ReviewFormState.RefundedReview;
        }

        return facts.ViewerOwnsProduct ? ReviewFormState.CanReview : ReviewFormState.MustBuy;
    }

    /// <summary>
    /// A review counts toward the rating, and is shown to other cooks, while the admin has not hidden it and its
    /// author still owns the product: a refund takes the review out with the purchase (§3.5, §3.8).
    /// </summary>
    public static bool Counts(bool isHidden, bool authorOwnsProduct) => !isHidden && authorOwnsProduct;
}
