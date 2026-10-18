namespace Cookfeed.Domain.Entities;

/// <summary>A buyer's rating and review of a product. One per account per product.</summary>
public class Review
{
    public int Id { get; set; }

    public int ProductId { get; set; }

    public Product Product { get; set; } = null!;

    public int UserId { get; set; }

    public User User { get; set; } = null!;

    /// <summary>1 to 5 stars.</summary>
    public short Rating { get; set; }

    public bool Recommends { get; set; }

    public required string Body { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>Set when an admin hides the review from everyone but admins (§3.8). Null means shown.</summary>
    public DateTimeOffset? HiddenAt { get; set; }
}
