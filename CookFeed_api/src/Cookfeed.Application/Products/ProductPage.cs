using Cookfeed.Contracts.Recipes;
using Cookfeed.Contracts.Storefront;
using Cookfeed.Domain.Access;

namespace Cookfeed.Application.Products;

/// <summary>
/// What the repository reads for one product's page, before the access rule is applied: every recipe comes with its
/// details and with the facts <see cref="RecipeAccess"/> needs, and <see cref="ProductPageService"/> decides what the
/// viewer gets to see.
/// </summary>
/// <param name="ReviewCount">Reviews that count: not hidden, and written by a cook who still owns the product.</param>
/// <param name="RatingSum">The sum of those reviews' ratings.</param>
/// <param name="RecommendCount">How many of those reviewers recommend the product.</param>
/// <param name="Placements">The buyer's purchase snapshot when the viewer owns it, otherwise the product as it is today.</param>
public sealed record ProductPage(
    int Id,
    ProductType Type,
    string Title,
    string? Description,
    string? CoverImageUrl,
    int PriceCents,
    string Currency,
    int CreatorId,
    string CreatorHandle,
    string CreatorDisplayName,
    bool CreatorIsVerified,
    bool IsForSale,
    bool OwnedByViewer,
    bool InCart,
    int ReviewCount,
    int RatingSum,
    int RecommendCount,
    IReadOnlyList<ProductPagePlacement> Placements);

/// <summary>One recipe in its place in the product, with everything its card could show.</summary>
/// <param name="OwnedThrough">The title of the viewer's Paid purchase that holds the recipe, or null.</param>
public sealed record ProductPagePlacement(
    int SortOrder,
    int? DayOffset,
    MealSlot? Slot,
    int RecipeId,
    string Title,
    string? ThumbnailUrl,
    int Servings,
    int? PrepMinutes,
    int? CookMinutes,
    int IngredientCount,
    int StepCount,
    string? FirstStep,
    int SaveCount,
    bool SavedByViewer,
    string? OwnedThrough,
    RecipeAccessFacts Access);
