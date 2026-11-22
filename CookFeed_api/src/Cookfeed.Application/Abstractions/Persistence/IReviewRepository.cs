using Cookfeed.Application.Reviews;

namespace Cookfeed.Application.Abstractions.Persistence;

/// <summary>Reads and writes reviews. Implemented with EF Core in Infrastructure.</summary>
public interface IReviewRepository
{
    /// <summary>
    /// One product with every review of it, newest first, and what is known about <paramref name="viewerId"/>; null
    /// when no product has the id. It filters nothing: the service decides which reviews the viewer is shown.
    /// </summary>
    Task<ProductReviews?> GetProductReviewsAsync(int productId, int? viewerId, CancellationToken cancellationToken);

    /// <summary>
    /// Writes a review. Returns false, with nothing written, when <paramref name="userId"/> already has a review of
    /// the product: the database allows one per account and product.
    /// </summary>
    Task<bool> AddAsync(int productId, int userId, int rating, bool recommends, string body, DateTimeOffset createdAt,
        CancellationToken cancellationToken);

    /// <summary>Deletes the review <paramref name="userId"/> wrote of the product. Does nothing if there is none.</summary>
    Task DeleteAsync(int productId, int userId, CancellationToken cancellationToken);
}
