using Cookfeed.Contracts.Recipes;
using Cookfeed.Contracts.Storefront;

namespace Cookfeed.Contracts.Purchases;

/// <summary>One meal plan or collection the caller owns through a Paid order, with what it held when they bought it.</summary>
/// <param name="Title">The product's title as it was at checkout; a later rename does not change it.</param>
/// <param name="PurchasedAt">When the order was placed.</param>
/// <param name="RecipeCount">Distinct recipes in the purchase.</param>
/// <param name="MealCount">Scheduled meals, for a meal plan, which may repeat a recipe (§3.2); null for a collection.</param>
/// <param name="Recipes">
/// The purchase snapshot, in its order: what the buyer keeps even after the creator edits the product (§3.3, Q15).
/// </param>
public sealed record PurchaseDto(
    int ProductId,
    ProductType Type,
    string Title,
    string? CoverImageUrl,
    DateTimeOffset PurchasedAt,
    int RecipeCount,
    int? MealCount,
    IReadOnlyList<PurchasedRecipeDto> Recipes);

/// <summary>One recipe in a purchase. The buyer may open every one of these.</summary>
/// <param name="DayOffset">For a meal plan, the day (0 = the first); null in a collection.</param>
/// <param name="Slot">For a meal plan, the meal; null in a collection.</param>
public sealed record PurchasedRecipeDto(
    int RecipeId,
    string Title,
    string? ThumbnailUrl,
    RecipeVisibility Visibility,
    int SortOrder,
    int? DayOffset,
    MealSlot? Slot);
