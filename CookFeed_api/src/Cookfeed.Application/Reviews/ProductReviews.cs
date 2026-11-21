using Cookfeed.Contracts.Storefront;

namespace Cookfeed.Application.Reviews;

/// <summary>
/// What the repository reads for one product's reviews page: the product, what is known about the viewer, and every
/// review. <see cref="ProductReviewsService"/> decides which reviews the viewer is shown and which count.
/// </summary>
/// <param name="ViewerCanShop">The viewer holds the HomeCook role; false when the request names no viewer.</param>
/// <param name="ViewerIsAdmin">The viewer holds the Admin role.</param>
/// <param name="ViewerOwnsProduct">The viewer has a Paid order for the product.</param>
/// <param name="Reviews">Every review of the product, newest first, hidden ones included.</param>
public sealed record ProductReviews(
    int ProductId,
    ProductType Type,
    string Title,
    int CreatorId,
    string CreatorHandle,
    string CreatorDisplayName,
    bool CreatorIsVerified,
    bool ViewerCanShop,
    bool ViewerIsAdmin,
    bool ViewerOwnsProduct,
    IReadOnlyList<ProductReviewRow> Reviews);

/// <summary>One review as stored, with what decides whether it counts.</summary>
/// <param name="AuthorOwnsProduct">Its author still has a Paid order for the product.</param>
/// <param name="ReviewerIsCreator">Its author has a creator profile.</param>
public sealed record ProductReviewRow(
    int Id,
    int UserId,
    string ReviewerName,
    int Rating,
    bool Recommends,
    string Body,
    DateTimeOffset CreatedAt,
    bool IsHidden,
    bool AuthorOwnsProduct,
    bool ReviewerIsCreator);
