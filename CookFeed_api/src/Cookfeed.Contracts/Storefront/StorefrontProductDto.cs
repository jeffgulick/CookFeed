namespace Cookfeed.Contracts.Storefront;

/// <summary>One product a creator has for sale today.</summary>
/// <param name="RecipeCount">Distinct recipes in the product.</param>
/// <param name="MealCount">Scheduled meals, for a meal plan, which may repeat a recipe (§3.2); null for a collection.</param>
/// <param name="OwnedByViewer">True when the viewer has a Paid order for this product.</param>
/// <param name="InCart">True when it is in the viewer's cart.</param>
public sealed record StorefrontProductDto(
    int Id,
    ProductType Type,
    string Title,
    string? Description,
    string? CoverImageUrl,
    int PriceCents,
    string Currency,
    int RecipeCount,
    int? MealCount,
    bool OwnedByViewer,
    bool InCart);
