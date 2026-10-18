using Cookfeed.Domain.Enums;

namespace Cookfeed.Domain.Entities;

/// <summary>
/// A shopping list a cook built for one trip to the store: the recipes they mean to cook, each for a number
/// of people, and where the trip is in its life (§3.9). The list's lines are computed from the items, never stored.
/// </summary>
public class ShoppingTrip
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public User User { get; set; } = null!;

    public required string Name { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    public TripStatus Status { get; set; }

    /// <summary>The delivery partner the list was sent to (Instacart, Favor), when it was.</summary>
    public string? SentTo { get; set; }

    /// <summary>When the cook confirmed the trip complete or the items received. Null until then.</summary>
    public DateTimeOffset? CompletedAt { get; set; }

    public List<ShoppingTripItem> Items { get; set; } = [];

    /// <summary>Ingredients the cook took off this trip's list because they already have them (§3.9).</summary>
    public List<ShoppingTripSkip> Skips { get; set; } = [];
}
