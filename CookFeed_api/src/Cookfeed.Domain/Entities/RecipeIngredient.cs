namespace Cookfeed.Domain.Entities;

/// <summary>One ingredient line of a recipe: how much of which ingredient, in which unit.</summary>
public class RecipeIngredient
{
    public int Id { get; set; }

    public int RecipeId { get; set; }

    public Recipe Recipe { get; set; } = null!;

    public int IngredientId { get; set; }

    public Ingredient Ingredient { get; set; } = null!;

    public int UnitId { get; set; }

    public Unit Unit { get; set; } = null!;

    public decimal Quantity { get; set; }

    /// <summary>What the creator wrote, shown on the recipe page and never used for adding up.</summary>
    public string? DisplayText { get; set; }

    public string? Preparation { get; set; }

    public int SortOrder { get; set; }

    /// <summary>Optional ingredients are left off the shopping list.</summary>
    public bool IsOptional { get; set; }
}
