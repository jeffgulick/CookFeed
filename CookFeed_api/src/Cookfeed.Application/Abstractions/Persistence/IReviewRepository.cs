using Cookfeed.Application.Reviews;

namespace Cookfeed.Application.Abstractions.Persistence;

/// <summary>Reads reviews from the database. Implemented with EF Core in Infrastructure.</summary>
public interface IReviewRepository
{
    /// <summary>
    /// One product with every review of it, newest first, and what is known about <paramref name="viewerId"/>; null
    /// when no product has the id. It filters nothing: the service decides which reviews the viewer is shown.
    /// </summary>
    Task<ProductReviews?> GetProductReviewsAsync(int productId, int? viewerId, CancellationToken cancellationToken);
}
