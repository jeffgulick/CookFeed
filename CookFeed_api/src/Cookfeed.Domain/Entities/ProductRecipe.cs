using Cookfeed.Domain.Enums;

namespace Cookfeed.Domain.Entities;

/// <summary>
/// A recipe in a product as it is sold today. For a meal plan it has a day and a meal, and the same recipe
/// may appear on several days; for a collection both are null and a recipe appears once (§3.2).
/// </summary>
public class ProductRecipe
{
    public int Id { get; set; }

    public int ProductId { get; set; }

    public Product Product { get; set; } = null!;

    public int RecipeId { get; set; }

    public Recipe Recipe { get; set; } = null!;

    public int SortOrder { get; set; }

    /// <summary>0 to 6: days from the start of the plan. Null for a collection, together with <see cref="Slot"/>.</summary>
    public int? DayOffset { get; set; }

    public MealSlot? Slot { get; set; }
}
