using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Application.Products;
using Cookfeed.Contracts.Products;
using Cookfeed.Contracts.Reviews;
using Cookfeed.Domain.Access;
using ReviewFormState = Cookfeed.Contracts.Reviews.ReviewFormState;

namespace Cookfeed.Application.Reviews;

/// <summary>A product's reviews page: which reviews this viewer sees, their summary, and what the form shows.</summary>
public class ProductReviewsService(IReviewRepository reviews)
{
    /// <summary>The page, or null when no product has the id (the controller answers 404).</summary>
    public async Task<ProductReviewsDto?> GetReviewsAsync(int productId, int? viewerId, CancellationToken cancellationToken)
    {
        var page = await reviews.GetProductReviewsAsync(productId, viewerId, cancellationToken);
        if (page is null)
        {
            return null;
        }

        // Other cooks see only the reviews that count. An author always sees their own, so they can remove it, and
        // the admin sees everything, to hide or restore (DesignDocument.md §3.5, §3.8).
        var counting = page.Reviews.Where(Counts).ToList();
        var shown = page.Reviews.Where(r => Counts(r) || page.ViewerIsAdmin || r.UserId == viewerId);
        var mine = page.Reviews.FirstOrDefault(r => r.UserId == viewerId);

        var rating = ProductRating.From(counting.Count, counting.Sum(r => r.Rating), counting.Count(r => r.Recommends));
        var formState = ReviewAccess.FormState(viewerId is not null, new ReviewFormFacts(
            page.ViewerCanShop,
            ViewerMadeProduct: viewerId == page.CreatorId,
            page.ViewerOwnsProduct,
            ViewerHasReview: mine is not null,
            ViewerReviewIsHidden: mine?.IsHidden ?? false));

        return new ProductReviewsDto(
            page.ProductId,
            page.Type,
            page.Title,
            new ProductCreatorDto(page.CreatorHandle, page.CreatorDisplayName, page.CreatorIsVerified),
            new ReviewSummaryDto(rating.ReviewCount, rating.Average, rating.PercentRecommend,
                // One count per star, 1 to 5, for the rating bars.
                [.. Enumerable.Range(1, 5).Select(star => counting.Count(r => r.Rating == star))]),
            ToContract(formState),
            [.. shown.Select(r => new ReviewDto(r.Id, r.ReviewerName, r.Rating, r.Recommends, r.Body, r.CreatedAt,
                IsMine: r.UserId == viewerId, r.IsHidden, Counts(r), r.ReviewerIsCreator))]);
    }

    private static bool Counts(ProductReviewRow review) => ReviewAccess.Counts(review.IsHidden, review.AuthorOwnsProduct);

    private static ReviewFormState ToContract(Domain.Access.ReviewFormState state) => state switch
    {
        Domain.Access.ReviewFormState.SignIn => ReviewFormState.SignIn,
        Domain.Access.ReviewFormState.NoShop => ReviewFormState.NoShop,
        Domain.Access.ReviewFormState.YourOwn => ReviewFormState.YourOwn,
        Domain.Access.ReviewFormState.AlreadyReviewed => ReviewFormState.AlreadyReviewed,
        Domain.Access.ReviewFormState.HiddenReview => ReviewFormState.HiddenReview,
        Domain.Access.ReviewFormState.RefundedReview => ReviewFormState.RefundedReview,
        Domain.Access.ReviewFormState.MustBuy => ReviewFormState.MustBuy,
        Domain.Access.ReviewFormState.CanReview => ReviewFormState.CanReview,
        _ => throw new ArgumentOutOfRangeException(nameof(state), state, "Unknown review form state."),
    };
}
