using Cookfeed.Domain.Enums;

namespace Cookfeed.Domain.Entities;

/// <summary>A recipe video with its steps and ingredients.</summary>
public class Recipe
{
    public int Id { get; set; }

    public int CreatorId { get; set; }

    public CreatorProfile Creator { get; set; } = null!;

    public required string Title { get; set; }

    public string? Description { get; set; }

    public required string VideoUrl { get; set; }

    public string? ThumbnailUrl { get; set; }

    /// <summary>How many people the quantities serve. Always above zero: the shopping list divides by it.</summary>
    public int Servings { get; set; }

    public int? PrepMinutes { get; set; }

    public int? CookMinutes { get; set; }

    /// <summary>False while it is a draft. A published recipe must have <see cref="PublishedAt"/>.</summary>
    public bool IsPublished { get; set; }

    public RecipeVisibility Visibility { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public DateTimeOffset? PublishedAt { get; set; }

    /// <summary>
    /// How many accounts have saved the recipe. The database keeps it equal to the save rows with a trigger
    /// (DesignDocument.md §3.4), so the application reads it and never sets it.
    /// </summary>
    public int SaveCount { get; private set; }

    public List<RecipeStep> Steps { get; set; } = [];

    public List<RecipeIngredient> Ingredients { get; set; } = [];

    public List<SavedRecipe> SavedBy { get; set; } = [];

    public List<MealPlanEntry> MealPlanEntries { get; set; } = [];

    public List<ProductRecipe> ProductRecipes { get; set; } = [];

    public List<OrderItemRecipe> OrderItemRecipes { get; set; } = [];
}
