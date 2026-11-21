using Cookfeed.Domain.Access;

namespace Cookfeed.Domain.Tests.Access;

/// <summary>
/// <see cref="ReviewAccess"/>: what the review form shows a viewer (DesignDocument.md §3.5). A review needs a Paid
/// order for the product, one per account, and never on the viewer's own product. The prototype's <c>rules.js</c>
/// <c>reviewState</c> is its twin, and the checks run in the same order.
/// </summary>
public class ReviewAccessTests
{
    [Fact]
    public void A_signed_out_visitor_is_asked_to_sign_in()
    {
        Assert.Equal(ReviewFormState.SignIn, ReviewAccess.FormState(signedIn: false, Facts()));
    }

    [Fact]
    public void An_account_that_cannot_shop_writes_no_reviews()
    {
        // The admin holds no HomeCook role, so it never buys and never reviews (§3.1).
        Assert.Equal(ReviewFormState.NoShop, ReviewAccess.FormState(signedIn: true, Facts(canShop: false, owns: true)));
    }

    [Fact]
    public void A_creator_cannot_review_their_own_product()
    {
        Assert.Equal(ReviewFormState.YourOwn, ReviewAccess.FormState(signedIn: true, Facts(madeIt: true)));
    }

    [Fact]
    public void A_cook_who_has_not_bought_it_must_buy_first()
    {
        Assert.Equal(ReviewFormState.MustBuy, ReviewAccess.FormState(signedIn: true, Facts()));
    }

    [Fact]
    public void A_buyer_with_no_review_yet_can_write_one()
    {
        Assert.Equal(ReviewFormState.CanReview, ReviewAccess.FormState(signedIn: true, Facts(owns: true)));
    }

    [Fact]
    public void A_buyer_who_has_reviewed_it_is_told_so()
    {
        Assert.Equal(ReviewFormState.AlreadyReviewed,
            ReviewAccess.FormState(signedIn: true, Facts(owns: true, hasReview: true)));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void A_reviewer_whose_review_was_hidden_is_told_that_whether_or_not_they_still_own_it(bool owns)
    {
        Assert.Equal(ReviewFormState.HiddenReview,
            ReviewAccess.FormState(signedIn: true, Facts(owns: owns, hasReview: true, reviewHidden: true)));
    }

    [Fact]
    public void A_reviewer_whose_order_was_refunded_is_told_the_review_no_longer_counts()
    {
        Assert.Equal(ReviewFormState.RefundedReview,
            ReviewAccess.FormState(signedIn: true, Facts(owns: false, hasReview: true)));
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void A_review_counts_only_while_it_is_not_hidden_and_its_author_still_owns_the_product(bool hidden)
    {
        Assert.True(ReviewAccess.Counts(isHidden: false, authorOwnsProduct: true));
        Assert.False(ReviewAccess.Counts(isHidden: hidden, authorOwnsProduct: false));
        Assert.False(ReviewAccess.Counts(isHidden: true, authorOwnsProduct: true));
    }

    private static ReviewFormFacts Facts(bool canShop = true, bool madeIt = false, bool owns = false,
        bool hasReview = false, bool reviewHidden = false) =>
        new(canShop, madeIt, owns, hasReview, reviewHidden);
}
