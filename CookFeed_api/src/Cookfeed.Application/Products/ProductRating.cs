using Cookfeed.Contracts.Products;

namespace Cookfeed.Application.Products;

/// <summary>The three numbers of queries.sql Q13, worked out the same way on the product page and the reviews page.</summary>
public static class ProductRating
{
    /// <summary>
    /// The average to one decimal and the whole percent recommending, from the reviews that count. PostgreSQL's ROUND
    /// takes a half away from zero, so this does too. With no reviews there is no average and no percent.
    /// </summary>
    public static ProductRatingDto From(int reviewCount, int ratingSum, int recommendCount) =>
        reviewCount == 0
            ? new ProductRatingDto(0, null, null)
            : new ProductRatingDto(
                reviewCount,
                Math.Round((decimal)ratingSum / reviewCount, 1, MidpointRounding.AwayFromZero),
                (int)Math.Round(100m * recommendCount / reviewCount, MidpointRounding.AwayFromZero));
}
