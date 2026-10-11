using Cookfeed.Domain.Enums;

namespace Cookfeed.Domain.Entities;

/// <summary>A unit of measure, e.g. cup: Volume, 236.588 ml (DesignDocument.md §7.2).</summary>
public class Unit
{
    public int Id { get; set; }

    public required string Name { get; set; }

    public required string Abbreviation { get; set; }

    public UnitCategory Category { get; set; }

    /// <summary>How many of the category's base unit (ml, g or 1) one of this unit is.</summary>
    public decimal ToBaseFactor { get; set; }

    public bool IsMetric { get; set; }
}
