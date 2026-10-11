namespace Cookfeed.Domain.Entities;

/// <summary>
/// A canonical ingredient. Every recipe that uses flour points at the same row, which is what lets the
/// shopping list add them up (DesignDocument.md §7.1).
/// </summary>
public class Ingredient
{
    public int Id { get; set; }

    /// <summary>Canonical, lower-case name, e.g. <c>all-purpose flour</c>.</summary>
    public required string Name { get; set; }

    /// <summary>The store aisle it is grouped under on the shopping list, e.g. <c>Pantry</c>.</summary>
    public required string Category { get; set; }

    /// <summary>Grams per millilitre. When known, volume and mass amounts can be added together (§7.3).</summary>
    public decimal? DensityGPerMl { get; set; }

    public int? PreferredShoppingUnitId { get; set; }

    /// <summary>How the shopping list shows it, and which way density converts it (§7.4).</summary>
    public Unit? PreferredShoppingUnit { get; set; }
}
