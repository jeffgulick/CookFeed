using Cookfeed.Domain.Enums;

namespace Cookfeed.Domain.ShoppingList;

/// <summary>
/// The C# half of the shopping list (DesignDocument.md §7.5): turns the database's per-category totals into the
/// lines a person shops from. The database has already chosen the recipes, scaled them and summed each
/// (ingredient, unit category) in its base unit; what is left here is policy, which is why it lives in plain C#
/// with its own tests. <c>docs/sql/queries.sql</c> Q8 is the same policy in SQL, and the two must agree.
/// </summary>
public static class ShoppingListAggregator
{
    public static AggregatedShoppingList Aggregate(IEnumerable<IngredientTotal> totals)
    {
        // Sorted by aisle then ingredient, as the list is walked through a store. Ordinal comparison, so the order
        // does not depend on the machine's culture; Q8's ORDER BY uses the database's collation instead.
        var lines = totals
            .GroupBy(t => t.IngredientId)
            .SelectMany(LinesFor)
            .OrderBy(l => l.Aisle, StringComparer.Ordinal)
            .ThenBy(l => l.Ingredient, StringComparer.Ordinal)
            .ThenBy(l => l.Unit, StringComparer.Ordinal)
            .ToList();

        // An ingredient that still needs more than one line could not be added up; all its lines are shown
        // together as unmerged, so the reader sees both amounts rather than a guess (§7.3).
        var unmerged = lines.GroupBy(l => l.IngredientId).Where(g => g.Count() > 1).Select(g => g.Key).ToHashSet();
        return new AggregatedShoppingList(
            [.. lines.Where(l => !unmerged.Contains(l.IngredientId))],
            [.. lines.Where(l => unmerged.Contains(l.IngredientId))]);
    }

    private static IEnumerable<ShoppingListLine> LinesFor(IGrouping<int, IngredientTotal> ingredient)
    {
        var details = ingredient.First();
        // Convert each total toward the preferred unit's category where density allows, then add up whatever
        // now shares a category. Anything that could not be converted stays a line of its own.
        return ingredient
            .Select(TowardPreferredCategory)
            .GroupBy(total => total.Category)
            .Select(category => Present(details, category.Key, category.Sum(total => total.BaseQuantity)));
    }

    // §7.4: density runs toward the preferred unit's category, never the other way. Flour prefers grams, so its
    // cups become grams; milk prefers millilitres, so a "200 g milk" line becomes millilitres. Count never converts.
    private static (UnitCategory Category, decimal BaseQuantity) TowardPreferredCategory(IngredientTotal total) =>
        (total.Category, total.PreferredUnitCategory, total.DensityGPerMl) switch
        {
            (UnitCategory.Volume, UnitCategory.Mass, decimal gramsPerMl) => (UnitCategory.Mass, total.BaseQuantity * gramsPerMl),
            (UnitCategory.Mass, UnitCategory.Volume, decimal gramsPerMl) => (UnitCategory.Volume, total.BaseQuantity / gramsPerMl),
            _ => (total.Category, total.BaseQuantity),
        };

    // In the preferred unit when the categories match; otherwise in the category's base unit, rather than dropped.
    // Rounded half away from zero to two places, as PostgreSQL's ROUND does in Q8.
    private static ShoppingListLine Present(IngredientTotal ingredient, UnitCategory category, decimal baseQuantity)
    {
        var (quantity, unit) =
            ingredient.PreferredUnitCategory == category
            && ingredient.PreferredUnitToBaseFactor is decimal factor
            && ingredient.PreferredUnitAbbreviation is string abbreviation
                ? (baseQuantity / factor, abbreviation)
                : (baseQuantity, BaseUnit(category));

        return new ShoppingListLine(ingredient.IngredientId, ingredient.Name, ingredient.Aisle,
            Math.Round(quantity, 2, MidpointRounding.AwayFromZero), unit);
    }

    private static string BaseUnit(UnitCategory category) => category switch
    {
        UnitCategory.Volume => "ml",
        UnitCategory.Mass => "g",
        UnitCategory.Count => "ea",
        _ => throw new ArgumentOutOfRangeException(nameof(category), category, "Unknown unit category."),
    };
}
