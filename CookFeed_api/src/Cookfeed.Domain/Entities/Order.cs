using Cookfeed.Domain.Enums;

namespace Cookfeed.Domain.Entities;

/// <summary>A checkout. Orders are never deleted: they are the financial record.</summary>
public class Order
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public User User { get; set; } = null!;

    public OrderStatus Status { get; set; }

    public DateTimeOffset PlacedAt { get; set; }

    public DateTimeOffset? PaidAt { get; set; }

    /// <summary>The total charged, written once at checkout (DesignDocument.md §6).</summary>
    public int TotalCents { get; set; }

    public required string Currency { get; set; }

    public string? PaymentReference { get; set; }

    public List<OrderItem> Items { get; set; } = [];
}
