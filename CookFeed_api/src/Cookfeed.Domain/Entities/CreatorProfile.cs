namespace Cookfeed.Domain.Entities;

/// <summary>
/// The storefront of an account that sells. It shares its key with <see cref="User"/>, so an account has at
/// most one, and recipes and products reference it, which guarantees their owner is a creator.
/// </summary>
public class CreatorProfile
{
    public int UserId { get; set; }

    public User User { get; set; } = null!;

    /// <summary>The storefront address, e.g. <c>kenji-kitchen</c>: lower-case letters, digits and single hyphens.</summary>
    public required string Handle { get; set; }

    public string? Bio { get; set; }

    public string? AvatarUrl { get; set; }

    public bool IsVerified { get; set; }

    public List<Recipe> Recipes { get; set; } = [];

    public List<Product> Products { get; set; } = [];
}
