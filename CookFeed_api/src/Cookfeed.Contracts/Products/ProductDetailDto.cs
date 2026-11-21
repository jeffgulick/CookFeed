using Cookfeed.Contracts.Recipes;
using Cookfeed.Contracts.Storefront;

namespace Cookfeed.Contracts.Products;

/// <summary>The page of one meal plan or recipe collection, as one viewer sees it.</summary>
/// <param name="RecipeCount">Distinct recipes in the list below.</param>
/// <param name="MealCount">Scheduled meals, for a meal plan, which may repeat a recipe (§3.2); null for a collection.</param>
/// <param name="IsForSale">
/// False once it is retired, its creator is suspended, or it holds no recipes or one that was taken down (§3.8). The
/// page is still served, so an old link or an order leads somewhere; the client shows "No longer for sale".
/// </param>
/// <param name="OwnedByViewer">True when the viewer has a Paid order for this product.</param>
/// <param name="ViewerIsCreator">True when the viewer made it; a creator cannot buy their own product (§3.1).</param>
/// <param name="InCart">True when it is in the viewer's cart.</param>
/// <param name="Recipes">
/// In plan order. A buyer sees the recipes they bought (their purchase snapshot, §3.3); everyone else sees the
/// product as it is today.
/// </param>
public sealed record ProductDetailDto(
    int Id,
    ProductType Type,
    string Title,
    string? Description,
    string? CoverImageUrl,
    int PriceCents,
    string Currency,
    ProductCreatorDto Creator,
    int RecipeCount,
    int? MealCount,
    ProductRatingDto Rating,
    bool IsForSale,
    bool OwnedByViewer,
    bool ViewerIsCreator,
    bool InCart,
    IReadOnlyList<ProductRecipeDto> Recipes);

/// <summary>Who sells the product.</summary>
public sealed record ProductCreatorDto(string Handle, string DisplayName, bool IsVerified);

/// <summary>The product's reviews in three numbers. Hidden reviews, and those of refunded buyers, are left out.</summary>
/// <param name="Average">The mean rating to one decimal; null with no reviews.</param>
/// <param name="PercentRecommend">The share of reviewers who recommend it, as a whole percent; null with no reviews.</param>
public sealed record ProductRatingDto(int ReviewCount, decimal? Average, int? PercentRecommend);

/// <summary>One recipe on the product's page: the card every viewer sees, and its details for a viewer who may open it.</summary>
/// <param name="DayOffset">For a meal plan, the day (0 = the first); null in a collection.</param>
/// <param name="Slot">For a meal plan, the meal; null in a collection.</param>
/// <param name="TotalMinutes">Prep plus cook time; null when the recipe gives neither.</param>
/// <param name="CanOpen">
/// True when the viewer may open the recipe: they bought it, made it, or it is free. False for a premium recipe
/// they have not bought, which is shown as a card with no link.
/// </param>
/// <param name="Details">Null when <paramref name="CanOpen"/> is false, so a locked recipe gives nothing else away.</param>
public sealed record ProductRecipeDto(
    int SortOrder,
    int? DayOffset,
    MealSlot? Slot,
    string Title,
    string? ThumbnailUrl,
    int Servings,
    int? TotalMinutes,
    RecipeVisibility Visibility,
    bool CanOpen,
    ProductRecipeDetailsDto? Details);

/// <summary>What a viewer who may open the recipe also gets: its id (the link), and the quick look the card shows.</summary>
/// <param name="FirstStep">How the recipe starts; null when it has no steps yet.</param>
/// <param name="SavedByViewer">False when the request names no viewer.</param>
/// <param name="OwnedThrough">
/// The title of the viewer's purchase that holds this recipe, for "Yours through <i>plan</i>"; null when no purchase does.
/// </param>
public sealed record ProductRecipeDetailsDto(
    int RecipeId,
    int? PrepMinutes,
    int? CookMinutes,
    int IngredientCount,
    int StepCount,
    string? FirstStep,
    int SaveCount,
    bool SavedByViewer,
    string? OwnedThrough);
