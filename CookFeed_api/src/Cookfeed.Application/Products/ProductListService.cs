using Cookfeed.Application.Abstractions.Persistence;
using Cookfeed.Contracts.Products;
using Cookfeed.Contracts.Storefront;

namespace Cookfeed.Application.Products;

/// <summary>The meal plans and collections for sale, as the tiles on Discover and on the Plans page.</summary>
public class ProductListService(IProductRepository products)
{
    /// <summary>
    /// The products for sale, filtered and ordered by the repository. <paramref name="type"/> null means both kinds.
    /// </summary>
    public async Task<IReadOnlyList<ProductTileDto>> GetProductsAsync(
        ProductType? type, ProductSort sort, int? viewerId, CancellationToken cancellationToken)
    {
        var tiles = await products.GetForSaleAsync(type, sort, viewerId, cancellationToken);

        return tiles.Select(t => new ProductTileDto(
            t.Id,
            t.Type,
            t.Title,
            t.CoverImageUrl,
            t.PriceCents,
            t.Currency,
            t.CreatorHandle,
            t.RecipeCount,
            // Only a meal plan schedules meals, and it may serve one recipe on several days (DesignDocument.md §3.2, Q5).
            MealCount: t.Type == ProductType.MealPlan ? t.PlacementCount : null,
            // The same three numbers, worked out the same way, as on the product's own page (Q13).
            ProductRating.From(t.ReviewCount, t.RatingSum, t.RecommendCount),
            t.OwnedByViewer)).ToList();
    }
}
