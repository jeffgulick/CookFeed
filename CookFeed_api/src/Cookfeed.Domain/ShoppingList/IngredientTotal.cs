using Cookfeed.Domain.Enums;

namespace Cookfeed.Domain.ShoppingList;

/// <summary>
/// How much of one ingredient a shopping list needs in one unit category, already scaled and summed by the
/// database and expressed in the category's base unit (ml, g or each). One ingredient can have several: one per
/// category its recipes measure it in (DesignDocument.md §7.2). This is the input to
/// <see cref="ShoppingListAggregator"/>.
/// </summary>
/// <param name="DensityGPerMl">Grams per millilitre, when known; it lets Volume and Mass totals merge (§7.3).</param>
/// <param name="PreferredUnitCategory">The category of the unit the ingredient is shopped in; null when it has none.</param>
/// <param name="PreferredUnitToBaseFactor">That unit's size in its category's base unit, e.g. 1000 for kg.</param>
/// <param name="PreferredUnitAbbreviation">How that unit is written, e.g. <c>g</c>.</param>
/// <param name="Category">The category of the recipe units this total was summed from.</param>
/// <param name="BaseQuantity">The total, in <paramref name="Category"/>'s base unit.</param>
public sealed record IngredientTotal(
    int IngredientId,
    string Name,
    string Aisle,
    decimal? DensityGPerMl,
    UnitCategory? PreferredUnitCategory,
    decimal? PreferredUnitToBaseFactor,
    string? PreferredUnitAbbreviation,
    UnitCategory Category,
    decimal BaseQuantity);
