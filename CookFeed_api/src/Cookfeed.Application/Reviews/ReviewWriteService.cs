using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Reviews;

namespace Cookfeed.Application.Reviews;

/// <summary>How a review write ended. Everything but <see cref="Done"/> is a refusal, with nothing written.</summary>
public enum ReviewWriteOutcome
{
    Done,

    /// <summary>No product has the id, or (on delete) the caller has no review of it.</summary>
    NotFound,

    /// <summary>The caller may not review this product: they have not bought it, they made it, or they do not shop.</summary>
    NotAllowed,

    /// <summary>The caller already has a review of the product; an account reviews a product once.</summary>
    AlreadyReviewed,

    /// <summary>The caller's review was hidden by the admin, so it cannot be deleted and posted again.</summary>
    Hidden,
}

/// <summary>The outcome, and the reviews page as the caller now sees it when the write was carried out.</summary>
public sealed record ReviewWriteResult(ReviewWriteOutcome Outcome, ProductReviewsDto? Page = null);

/// <summary>
/// Posting a review and deleting one's own (DesignDocument.md §3.5). Whether the caller may is the state the
/// reviews page already shows them (<see cref="ProductReviewsService"/>, which applies <c>ReviewAccess</c>), so the
/// form a cook is offered and the write the API accepts cannot disagree.
/// </summary>
public class ReviewWriteService(IReviewRepository reviews, ProductReviewsService pages, TimeProvider clock)
{
    public async Task<ReviewWriteResult> PostAsync(int callerId, int productId, int rating, bool recommends,
        string body, CancellationToken cancellationToken)
    {
        var page = await pages.GetReviewsAsync(productId, callerId, cancellationToken);
        if (page is null)
        {
            return new ReviewWriteResult(ReviewWriteOutcome.NotFound);
        }

        switch (page.FormState)
        {
            case ReviewFormState.CanReview:
                break;
            case ReviewFormState.AlreadyReviewed or ReviewFormState.HiddenReview or ReviewFormState.RefundedReview:
                return new ReviewWriteResult(ReviewWriteOutcome.AlreadyReviewed);
            default:
                return new ReviewWriteResult(ReviewWriteOutcome.NotAllowed);
        }

        // False when another request posted the caller's review between the check above and this write.
        var added = await reviews.AddAsync(productId, callerId, rating, recommends, body.Trim(), clock.GetUtcNow(),
            cancellationToken);
        return added
            ? new ReviewWriteResult(ReviewWriteOutcome.Done, await pages.GetReviewsAsync(productId, callerId, cancellationToken))
            : new ReviewWriteResult(ReviewWriteOutcome.AlreadyReviewed);
    }

    /// <summary>
    /// Deletes the caller's review, after which they may write another. A review the admin hid stays: deleting it
    /// and posting again would undo the moderation. One whose order was refunded may still be deleted.
    /// </summary>
    public async Task<ReviewWriteResult> DeleteMineAsync(int callerId, int productId, CancellationToken cancellationToken)
    {
        var page = await pages.GetReviewsAsync(productId, callerId, cancellationToken);
        switch (page?.FormState)
        {
            case ReviewFormState.HiddenReview:
                return new ReviewWriteResult(ReviewWriteOutcome.Hidden);
            case ReviewFormState.AlreadyReviewed or ReviewFormState.RefundedReview:
                await reviews.DeleteAsync(productId, callerId, cancellationToken);
                return new ReviewWriteResult(ReviewWriteOutcome.Done,
                    await pages.GetReviewsAsync(productId, callerId, cancellationToken));
            default:
                return new ReviewWriteResult(ReviewWriteOutcome.NotFound);
        }
    }
}
