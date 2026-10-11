namespace Cookfeed.Domain.Entities;

/// <summary>A product in an account's cart. A product is in a cart once or not at all.</summary>
public class CartItem
{
    public int UserId { get; set; }

    public User User { get; set; } = null!;

    public int ProductId { get; set; }

    public Product Product { get; set; } = null!;

    public DateTimeOffset AddedAt { get; set; }
}
