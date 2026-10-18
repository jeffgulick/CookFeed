namespace Cookfeed.Domain.Entities;

/// <summary>
/// One thing an admin did to somebody else's row: hid a review, suspended a creator, retired a product,
/// refunded an order. The audit trail of §3.8; the row it names is changed in the same transaction.
/// </summary>
public class AdminAction
{
    public int Id { get; set; }

    public int AdminUserId { get; set; }

    public User AdminUser { get; set; } = null!;

    /// <summary>What was done, e.g. <c>HideReview</c>, <c>SuspendCreator</c>, <c>RefundOrder</c>.</summary>
    public required string Action { get; set; }

    /// <summary>The table of the row acted on, e.g. <c>reviews</c>.</summary>
    public required string TargetTable { get; set; }

    /// <summary>The primary key of that row.</summary>
    public int TargetId { get; set; }

    public string? Note { get; set; }

    public DateTimeOffset CreatedAt { get; set; }
}
