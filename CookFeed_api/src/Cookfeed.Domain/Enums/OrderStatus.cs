namespace Cookfeed.Domain.Enums;

/// <summary>Where an order is in its life. Only <see cref="Paid"/> orders grant access to their recipes.</summary>
public enum OrderStatus
{
    Pending,
    Paid,
    Refunded,
    Cancelled,
}
