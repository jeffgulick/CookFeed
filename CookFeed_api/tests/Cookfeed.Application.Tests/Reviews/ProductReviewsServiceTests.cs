using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Reviews;
using Cookfeed.Contracts.Reviews;
using Cookfeed.Contracts.Storefront;
using NSubstitute;

namespace Cookfeed.Application.Tests.Reviews;

/// <summary>
/// <see cref="ProductReviewsService"/> decides which of a product's reviews a viewer sees (those that count, plus
/// their own, plus everything for the admin), sums up the ones that count, and says what the review form shows.
/// </summary>
public class ProductReviewsServiceTests
{
    private const int ProductId = 3, CreatorId = 4, Alex = 1, Priya = 2, Dan = 5, Admin = 6, Sam = 7;

    private readonly IReviewRepository _reviews = Substitute.For<IReviewRepository>();

    private ProductReviewsService Service => new(_reviews);

    [Fact]
    public async Task An_unknown_product_is_null()
    {
        _reviews.GetProductReviewsAsync(ProductId, Arg.Any<int?>(), Arg.Any<CancellationToken>()).Returns((ProductReviews?)null);

        Assert.Null(await Service.GetReviewsAsync(ProductId, Sam, CancellationToken.None));
    }

    [Fact]
    public async Task A_visitor_sees_only_the_reviews_that_count_in_the_order_given()
    {
        Given(Page(reviews:
        [
            Review(1, Alex, rating: 5),
            Review(2, Priya, rating: 4, hidden: true),
            Review(3, Dan, rating: 3, authorOwns: false),
        ]));

        var page = (await Service.GetReviewsAsync(ProductId, viewerId: null, CancellationToken.None))!;

        var only = Assert.Single(page.Reviews);
        Assert.Equal((1, true, false, false), (only.Id, only.Counts, only.IsHidden, only.IsMine));
    }

    [Fact]
    public async Task The_admin_sees_every_review_marked_hidden_or_not_counted()
    {
        Given(Page(viewerIsAdmin: true, viewerCanShop: false, reviews:
        [
            Review(1, Alex, rating: 5),
            Review(2, Priya, rating: 4, hidden: true),
            Review(3, Dan, rating: 3, authorOwns: false),
        ]));

        var page = (await Service.GetReviewsAsync(ProductId, Admin, CancellationToken.None))!;

        Assert.Equal([(1, false, true), (2, true, false), (3, false, false)],
            page.Reviews.Select(r => (r.Id, r.IsHidden, r.Counts)));
    }

    [Theory]
    [InlineData(Priya, 2)]   // hidden by the admin
    [InlineData(Dan, 3)]     // order refunded
    public async Task An_author_still_sees_their_own_review_when_it_no_longer_counts(int viewer, int reviewId)
    {
        Given(Page(reviews:
        [
            Review(1, Alex, rating: 5),
            Review(2, Priya, rating: 4, hidden: true),
            Review(3, Dan, rating: 3, authorOwns: false),
        ]));

        var page = (await Service.GetReviewsAsync(ProductId, viewer, CancellationToken.None))!;

        Assert.Equal([1, reviewId], page.Reviews.Select(r => r.Id));
        Assert.Equal([false, true], page.Reviews.Select(r => r.IsMine));
        Assert.False(page.Reviews[1].Counts);
    }

    [Fact]
    public async Task The_summary_adds_up_only_the_reviews_that_count()
    {
        Given(Page(reviews:
        [
            Review(1, Alex, rating: 5, recommends: true),
            Review(2, Priya, rating: 4, recommends: true),
            Review(3, Dan, rating: 3, recommends: false),
            Review(4, Sam, rating: 1, recommends: false, hidden: true),
        ]));

        var summary = (await Service.GetReviewsAsync(ProductId, viewerId: null, CancellationToken.None))!.Summary;

        Assert.Equal((3, 4.0m, 67), (summary.ReviewCount, summary.Average, summary.PercentRecommend));
        Assert.Equal([0, 0, 1, 1, 1], summary.StarCounts);   // one each of 3, 4 and 5 stars; the hidden 1-star is out
    }

    [Fact]
    public async Task With_no_reviews_there_is_no_average_and_every_star_count_is_zero()
    {
        Given(Page());

        var summary = (await Service.GetReviewsAsync(ProductId, viewerId: null, CancellationToken.None))!.Summary;

        Assert.Equal((0, null, null), (summary.ReviewCount, summary.Average, summary.PercentRecommend));
        Assert.Equal([0, 0, 0, 0, 0], summary.StarCounts);
    }

    [Fact]
    public async Task A_signed_out_visitor_is_asked_to_sign_in()
    {
        Given(Page(viewerCanShop: false));

        Assert.Equal(ReviewFormState.SignIn, (await Service.GetReviewsAsync(ProductId, null, CancellationToken.None))!.FormState);
    }

    [Theory]
    [InlineData(Sam, false, ReviewFormState.MustBuy)]
    [InlineData(Sam, true, ReviewFormState.CanReview)]
    [InlineData(Alex, true, ReviewFormState.AlreadyReviewed)]     // has a review that counts
    [InlineData(Priya, true, ReviewFormState.HiddenReview)]
    [InlineData(Dan, false, ReviewFormState.RefundedReview)]
    [InlineData(CreatorId, false, ReviewFormState.YourOwn)]
    public async Task The_form_state_follows_the_viewers_purchase_and_their_own_review(
        int viewer, bool owns, ReviewFormState expected)
    {
        Given(Page(viewerOwns: owns, reviews:
        [
            Review(1, Alex, rating: 5),
            Review(2, Priya, rating: 4, hidden: true),
            Review(3, Dan, rating: 3, authorOwns: false),
        ]));

        Assert.Equal(expected, (await Service.GetReviewsAsync(ProductId, viewer, CancellationToken.None))!.FormState);
    }

    [Fact]
    public async Task An_account_that_cannot_shop_gets_no_form()
    {
        Given(Page(viewerIsAdmin: true, viewerCanShop: false));

        Assert.Equal(ReviewFormState.NoShop, (await Service.GetReviewsAsync(ProductId, Admin, CancellationToken.None))!.FormState);
    }

    [Fact]
    public async Task The_header_and_each_reviews_fields_pass_through()
    {
        Given(Page(reviews: [Review(1, Alex, rating: 5, recommends: true) with { ReviewerIsCreator = true }]));

        var page = (await Service.GetReviewsAsync(ProductId, Alex, CancellationToken.None))!;

        Assert.Equal((ProductId, ProductType.MealPlan, "Three Weeknights in Japan", "kenji-kitchen", "Kenji Watanabe", true),
            (page.ProductId, page.Type, page.Title, page.Creator.Handle, page.Creator.DisplayName, page.Creator.IsVerified));
        Assert.Equal(new ReviewDto(1, "Reviewer 1", 5, true, "A review with enough words.", DateTimeOffset.UnixEpoch,
            IsMine: true, IsHidden: false, Counts: true, ReviewerIsCreator: true), Assert.Single(page.Reviews));
    }

    private void Given(ProductReviews page) =>
        _reviews.GetProductReviewsAsync(ProductId, Arg.Any<int?>(), Arg.Any<CancellationToken>()).Returns(page);

    private static ProductReviews Page(bool viewerCanShop = true, bool viewerIsAdmin = false, bool viewerOwns = false,
        IReadOnlyList<ProductReviewRow>? reviews = null) =>
        new(ProductId, ProductType.MealPlan, "Three Weeknights in Japan", CreatorId, "kenji-kitchen", "Kenji Watanabe",
            CreatorIsVerified: true, viewerCanShop, viewerIsAdmin, viewerOwns, reviews ?? []);

    private static ProductReviewRow Review(int id, int userId, int rating, bool recommends = true, bool hidden = false,
        bool authorOwns = true) =>
        new(id, userId, $"Reviewer {userId}", rating, recommends, "A review with enough words.", DateTimeOffset.UnixEpoch,
            IsHidden: hidden, AuthorOwnsProduct: authorOwns, ReviewerIsCreator: false);
}
