using Cookfeed.Contracts.Storefront;

namespace Cookfeed.Contracts.Products;

/// <summary>One meal plan or collection for sale, as a tile on Discover and on the Plans page.</summary>
/// <param name="CreatorHandle">Who sells it; also the address of their storefront.</param>
/// <param name="RecipeCount">Distinct recipes in the product.</param>
/// <param name="MealCount">Scheduled meals, for a meal plan, which may repeat a recipe (§3.2); null for a collection.</param>
/// <param name="OwnedByViewer">True when the viewer has a Paid order for it; the tile then says so instead of the price.</param>
public sealed record ProductTileDto(
    int Id,
    ProductType Type,
    string Title,
    string? CoverImageUrl,
    int PriceCents,
    string Currency,
    string CreatorHandle,
    int RecipeCount,
    int? MealCount,
    ProductRatingDto Rating,
    bool OwnedByViewer);
