using Cookfeed.Domain.Enums;

namespace Cookfeed.Domain.Entities;

/// <summary>A recipe planned for a day and meal, optionally for a different number of people.</summary>
public class MealPlanEntry
{
    public int Id { get; set; }

    public int MealPlanId { get; set; }

    public MealPlan MealPlan { get; set; } = null!;

    public int RecipeId { get; set; }

    public Recipe Recipe { get; set; } = null!;

    public DateOnly PlannedDate { get; set; }

    public MealSlot Slot { get; set; }

    /// <summary>Servings to cook instead of the recipe's own; the shopping list scales by it (§7.6).</summary>
    public int? ServingsOverride { get; set; }
}
