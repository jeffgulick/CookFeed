using Cookfeed.Contracts.Storefront;

namespace Cookfeed.Application.Products;

/// <summary>
/// What the repository reads for one product in the list of those for sale. The counts are raw;
/// <see cref="ProductListService"/> turns them into the rating and the meal count the tile shows.
/// </summary>
/// <param name="RecipeCount">Distinct recipes in the product.</param>
/// <param name="PlacementCount">Places in the product; a meal plan that serves a recipe twice counts it twice.</param>
/// <param name="ReviewCount">Reviews that count: not hidden, and written by a cook who still owns the product.</param>
/// <param name="RatingSum">The sum of those reviews' ratings.</param>
/// <param name="RecommendCount">How many of those reviewers recommend the product.</param>
public sealed record ProductTile(
    int Id,
    ProductType Type,
    string Title,
    string? CoverImageUrl,
    int PriceCents,
    string Currency,
    string CreatorHandle,
    int RecipeCount,
    int PlacementCount,
    int ReviewCount,
    int RatingSum,
    int RecommendCount,
    bool OwnedByViewer);
