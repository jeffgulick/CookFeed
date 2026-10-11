namespace Cookfeed.Contracts.Orders;

/// <summary>One order in the caller's history, with what was bought in it.</summary>
/// <param name="TotalCents">The total charged, written once at checkout (DesignDocument.md §6).</param>
public sealed record OrderDto(
    int Id,
    OrderStatus Status,
    DateTimeOffset PlacedAt,
    DateTimeOffset? PaidAt,
    int TotalCents,
    string Currency,
    IReadOnlyList<OrderItemDto> Items);
