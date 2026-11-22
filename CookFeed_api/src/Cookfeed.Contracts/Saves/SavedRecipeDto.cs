using Cookfeed.Contracts.Recipes;

namespace Cookfeed.Contracts.Saves;

/// <summary>One recipe the caller saved, as a card in My kitchen.</summary>
/// <param name="TotalMinutes">Prep plus cook time; null when the recipe gives neither.</param>
/// <param name="Visibility">ProductOnly for a premium recipe, which the caller saved after buying its plan.</param>
public sealed record SavedRecipeDto(
    int Id,
    string Title,
    string? ThumbnailUrl,
    int Servings,
    int? TotalMinutes,
    int SaveCount,
    string CreatorHandle,
    bool CreatorIsVerified,
    RecipeVisibility Visibility,
    DateTimeOffset SavedAt);

/// <summary>The answer to saving or unsaving: whether the caller now has it saved, and how many cooks do.</summary>
public sealed record SaveStateDto(int RecipeId, bool Saved, int SaveCount);
