using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Reviews;
using Cookfeed.Contracts.Storefront;
using NSubstitute;

namespace Cookfeed.Application.Tests.Reviews;

/// <summary>
/// <see cref="ReviewWriteService"/>: posting a review and deleting one's own (DesignDocument.md §3.5). Whether the
/// caller may is what the review form shows them (<c>ReviewAccess.FormState</c>), so the page and the write can
/// never disagree. The repository is a fake.
/// </summary>
public class ReviewWriteServiceTests
{
    private const int Product = 4, Caller = 2, Creator = 5;
    private static readonly DateTimeOffset Now = new(2026, 11, 21, 18, 0, 0, TimeSpan.Zero);

    private readonly IReviewRepository _reviews = Substitute.For<IReviewRepository>();
    private readonly TimeProvider _clock = Substitute.For<TimeProvider>();

    public ReviewWriteServiceTests()
    {
        _clock.GetUtcNow().Returns(Now);
        _reviews.AddAsync(0, 0, 0, false, "", default, CancellationToken.None).ReturnsForAnyArgs(true);
    }

    private ReviewWriteService Service => new(_reviews, new ProductReviewsService(_reviews), _clock);

    [Fact]
    public async Task A_buyer_with_no_review_posts_one_trimmed_and_dated_now()
    {
        PageIs(owns: true);

        var result = await Service.PostAsync(Caller, Product, rating: 5, recommends: true,
            "  One trip covered the week.  ", CancellationToken.None);

        Assert.Equal(ReviewWriteOutcome.Done, result.Outcome);
        Assert.NotNull(result.Page);
        await _reviews.Received(1).AddAsync(Product, Caller, 5, true, "One trip covered the week.", Now,
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task A_product_that_does_not_exist_is_not_found()
    {
        var result = await Service.PostAsync(Caller, 999, 5, true, "One trip covered the week.", CancellationToken.None);

        Assert.Equal(ReviewWriteOutcome.NotFound, result.Outcome);
        await NothingWasPosted();
    }

    [Theory]
    [InlineData(false, false, false)]   // has not bought it
    [InlineData(true, true, false)]     // the creator's own product
    [InlineData(true, false, true)]     // an account that cannot shop
    public async Task Someone_who_may_not_review_is_refused_and_nothing_is_written(bool owns, bool madeIt, bool admin)
    {
        PageIs(owns, madeIt: madeIt, canShop: !admin);

        var result = await Service.PostAsync(Caller, Product, 5, true, "One trip covered the week.", CancellationToken.None);

        Assert.Equal(ReviewWriteOutcome.NotAllowed, result.Outcome);
        await NothingWasPosted();
    }

    [Theory]
    [InlineData(true, false)]    // a review that counts
    [InlineData(true, true)]     // one the admin hid
    [InlineData(false, false)]   // one whose order was refunded
    public async Task A_second_review_of_the_same_product_is_refused(bool owns, bool hidden)
    {
        PageIs(owns, review: Review(hidden, owns));

        var result = await Service.PostAsync(Caller, Product, 5, true, "One trip covered the week.", CancellationToken.None);

        Assert.Equal(ReviewWriteOutcome.AlreadyReviewed, result.Outcome);
        await NothingWasPosted();
    }

    [Fact]
    public async Task A_review_that_lost_the_race_to_another_request_is_refused_as_a_second_review()
    {
        PageIs(owns: true);
        _reviews.AddAsync(0, 0, 0, false, "", default, CancellationToken.None).ReturnsForAnyArgs(false);

        var result = await Service.PostAsync(Caller, Product, 5, true, "One trip covered the week.", CancellationToken.None);

        Assert.Equal(ReviewWriteOutcome.AlreadyReviewed, result.Outcome);
    }

    [Theory]
    [InlineData(true)]    // a review that counts
    [InlineData(false)]   // one whose order was refunded: it may still be deleted
    public async Task An_author_deletes_their_own_review(bool owns)
    {
        PageIs(owns, review: Review(hidden: false, owns));

        var result = await Service.DeleteMineAsync(Caller, Product, CancellationToken.None);

        Assert.Equal(ReviewWriteOutcome.Done, result.Outcome);
        Assert.NotNull(result.Page);
        await _reviews.Received(1).DeleteAsync(Product, Caller, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task A_review_the_admin_hid_cannot_be_deleted_and_posted_again()
    {
        PageIs(owns: true, review: Review(hidden: true, authorOwns: true));

        var result = await Service.DeleteMineAsync(Caller, Product, CancellationToken.None);

        Assert.Equal(ReviewWriteOutcome.Hidden, result.Outcome);
        await _reviews.DidNotReceive().DeleteAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Deleting_when_there_is_no_review_of_ones_own_is_not_found()
    {
        PageIs(owns: true);

        var result = await Service.DeleteMineAsync(Caller, Product, CancellationToken.None);

        Assert.Equal(ReviewWriteOutcome.NotFound, result.Outcome);
        await _reviews.DidNotReceive().DeleteAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<CancellationToken>());
    }

    private void PageIs(bool owns, bool madeIt = false, bool canShop = true, ProductReviewRow? review = null) =>
        _reviews.GetProductReviewsAsync(Product, Caller, Arg.Any<CancellationToken>()).Returns(new ProductReviews(
            Product, ProductType.MealPlan, "Family Week on a Budget", madeIt ? Caller : Creator, "dan-meal-preps",
            "Dan Okafor", false, ViewerCanShop: canShop, ViewerIsAdmin: !canShop, ViewerOwnsProduct: owns,
            review is null ? [] : [review]));

    private static ProductReviewRow Review(bool hidden, bool authorOwns) =>
        new(1, Caller, "Priya Shah", 4, true, "Worth it for the shopping list alone.", Now, hidden, authorOwns, false);

    private Task NothingWasPosted() =>
        _reviews.DidNotReceive().AddAsync(Arg.Any<int>(), Arg.Any<int>(), Arg.Any<int>(), Arg.Any<bool>(),
            Arg.Any<string>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>());
}
