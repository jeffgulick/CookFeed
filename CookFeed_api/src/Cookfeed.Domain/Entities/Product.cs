using Cookfeed.Domain.Enums;

namespace Cookfeed.Domain.Entities;

/// <summary>A recipe collection or meal plan a creator sells.</summary>
public class Product
{
    public int Id { get; set; }

    public int CreatorId { get; set; }

    public CreatorProfile Creator { get; set; } = null!;

    public ProductType Type { get; set; }

    public required string Title { get; set; }

    public string? Description { get; set; }

    public string? CoverImageUrl { get; set; }

    /// <summary>Price in cents, so money is never a floating-point number.</summary>
    public int PriceCents { get; set; }

    /// <summary>Three-letter currency code, e.g. <c>USD</c>.</summary>
    public required string Currency { get; set; }

    /// <summary>False once retired: no longer sold, but kept because buyers' orders refer to it.</summary>
    public bool IsActive { get; set; }

    public DateTimeOffset CreatedAt { get; set; }

    /// <summary>What the product contains today. Buyers keep what it contained when they bought it.</summary>
    public List<ProductRecipe> Recipes { get; set; } = [];

    public List<Review> Reviews { get; set; } = [];
}
