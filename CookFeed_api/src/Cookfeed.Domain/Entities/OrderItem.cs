namespace Cookfeed.Domain.Entities;

/// <summary>
/// A product bought in an order. The title, price and seller are copied from the product at checkout, so
/// order history shows what was paid even if the creator renames or reprices the product later (§6).
/// </summary>
public class OrderItem
{
    public int Id { get; set; }

    public int OrderId { get; set; }

    public Order Order { get; set; } = null!;

    public int ProductId { get; set; }

    public Product Product { get; set; } = null!;

    /// <summary>The seller at checkout. A copied value, not a link: it has no foreign key.</summary>
    public int CreatorId { get; set; }

    public required string ProductTitle { get; set; }

    public int UnitPriceCents { get; set; }

    /// <summary>The product's recipes as they were at checkout: what the buyer owns (§3.3).</summary>
    public List<OrderItemRecipe> Recipes { get; set; } = [];
}
