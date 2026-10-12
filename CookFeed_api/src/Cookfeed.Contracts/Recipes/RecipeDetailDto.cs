namespace Cookfeed.Contracts.Recipes;

/// <summary>One recipe in full: the page a cook follows while watching its video.</summary>
/// <param name="TotalMinutes">Prep plus cook time; null when the recipe gives neither.</param>
/// <param name="PublishedAt">Null only for a draft, which only its creator can open.</param>
/// <param name="SavedByViewer">False when the request names no viewer.</param>
/// <param name="ViewerIsCreator">True when the viewer made this recipe; such a viewer may be looking at a draft.</param>
/// <param name="IncludedIn">
/// Every placement of this recipe in an active product, in product order. A meal plan that serves it twice (Family
/// Week's oats) lists it twice, once per day and slot.
/// </param>
public sealed record RecipeDetailDto(
    int Id,
    string Title,
    string? Description,
    string VideoUrl,
    string? ThumbnailUrl,
    int Servings,
    int? PrepMinutes,
    int? CookMinutes,
    int? TotalMinutes,
    int SaveCount,
    bool IsPublished,
    RecipeVisibility Visibility,
    DateTimeOffset? PublishedAt,
    RecipeCreatorDto Creator,
    bool SavedByViewer,
    bool ViewerIsCreator,
    IReadOnlyList<RecipeIngredientDto> Ingredients,
    IReadOnlyList<RecipeStepDto> Steps,
    IReadOnlyList<RecipePlacementDto> IncludedIn);

/// <summary>Who made the recipe.</summary>
public sealed record RecipeCreatorDto(string Handle, string DisplayName, string? AvatarUrl, bool IsVerified);

/// <summary>One ingredient line, as the creator wrote it.</summary>
/// <param name="Unit">The unit's abbreviation ("g", "tbsp").</param>
/// <param name="Ingredient">The canonical ingredient's name, the one the shopping list merges on.</param>
/// <param name="DisplayText">How the creator phrased it, when that differs ("5 oz can tuna").</param>
public sealed record RecipeIngredientDto(
    int SortOrder,
    decimal Quantity,
    string Unit,
    string Ingredient,
    string? DisplayText,
    string? Preparation,
    bool IsOptional);

/// <summary>One numbered step.</summary>
/// <param name="VideoTimestampSeconds">Where the step starts in the video, for "Watch at 0:16"; null if not marked.</param>
public sealed record RecipeStepDto(int StepNumber, string Instruction, int? VideoTimestampSeconds);

/// <summary>One place the recipe appears in a product a cook can buy.</summary>
/// <param name="DayOffset">For a meal plan, the day (0 = the first); null in a collection.</param>
/// <param name="Slot">For a meal plan, the meal; null in a collection.</param>
/// <param name="OwnedByViewer">
/// The viewer has a Paid order for this product. For a ProductOnly recipe it is what "Yours through <i>plan</i>" names.
/// </param>
public sealed record RecipePlacementDto(
    int ProductId,
    string ProductTitle,
    Storefront.ProductType ProductType,
    int? DayOffset,
    MealSlot? Slot,
    bool OwnedByViewer);
