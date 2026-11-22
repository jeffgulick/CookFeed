namespace Cookfeed.Domain.ShoppingList;

/// <summary>One ingredient line as a recipe writes it: 2.5 c rolled oats, in the Pantry aisle.</summary>
/// <param name="Unit">The unit's abbreviation, as the recipe uses it: "c", "tbsp", "g".</param>
public sealed record WrittenIngredientLine(int IngredientId, string Ingredient, string Aisle, decimal Quantity, string Unit);

/// <summary>
/// "What you'll buy" on a plan's page: the ingredients of its recipes as they are written, before anyone has decided
/// how many people to cook for. It follows the prototype's <c>buildShoppingList</c>. The cook's own shopping list is a
/// different thing and is worked out by <see cref="ShoppingListAggregator"/>, which also converts between units.
/// </summary>
public static class WrittenShoppingList
{
    /// <summary>
    /// Joins the lines that name the same ingredient in the same unit, adding their amounts, and sorts the result by
    /// aisle and then by ingredient, so the list follows a walk through the store. Nothing is converted: an ingredient
    /// written in cups in one recipe and tablespoons in another keeps a line for each, in the order they first came.
    /// Pass a recipe's lines once for every meal it is served at.
    /// </summary>
    public static IReadOnlyList<ShoppingListLine> Combine(IEnumerable<WrittenIngredientLine> lines) =>
        lines
            .GroupBy(line => (line.IngredientId, line.Unit))
            .Select(group =>
            {
                var first = group.First();
                return new ShoppingListLine(first.IngredientId, first.Ingredient, first.Aisle, group.Sum(l => l.Quantity), first.Unit);
            })
            // OrderBy keeps equal lines in the order they came, and compares the text exactly as stored.
            .OrderBy(line => line.Aisle, StringComparer.Ordinal)
            .ThenBy(line => line.Ingredient, StringComparer.Ordinal)
            .ToList();
}
