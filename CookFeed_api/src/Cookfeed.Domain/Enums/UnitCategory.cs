namespace Cookfeed.Domain.Enums;

/// <summary>
/// What kind of amount a unit measures. Quantities in the same category add up after converting to the
/// category's base unit (ml, g, or 1 for Count); Volume and Mass also convert through an ingredient's density.
/// </summary>
public enum UnitCategory
{
    Volume,
    Mass,
    Count,
}
