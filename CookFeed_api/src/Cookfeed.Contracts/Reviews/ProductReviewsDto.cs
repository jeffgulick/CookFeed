using System.Text.Json.Serialization;
using Cookfeed.Contracts.Products;
using Cookfeed.Contracts.Storefront;

namespace Cookfeed.Contracts.Reviews;

/// <summary>A product's reviews page, as one viewer sees it.</summary>
/// <param name="FormState">What the review form shows this viewer: the form, or why there is none.</param>
/// <param name="Reviews">
/// Newest first. The reviews that count, plus the viewer's own even when it no longer counts; the admin sees every
/// review, with the hidden and uncounted ones marked.
/// </param>
public sealed record ProductReviewsDto(
    int ProductId,
    ProductType Type,
    string Title,
    ProductCreatorDto Creator,
    ReviewSummaryDto Summary,
    ReviewFormState FormState,
    IReadOnlyList<ReviewDto> Reviews);

/// <summary>The reviews that count, added up. Every one is from a buyer, since only buyers may review (§3.5).</summary>
/// <param name="Average">The mean rating to one decimal; null with no reviews.</param>
/// <param name="PercentRecommend">The share of reviewers who recommend it, as a whole percent; null with no reviews.</param>
/// <param name="StarCounts">How many reviews gave 1, 2, 3, 4 and 5 stars, in that order, for the rating bars.</param>
public sealed record ReviewSummaryDto(int ReviewCount, decimal? Average, int? PercentRecommend, IReadOnlyList<int> StarCounts);

/// <summary>One review. The name is the account's display name, never typed in.</summary>
/// <param name="IsMine">True for the viewer's own review; false when the request names no viewer.</param>
/// <param name="IsHidden">The admin hid it. Only its author and the admin are sent it.</param>
/// <param name="Counts">False when it is hidden or its author's order was refunded: it is left out of the summary.</param>
/// <param name="ReviewerIsCreator">The reviewer also sells on Cookfeed: the trust label "Cookfeed creator".</param>
public sealed record ReviewDto(
    int Id,
    string ReviewerName,
    int Rating,
    bool Recommends,
    string Body,
    DateTimeOffset CreatedAt,
    bool IsMine,
    bool IsHidden,
    bool Counts,
    bool ReviewerIsCreator);

/// <summary>
/// What the review form shows, as the API reports it. Mirrors <c>Cookfeed.Domain.Access.ReviewFormState</c>; sent as
/// its name ("CanReview"), not a number.
/// </summary>
[JsonConverter(typeof(JsonStringEnumConverter<ReviewFormState>))]
public enum ReviewFormState
{
    SignIn,
    NoShop,
    YourOwn,
    AlreadyReviewed,
    HiddenReview,
    RefundedReview,
    MustBuy,
    CanReview,
}
