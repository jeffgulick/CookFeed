namespace Cookfeed.Domain.ShoppingList;

/// <summary>One line of a shopping list, e.g. "all-purpose flour, 1032.91 g", in the Pantry aisle.</summary>
public sealed record ShoppingListLine(int IngredientId, string Ingredient, string Aisle, decimal Quantity, string Unit);
