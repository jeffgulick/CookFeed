using Cookfeed.Domain.Enums;

namespace Cookfeed.Domain.Entities;

/// <summary>
/// A recipe the buyer got with an order item, copied from <see cref="ProductRecipe"/> at checkout. Access to
/// a product-only recipe is decided from these rows, never from the product's current contents.
/// </summary>
public class OrderItemRecipe
{
    public int Id { get; set; }

    public int OrderItemId { get; set; }

    public OrderItem OrderItem { get; set; } = null!;

    public int RecipeId { get; set; }

    public Recipe Recipe { get; set; } = null!;

    public int SortOrder { get; set; }

    public int? DayOffset { get; set; }

    public MealSlot? Slot { get; set; }
}
